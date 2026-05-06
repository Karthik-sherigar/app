from fastapi import HTTPException, Request
import logging
import asyncio
import json
from shared import (
    QueryRequest, ExpandNodeRequest, ExplainRequest, AskNodeRequest, DeepDiveRequest,
    neo4j_service, session_service,
    _generate_with_gemini_internal, generate_with_fallback, generate_with_groq, generate_with_cohere,
    api_keys, extract_json, validate_and_normalize_graph
)

async def query_generate_graph(request: QueryRequest):
    if request.mode != "query":
        raise HTTPException(status_code=400, detail="Invalid mode for query server")
    
    try:
        combined_prompt = f"""Construct a hierarchical "Knowledge Tree" and artistic "Visual Palette" for: "{request.query}"

Generate a structured JSON response containing:
1. "answer": A 2-3 paragraph pedagogical narration explaining the concepts and their connections.
2. "sections": {{"overview": "2- sentence intro", "concepts": [...], "dependencies": [...], "summary": "1-paragraph wrap-up"}}
3. "graph": {{"nodes": [...], "edges": [...]}}
4. "visual_prompts": A list of 8-10 unique, artistic keywords (e.g., "cybernetic neurons", "neon circuits") representing this field for background aesthetics.

STRICT GRAPH REQUIREMENTS:
- Root node (depth 0) branches into 2-4 sub-nodes (depth 1).
- Total nodes: 8-12 (Keep it concise and fast).
- Strict tree structure (one parent per node).
- Use short, concept-based string IDs.

Return ONLY valid JSON.
"""
        
        async def get_combined_response():
            # Priority: Groq -> Gemini -> Cohere
            last_error = None
            
            # 1. Groq
            try:
                resp = await generate_with_groq(combined_prompt, json_mode=True)
                if resp: return resp
            except Exception as e:
                logging.warning(f"Groq combined generation failed: {e}")
                last_error = e

            # 2. Gemini
            try:
                return await _generate_with_gemini_internal('gemini-2.0-flash', combined_prompt, forced_key_index=0)
            except Exception as e:
                logging.warning(f"Gemini combined generation failed: {e}")
                last_error = e

            # 3. Cohere
            try:
                resp = await generate_with_cohere(combined_prompt)
                if resp: return resp
            except Exception as e:
                logging.warning(f"Cohere combined generation failed: {e}")
                last_error = e
            
            raise HTTPException(status_code=503, detail=f"AI generation failed: {str(last_error)}")

        raw_response = await get_combined_response()
        result = extract_json(raw_response)
        
        # Validate and insert into Neo4j
        result = validate_and_normalize_graph(result)
        
        if "nodes" in result.get("graph", {}):
             neo4j_service.insert_nodes(result["graph"]["nodes"], mode=request.mode)
        if "edges" in result.get("graph", {}):
             neo4j_service.insert_relationships(result["graph"]["edges"], mode=request.mode)

        if not request.is_temporary:
             history_item = session_service.save_query_history(request.query, json.dumps(result), mode=request.mode, user_email=request.user_email)
             if history_item:
                  result["historyId"] = history_item.id
        else:
             result["historyId"] = None
        
        return result

    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Graph generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def query_expand_node(request: ExpandNodeRequest):
    try:
        prompt = f"""Expand the knowledge graph around the node: "{request.node_label}"
STRICT REQUIREMENT: Create EXACTLY 2 new related sub-nodes for this specific topic.
PROHIBITED: Do NOT create more than 2 sub-nodes.
Return ONLY valid JSON with "nodes" and "edges" lists. Ensure the branching is strictly limited to 2 subnodes for a clean vertical tree growth."""
        
        # Expansion Priority: Groq -> Gemini -> Cohere
        response_text = None
        last_error = None
        
        try:
            response_text = await generate_with_groq(prompt, json_mode=True)
        except Exception as e:
            last_error = e
        
        if not response_text:
            try:
                response_text = await _generate_with_gemini_internal('gemini-2.0-flash', prompt)
            except Exception as e:
                last_error = e
        
        if not response_text:
             try:
                 response_text = await generate_with_cohere(prompt)
             except Exception as e:
                 last_error = e
                 
        if not response_text:
            raise HTTPException(status_code=503, detail=f"Expansion failed. All AI providers unavailable. Last error: {str(last_error)}")

        result = extract_json(response_text)
        if "nodes" in result:
            for n in result["nodes"]: n["id"] = str(n.get("id"))
            neo4j_service.insert_nodes(result["nodes"], mode=request.mode)
        if "edges" in result:
            for e in result["edges"]: 
                e["source"] = str(e.get("source"))
                e["target"] = str(e.get("target"))
            neo4j_service.insert_relationships(result["edges"], mode=request.mode)
        return result
    except Exception as e:
        logging.error(f"Node expansion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def query_explain_confusion(request: ExplainRequest):
    try:
        prompt = f"""Explain "{request.topic}" in a simple, clear way.
{"Focus on: " + request.confusion if request.confusion else ""}
Provide: Simple explanation, Analogy, Steps.
Format as JSON."""
        # Use Groq first for explanations
        response_text = None
        try:
             response_text = await generate_with_groq(prompt, json_mode=True)
        except:
             pass
        
        if not response_text:
             response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
             
        return extract_json(response_text)
    except Exception as e:
        logging.error(f"Explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def query_explain_node(request: Request):
    try:
        body = await request.json()
        node_id = body.get("nodeId", "")
        node_label = body.get("nodeLabel", "") or body.get("nodeName", "")
        context = body.get("context", "")
        wiki_slug = node_label.replace(' ', '_')
        google_img_base = f"https://www.google.com/search?tbm=isch&q={node_label.replace(' ', '+')}"

        # Native helper to scrape real YouTube video IDs dynamically to avoid LLM hallucination
        def get_real_youtube_embeds(query, max_results=5):
            import urllib.request, urllib.parse, re, json
            videos = []
            try:
                search_query = urllib.parse.quote(query + " tutorial explained")
                html = urllib.request.urlopen(f"https://www.youtube.com/results?search_query={search_query}", timeout=4).read().decode()
                video_ids = re.findall(r"watch\?v=(\S{11})", html)
                
                # Deduplicate while preserving order
                seen = set()
                unique_ids = []
                for vid in video_ids:
                    if vid not in seen:
                        seen.add(vid)
                        unique_ids.append(vid)
                        if len(unique_ids) >= max_results:
                            break
                            
                for i, vid_id in enumerate(unique_ids):
                    videos.append({
                        "title": f"Educational Video {i+1} on {query}",
                        "embedUrl": f"https://www.youtube.com/watch?v={vid_id}",
                        "description": f"A comprehensive YouTube tutorial and conceptual dive regarding {query}."
                    })
            except Exception as e:
                logging.warning(f"YouTube scrape failed: {e}")
            
            return videos

        # Define the prompt strictly for the text responses to minimize token generation
        prompt = f"""You are an expert educator. Generate a comprehensive, structured explanation for the concept: "{node_label}"
Context: {context}

Return ONLY valid JSON in this EXACT format (no markdown, no extra text):
{{
  "title": "{node_label}",
  "textResponse": {{
    "overview": "A clear, engaging 2-3 sentence overview of what {node_label} is and why it matters.",
    "sections": [
      {{
        "heading": "What is {node_label}?",
        "content": "A detailed paragraph (4-6 sentences) explaining the fundamental definition, origin, and core idea.",
        "bullets": []
      }},
      {{
        "heading": "How It Works",
        "content": "A detailed paragraph explaining the core mechanism, process, or architecture.",
        "bullets": [
          "Key mechanism or step 1 with brief explanation",
          "Key mechanism or step 2 with brief explanation"
        ]
      }},
      {{
        "heading": "Real-World Applications",
        "content": "A paragraph describing where and how this concept is applied in practice.",
        "bullets": [
          "Application 1: specific real-world use case",
          "Application 2: specific real-world use case"
        ]
      }},
      {{
        "heading": "Key Takeaways",
        "content": "",
        "bullets": [
          "Most important insight about {node_label}",
          "Critical concept or principle to remember"
        ]
      }}
    ]
  }}
}}"""

        explanation = None
        last_error = None
        
        async def fetch_llm():
            # Priority 1: Groq (Blazing Fast API)
            try:
                return await generate_with_groq(prompt, json_mode=True)
            except Exception as e:
                logging.warning(f"Groq explain failed: {e}")
                
            # Priority 2: Gemini
            try:
                return await _generate_with_gemini_internal("gemini-2.0-flash", prompt)
            except Exception as e:
                logging.warning(f"Gemini explain failed: {e}")
                
            # Priority 3: Cohere
            try:
                return await generate_with_cohere(prompt)
            except Exception as e:
                logging.warning(f"Cohere explain failed: {e}")
                raise Exception("Explanation generation failed. All AI services unavailable.")

        import asyncio
        async def fetch_videos():
            return await asyncio.to_thread(get_real_youtube_embeds, node_label)
            
        # Run LLM generation and YouTube scrape concurrently
        explanation_result, videos_result = await asyncio.gather(fetch_llm(), fetch_videos(), return_exceptions=True)

        if isinstance(explanation_result, Exception):
             raise HTTPException(status_code=503, detail=str(explanation_result))
             
        explanation = explanation_result

        result = extract_json(explanation)
        
        # Inject the static pre-calculated data structures automatically to bypass LLM generation time
        result["externalLinks"] = [
            {
                "title": f"Wikipedia — {node_label}",
                "url": f"https://en.wikipedia.org/wiki/{wiki_slug}",
                "description": f"The comprehensive Wikipedia article covering the history, theory, and detailed technical aspects of {node_label}. A great starting point for deep research."
            },
            {
                "title": f"Relevant tutorial or course",
                "url": f"https://www.coursera.org/search?query={node_label.replace(' ', '+')}",
                "description": f"Online courses and structured learning paths covering {node_label} from beginner to advanced level, with hands-on projects and certificates."
            },
            {
                "title": f"Research papers and academic resources",
                "url": f"https://scholar.google.com/scholar?q={node_label.replace(' ', '+')}",
                "description": f"Academic papers, research articles, and scholarly publications on {node_label}. Ideal for understanding the scientific and theoretical foundations."
            },
            {
                "title": f"Official documentation or authoritative source",
                "url": f"https://www.google.com/search?q={node_label.replace(' ', '+')}+official+documentation",
                "description": f"Official documentation, specifications, or authoritative reference material for {node_label}. Best for technical accuracy and implementation details."
            }
        ]
        
        result["images"] = [
            {
                "title": f"{node_label} — Architecture Diagram",
                "googleSearchUrl": f"{google_img_base}+architecture+diagram",
                "description": f"Visual diagrams showing the structural architecture and component relationships of {node_label}."
            },
            {
                "title": f"{node_label} — Infographic Overview",
                "googleSearchUrl": f"{google_img_base}+infographic+explained",
                "description": f"Infographics and visual summaries that explain {node_label} concepts in an easy-to-understand visual format."
            },
            {
                "title": f"{node_label} — Real-World Examples",
                "googleSearchUrl": f"{google_img_base}+real+world+example",
                "description": f"Photographs and illustrations showing {node_label} in real-world contexts and practical applications."
            },
            {
                "title": f"{node_label} — Step-by-Step Process",
                "googleSearchUrl": f"{google_img_base}+step+by+step+process+flowchart",
                "description": f"Flowcharts and step-by-step visual guides illustrating how {node_label} works as a process or workflow."
            }
        ]
        
        # Assign correctly fetched videos payload
        result["videos"] = videos_result if not isinstance(videos_result, Exception) else []

        logging.info(f"Extracted JSON keys: {list(result.keys())}")
        return result
    except HTTPException as e:
        logging.error(f"HTTP Exception in explain_node: {e.detail}")
        raise e
    except Exception as e:
        logging.error(f"Node explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def query_ask_node(request: AskNodeRequest):
    try:
        prompt = f"""
        You are an elite academic professor and expert on the concept: "{request.nodeLabel}".
        Context provided: {request.context}

        User Question: {request.question}

        Provide a highly formal, comprehensively structured answer based on the context and your knowledge of {request.nodeLabel}. 
        CRITICAL RULES:
        1. You MUST use Markdown formatting entirely.
        2. Use clear paragraph separations, bold text for key terms, and bulleted lists where applicable.
        3. Do not branch into unrelated topics. Keep a serious, pedagogical tone.
        """
        
        answer = None
        # Priority 1: Groq
        # Priority 1: Groq
        try:
             answer = await generate_with_groq(prompt, json_mode=False)
        except Exception as e:
            logging.warning(f"Groq Ask failed: {e}")
        
        # Priority 2: Gemini (Fallback)
        if not answer:
             try:
                 answer = await _generate_with_gemini_internal("gemini-1.5-flash", prompt)
             except Exception as e:
                 logging.warning(f"Gemini Ask failed: {e}")
        
        # Priority 3: Cohere (Last resort)
        if not answer:
             try:
                 answer = await generate_with_cohere(prompt)
             except Exception as e:
                 logging.warning(f"Cohere Ask failed: {e}")

        if not answer:
            raise HTTPException(status_code=500, detail="Failed to generate answer. All AI providers unavailable.")

        try:
            # Attempt to parse as JSON if it looks like it
            if answer.strip().startswith("{"):
                parsed = json.loads(answer)
                if "answer" in parsed: answer = parsed["answer"]
                elif "response" in parsed: answer = parsed["response"]
                elif "content" in parsed: answer = parsed["content"]
        except:
            pass # Use raw text
            
        return {"answer": answer}

    except Exception as e:
        logging.error(f"Ask node error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def query_deep_dive(request: DeepDiveRequest):
    try:
        prompt = f"""You are a university-level educational content generator writing a DEFINITIVE TEXTBOOK on the subject: "{request.nodeLabel}".
{f"CRITICAL DOMAIN CONTEXT: This concept must be explained strictly within the domain of: {request.context}" if request.context else ""}

FIELD 1: CATEGORY - Pick one: COMP_SCI, SCIENCE, MEDICAL, HUMANITIES, GENERAL.

FIELD 2: OVERVIEW - 250-400 words. Formal academic prose. Cover definition, principles, and real-world relevance.

FIELD 3: MODULE CONTENT (dynamicModules)
- steps/derivation: Numbered items, technical paragraphs (30-50 words per step).
- concept: 3-5 separated concept blocks.

OUTPUT FORMAT: Return ONLY a valid JSON object.
{{
  "title": "{request.nodeLabel}",
  "category": "COMP_SCI",
  "overview": "A concise 200-300 word academic explanation of {request.nodeLabel}. Focus on clarity and core principles in a formal textbook style.",
  "imagePrompt": "A professional 2D diagram of {request.nodeLabel} with bold black outlines on a white background. Technical schematic style.",
  "conceptGraph": [{{ "label": "Foundational Concept", "relation": "supports" }}],
  "dynamicModules": [
    {{ "type": "derivation", "title": "Core Mechanism", "content": "1. First step explained clearly.\\n2. Second critical step with technical detail." }}
  ],
  "aiTutorContext": "Brief educational context for the AI tutor.",
  "knowledgeChallenge": [{{ "question": "What is the primary function of {request.nodeLabel}?", "options": ["Option A", "Option B", "Option C", "Option D"], "answerIndex": 0 }}],
  "proactivePaths": ["Related Topic A", "Related Topic B"],
  "quickTips": ["Did you know that {request.nodeLabel} is crucial for...", "Always remember that..."]
}}"""

        def is_placeholder(data):
            placeholders = ["Next topic 1", "Next topic 2", "Introduction paragraph here", "A test question?", "Step one", "PICKED_CATEGORY"]
            for p in placeholders:
                if p in str(data): return True
            if len(data.get('overview', '')) < 50: return True
            return False

        async def get_response():
            res_text = None
            try:
                res_text = await generate_with_groq(prompt, json_mode=True)
            except Exception as e:
                logging.warning(f"Groq deep_dive failed: {e}")
            if not res_text:
                res_text = await generate_with_fallback('gemini-2.0-flash', prompt, json_mode=True)
            return extract_json(res_text)

        result = await get_response()
        
        if is_placeholder(result):
            logging.info("Placeholder data detected, retrying deep_dive...")
            result = await get_response()
        
        def to_str(val):
            if val is None: return ''
            if isinstance(val, str):
                stripped = val.strip()
                if (stripped.startswith('{') and stripped.endswith('}')) or (stripped.startswith('[') and stripped.endswith(']')):
                    try:
                        parsed = json.loads(stripped)
                        return to_str(parsed)
                    except: pass
                return val
            if isinstance(val, list):
                parts = []
                for item in val:
                    if isinstance(item, dict): parts.append('\n'.join(f"{k}: {v}" for k, v in item.items()))
                    else: parts.append(str(item))
                return '\n'.join(parts)
            if isinstance(val, dict): return '\n\n'.join(f"{k}\n{v}" for k, v in val.items())
            return str(val)

        result['overview'] = to_str(result.get('overview', ''))
        result['imagePrompt'] = to_str(result.get('imagePrompt', ''))
        result['aiTutorContext'] = to_str(result.get('aiTutorContext', ''))

        return result
    except Exception as e:
        logging.error(f"Deep dive error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Server endpoints merged into server.py
