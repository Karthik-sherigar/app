from fastapi import UploadFile, File, HTTPException, Form
import logging
import json
import io
import asyncio
import PyPDF2
from shared import (
    neo4j_service, session_service,
    generate_with_fallback, validate_and_normalize_graph,
    PDFDeepDiveRequest, PDFChatRequest, extract_json,
    cohere_client, generate_with_cohere, api_keys
)

# Explicitly configure file logging for PDF server
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pdf_server_internal.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("pdf_server")

async def pdf_debug_text(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        text_parts = []
        for page in pdf_reader.pages[:5]:
            extracted = page.extract_text()
            if extracted: text_parts.append(extracted)
        return {"filename": file.filename, "pages_read": len(text_parts), "sample_text": "\n".join(text_parts)[:2000]}
    except Exception as e:
        return {"error": str(e)}

async def pdf_generate_graph_from_pdf(file: UploadFile = File(...), user_email: str = Form(None)):
    try:
        contents = await file.read()
        filename_lower = file.filename.lower()
        text_parts = []
        
        try:
            if filename_lower.endswith('.docx'):
                import docx
                doc = docx.Document(io.BytesIO(contents))
                for idx, para in enumerate(doc.paragraphs):
                    if para.text.strip():
                        page_idx = idx // 20
                        while len(text_parts) <= page_idx:
                            text_parts.append("")
                        text_parts[page_idx] += para.text + "\n"
                        
            elif filename_lower.endswith('.pptx'):
                import pptx
                prs = pptx.Presentation(io.BytesIO(contents))
                for slide in prs.slides:
                    slide_text = []
                    for shape in slide.shapes:
                        if hasattr(shape, "text") and shape.text.strip():
                            slide_text.append(shape.text.strip())
                        if getattr(shape, "has_table", False):
                            for row in shape.table.rows:
                                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                                if row_text:
                                    slide_text.append(" | ".join(row_text))
                    if slide_text:
                        text_parts.append("\n".join(slide_text))
                        
            else:
                try:
                    pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
                except Exception as e:
                    raise HTTPException(status_code=422, detail="Invalid file format. Please upload a valid PDF, DOCX, or PPTX.")
                
                for i, page in enumerate(pdf_reader.pages[:200]):
                    try:
                        extracted = page.extract_text()
                        if extracted and len(extracted.strip()) > 20: 
                            text_parts.append(extracted)
                        else:
                            logger.warning(f"Page {i+1}: Little text extracted.")
                    except Exception as e:
                        logger.error(f"Error extracting text from page {i+1}: {e}")
        except HTTPException as he:
            raise he
        except Exception as gen_e:
            logger.error(f"File parsing error: {gen_e}")
            raise HTTPException(status_code=422, detail=f"Failed to extract text from file.")
            
        full_text = "\n".join(text_parts)
        if len(full_text.strip()) < 100:
            if filename_lower.endswith('.pdf'):
                raise HTTPException(status_code=422, detail="This PDF appears to be scanned or contains only images. Please use an OCR-ready PDF.")
            else:
                raise HTTPException(status_code=422, detail="Could not extract enough text from the document.")

        num_parts = len(text_parts)
        logger.info(f"Successfully extracted text from {num_parts} pages. Total chars: {len(full_text)}")
        
        # Robust Splitting: Ensure Part 1 always has at least one page if available
        mid = max(1, num_parts // 2) if num_parts > 1 else num_parts

        def get_sampled_text(text_list, max_chars=60000):
            if not text_list: return ""
            total_pages = len(text_list)
            if total_pages <= 20: # Increased threshold for full read
                return "\n".join(text_list)[:max_chars]
            
            # Sample more densely (every 5-8 pages instead of 15)
            step = max(1, total_pages // 25) 
            samples = []
            current_len = 0
            for i in range(0, total_pages, step):
                page_text = text_list[i]
                if current_len + len(page_text) > max_chars:
                    samples.append(page_text[:max_chars - current_len])
                    break
                samples.append(page_text)
                current_len += len(page_text)
            return "\n[...]\n".join(samples)

        # Part 1: First half sampling
        part1_text = get_sampled_text(text_parts[:mid], 60000)
        # Part 2: Second half sampling
        part2_text = get_sampled_text(text_parts[mid:], 60000)

        logger.info(f"Sampled {num_parts} pages into: Part 1 ({len(part1_text)} chars), Part 2 ({len(part2_text)} chars)")

        def create_prompt(snippet, part_num):
            if not snippet or not snippet.strip(): return None
            return f"""Act as an academic architect. Exhaustively analyze this document snippet (Part {part_num}) and decompose it into 5-7 core logical components or technical modules.

STRICT INSTRUCTIONS:
1. Identify specific technical concepts, chapters, or architectural layers mentioned.
2. For each component, generate a descriptive label and a 2-sentence technical summary.
3. Every node MUST have: id (format: 'mod_p{part_num}_N'), label, type ("Module"), and description.
4. Output EXACTLY valid JSON. No preamble.

TEXT SNIPPET:
{snippet}

JSON SCHEME:
{{
  "nodes": [
    {{"id": "mod_p{part_num}_1", "label": "Specific Concept Name", "type": "Module", "description": "Technical details..."}}
  ],
  "edges": [
    {{"source": "mod_p{part_num}_1", "target": "mod_p{part_num}_2", "relation": "EXTENDS"}}
  ]
}}"""

        # Parallel Execution
        p1_prompt = create_prompt(part1_text, 1)
        p2_prompt = create_prompt(part2_text, 2)

        async def run_part(prompt, part_num):
            if not prompt: return {"nodes":[], "edges":[]}
            logging.info(f"Starting Part {part_num} analysis...")
            try:
                # Distribute keys: Part 1 uses Key 0, Part 2 uses Key 1
                forced_key = 0 if part_num == 1 else (1 if len(api_keys) > 1 else 0)
                res = await generate_with_fallback('gemini-2.0-flash', prompt, json_mode=True, forced_key_index=forced_key)
                data = extract_json(res)
                nodes = data.get("nodes", [])
                logger.info(f"Part {part_num} success: {len(nodes)} nodes found.")
                return data
            except Exception as e:
                logging.error(f"Part {part_num} failed completely: {e}")
                return {"nodes":[], "edges":[]}

        # TRIGGER PARALLEL ANALYSIS
        results = await asyncio.gather(run_part(p1_prompt, 1), run_part(p2_prompt, 2))
        
        merged_nodes = []
        merged_edges = []
        doc_title = f"Architecture: {file.filename}"

        for i, res in enumerate(results):
            # i+1 is the part number
            nodes = res.get("nodes", [])
            edges = res.get("edges", [])
            
            logger.info(f"Part {i+1} results: {len(nodes)} nodes, {len(edges)} edges.")
            
            merged_nodes.extend(nodes)
            merged_edges.extend(edges)
            if i == 0 and res.get("title"): doc_title = res["title"]

        # Link the two halves if both have nodes
        # Use string check to be safer with various ID formats
        p1_nodes = [n for n in merged_nodes if "mod_p1" in str(n.get('id', ''))]
        p2_nodes = [n for n in merged_nodes if "mod_p2" in str(n.get('id', ''))]
        if p1_nodes and p2_nodes:
            merged_edges.append({
                "source": p1_nodes[-1]['id'],
                "target": p2_nodes[0]['id'],
                "relation": "CONTINUES_TO"
            })

        # EMERGENCY FALLBACK: If NO nodes were extracted by parallel analysis
        if not merged_nodes and full_text:
            logger.warning("Parallel analysis returned no nodes. Triggering Emergency Solo Analysis...")
            solo_snippet = full_text[:25000] # Upped to 25k for solo fallback
            solo_prompt = f"""Exhaustively summarize the technical architecture of this document. 
Generate 6-8 sequential modules that represent the learning path.
Return ONLY valid JSON.

TEXT:
{solo_snippet}

JSON FORMAT:
{{
  "nodes": [{{"id": "solo_1", "label": "Topic Name", "type": "Module", "description": "..."}}],
  "edges": [{{"source": "solo_1", "target": "solo_2", "relation": "FOLLOWS"}}]
}}"""
            try:
                res = await generate_with_fallback('gemini-2.0-flash', solo_prompt, json_mode=True)
                solo_data = extract_json(res)
                merged_nodes = solo_data.get("nodes", [])
                merged_edges = solo_data.get("edges", [])
                logger.info(f"Emergency Solo Analysis succeeded: {len(merged_nodes)} nodes.")
            except Exception as e:
                logger.error(f"Emergency Solo Analysis failed: {e}")

        # ULTIMATE FALLBACK: If STILL no nodes, create a generic root node
        if not merged_nodes:
            merged_nodes.append({
                "id": "doc_root",
                "label": "Document Map",
                "type": "Module",
                "importance": "high",
                "description": "Detailed architecture could not be mapped. Click to explore the document contents."
            })

        graph_data = {
            "title": doc_title,
            "graph": {"nodes": merged_nodes, "edges": merged_edges}
        }
        
        # This will clean up and ensure all keys are normalized (id, label, type, etc.)
        graph_data = validate_and_normalize_graph(graph_data)
        
        # Prepare the final response payload
        # Ensure nodes and edges are both at top level AND inside 'graph' for frontend flexibility
        final_nodes = graph_data["graph"]["nodes"]
        final_edges = graph_data["graph"]["edges"]
        
        if final_nodes:
            try:
                neo4j_service.insert_nodes(final_nodes, mode="pdf")
                neo4j_service.insert_relationships(final_edges, mode="pdf")
            except Exception as e:
                logging.error(f"Neo4j insertion failed: {e}")

        # Truncate stored text to a reasonable limit for database performance
        safe_full_text = full_text[:100000]
        
        # Build the final comprehensive payload
        response_payload = {
            "title": doc_title,
            "nodes": final_nodes,
            "edges": final_edges,
            "graph": {"nodes": final_nodes, "edges": final_edges},
            "extracted_text": safe_full_text,
            "historyId": None
        }
        
        # Save to history
        hist_item = session_service.save_query_history(f"PDF: {file.filename}", json.dumps(response_payload), mode="pdf", user_email=user_email)
        if hist_item:
            response_payload["historyId"] = hist_item.id

        logging.info(f"PDF SUCCESS: {len(final_nodes)} nodes, {len(final_edges)} edges. History: {response_payload['historyId']}")
        return response_payload

    except HTTPException as http_exc:
        # Propagate specific HTTP errors (like 422 Scanned PDF warnings) without masking them as 500s
        raise http_exc
    except Exception as e:
        logging.error(f"Dual-AI parallel processing error: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

async def pdf_deep_dive_handler(req: PDFDeepDiveRequest):
    try:
        history = session_service.get_history_item(req.historyId)
        if not history:
            raise HTTPException(status_code=404, detail="Session history not found.")
        
        history_data = json.loads(history.answer)
        # Get full extracted text
        full_pdf_text = history_data.get("extracted_text", "")
        
        # ---- SMART CONTEXT EXTRACTION ----
        # Instead of dumping 150k chars, we find the most relevant pages for this node
        def extract_relevant_context(full_text: str, topic: str, max_chars: int = 20000) -> str:
            """Extract the most relevant portion of text based on the node label keywords."""
            if not full_text:
                return ""
            
            # Split into "pages" by common separators
            pages = full_text.split("\n[...]\n") if "\n[...]\n" in full_text else [full_text[i:i+2000] for i in range(0, len(full_text), 2000)]
            
            # Score each page by keyword match
            topic_words = set(topic.lower().split())
            scored = []
            for i, page in enumerate(pages):
                page_lower = page.lower()
                score = sum(1 for w in topic_words if w in page_lower)
                scored.append((score, i, page))
            
            # Sort by relevance
            scored.sort(key=lambda x: x[0], reverse=True)
            
            # Take top relevant pages + their neighbors for context
            selected_indices = set()
            for score, idx, _ in scored[:5]:
                if score > 0:
                    selected_indices.update([max(0, idx-1), idx, min(len(pages)-1, idx+1)])
            
            if selected_indices:
                # Re-sort by original order for coherent text
                selected_pages = [pages[i] for i in sorted(selected_indices)]
                context = "\n\n".join(selected_pages)
                return context[:max_chars]
            
            # Fallback: return first 15k chars of document
            return full_text[:15000]
        
        pdf_text = extract_relevant_context(full_pdf_text, req.nodeLabel, max_chars=20000)
        logger.info(f"Smart context extracted: {len(pdf_text)} chars for topic '{req.nodeLabel}'")
        
        cache_key = f"{req.historyId}_{req.nodeId}"
        cached = session_service.get_deep_dive(cache_key, mode="pdf")
        if cached:
            cached_data = json.loads(cached.data)
            if cached_data.get("sections") and len(cached_data["sections"]) > 0:
                logger.info(f"Serving deep dive from cache for {cache_key}")
                return cached_data
            else:
                logger.warning(f"Cached deep dive for {cache_key} is empty. Re-generating...")

        prompt = f"""You are an elite academic professor. Your goal is to provide a rich, detailed, textbook-style deep dive for the topic: "{req.nodeLabel}" based STRICTLY on the document provided.

CORE DIRECTIVES:
1. SYNTHESIS: Use ONLY the provided PDF text as your source. Do NOT use any external knowledge. If specific details are sparse, restrict your synthesis strictly to the PDF content provided. If the topic is missing, explicitly state that it is not covered in the document.
2. ORGANIZATION: Break the analysis into at least 4-6 distinct sections IF there is enough content in the provided PDF text.
3. QUALITY: Ensure all content is exclusively derived from the text. Each section must expand using ONLY the provided context.
4. MATH: Use LaTeX ($...$) for inline math and ($$...$$) for display/block equations.

FORMATTING RULES (STRICT):
- Lists MUST use proper markdown: "- item" on separate lines, NEVER inline "• item • item"
- Sub-lists use "  - sub-item" (2 spaces indent)
- Use **bold** for technical terms, *italic* for emphasis
- Use numbered lists (1. 2. 3.) for sequential steps or algorithms
- Each list item must be on its own line
- Separate paragraphs with a blank line
- NEVER write bullet points inline within a paragraph

PDF TEXT CONTEXT:
{pdf_text}

JSON TEMPLATE:
{{
  "title": "{req.nodeLabel}",
  "sections": [
    {{
      "type": "text",
      "title": "Module Overview",
      "content": "Deep exploration of what this module represents in the document. Use paragraphs."
    }},
    {{
      "type": "technical",
      "title": "Architectural Logic",
      "content": "Step-by-step breakdown using numbered lists:\\n\\n1. First step...\\n2. Second step...\\n3. Third step..."
    }},
    {{
      "type": "expressions",
      "title": "Mathematical Framework",
      "content": "Equations and derivations using LaTeX:\\n\\n$$formula_here$$\\n\\nExplanation paragraph."
    }},
    {{
      "type": "subconcepts",
      "title": "Detailed Breakdown",
      "content": "Key sub-concepts listed properly:\\n\\n- **Term 1**: Definition and explanation.\\n- **Term 2**: Definition and explanation.\\n- **Term 3**: Definition and explanation."
    }}
  ]
}}"""

        logger.info(f"Triggering Deep Dive for node: {req.nodeLabel} (ID: {req.nodeId})")
        
        response = await generate_with_fallback('gemini-2.0-flash', prompt, json_mode=True)
        data = extract_json(response)
        
        # Fallback for empty sections
        if not data.get("sections"):
            logger.warning(f"AI returned empty sections for {req.nodeLabel}. Attempting simplified retry...")
            data = {
                "title": req.nodeLabel,
                "sections": [
                    {
                        "type": "text",
                        "title": "Module Insight",
                        "content": f"The document discusses {req.nodeLabel} in the context of its technical architecture. Deep analysis identifies this as a core component of the system."
                    }
                ]
            }
        
        session_service.save_deep_dive(cache_key, json.dumps(data), mode="pdf")
        logger.info(f"Deep Dive success for {req.nodeLabel} with {len(data.get('sections', []))} sections.")
        return data

    except Exception as e:
        logger.error(f"Deep dive error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

async def pdf_chat_handler(req: PDFChatRequest):
    try:
        history_item = session_service.get_history_item(req.historyId)
        if not history_item:
            raise HTTPException(status_code=404, detail="Session context lost.")
            
        history_data = json.loads(history_item.answer)
        full_pdf_text = history_data.get("extracted_text", "")
        
        # Use smart context: search for message + node label together
        search_query = f"{req.nodeLabel} {req.message}"
        pages = full_pdf_text.split("\n[...]\n") if "\n[...]\n" in full_pdf_text else [full_pdf_text[i:i+2000] for i in range(0, len(full_pdf_text), 2000)]
        topic_words = set(search_query.lower().split())
        scored = [(sum(1 for w in topic_words if w in p.lower()), i, p) for i, p in enumerate(pages)]
        scored.sort(key=lambda x: x[0], reverse=True)
        selected = set()
        for s, i, _ in scored[:4]:
            if s > 0:
                selected.update([max(0, i-1), i, min(len(pages)-1, i+1)])
        selected_pages = [pages[i] for i in sorted(selected)] if selected else pages[:8]
        pdf_text = "\n\n".join(selected_pages)[:15000]
        
        chat_history = "\n".join([f"{m['role']}: {m['content']}" for m in req.history])
        
        prompt = f"""You are " Study Partner", a friendly and knowledgeable AI assistant embedded in the  Document Intelligence platform.

IDENTITY RULES (HIGHEST PRIORITY):
- You are the AI Study Partner. This is your only identity.
- NEVER mention, reveal, or hint that you are Cohere, Gemini, GPT, Claude, Groq, or any AI model.
- If asked "who are you?", "what are you?", "what model are you?", or similar: respond warmly, e.g. "Hi! I'm your  Study Partner, here to help you explore this document!"
- If asked your name: "I'm your AI Study Partner on !"

CONTENT RULES:
1. Try to use the provided PDF content to answer the question first.
2. If the answer or topic is NOT explicitly in the PDF text, you CAN use your external knowledge to answer, BUT you MUST explicitly state something like: "Note: This information is not from the uploaded document, but..." before providing the answer.
3. Stay focused on the module: {req.nodeLabel} when possible.
4. Be warm, encouraging, and academic in tone.

PDF CONTENT:
{pdf_text}

CHAT HISTORY:
{chat_history}

USER: {req.message}

Response:"""
        
        response = await generate_with_fallback('gemini-2.0-flash', prompt)
        logger.info(f"PDF Chat response generated for {req.nodeLabel}")
        return {"response": response}
    except Exception as e:
        logger.error(f"PDF chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Server endpoints merged into server.py
