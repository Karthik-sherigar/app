from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
import json
from shared import (
    QueryRequest, ExpandNodeRequest, ExplainRequest, AskNodeRequest, DeepDiveRequest,
    neo4j_service, session_service,
    _generate_with_gemini_internal, generate_with_fallback, generate_with_groq, generate_with_cohere,
    api_keys, extract_json, validate_and_normalize_graph
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/generate-graph")
async def generate_graph(request: QueryRequest):
    if request.mode != "query":
        raise HTTPException(status_code=400, detail="Invalid mode for query server")
    
    try:
        graph_prompt = f"""Construct a hierarchical "Knowledge Tree" for the topic: "{request.query}"
Generate a structured JSON response with:
1. A detailed textual explanation
2. A HIERARCHICAL TREE of 12-15 nodes organized in multiple vertical levels
3. Distinct relations (Edges) connecting parent nodes to EXACTLY TWO child nodes (Strict Binary Branching)

CRITICAL STRUCTURE REQUIREMENTS:
- Level 0: 1 root node (main concept)
- Level 1-2: Branch each parent into exactly 2 sub-nodes.
- Total Nodes: ~8-10 nodes (Keep it concise and fast).
- Format: Use short, concept-based string IDs.
- Return ONLY the JSON object. No markdown.

Return ONLY valid JSON in this exact format:
{{
  "answer": "A comprehensive explanatory narration of the entire generated graph, explicitly detailing how each node connects to the others and the nature of their relationships.",
  "sections": {{
    "overview": "Brief 2-3 sentence overview of the subject.",
    "concepts": [
      {{"id": "1", "name": "Main Concept", "explanation": "Detailed explanation"}}
    ],
    "dependencies": [
      {{"from": "Main Concept", "to": "Related Concept", "relation": "depends_on"}}
    ],
    "summary": "A concise 2-3 paragraph summary of the detailed overview, capturing the essence of the graph's structure and concepts."
  }},
  "graph": {{
    "nodes": [
      {{"id": "main_concept_slug", "label": "Main Concept", "type": "Concept", "description": "Brief description", "importance": "high", "depth": 0}},
      {{"id": "subtopic_1_slug", "label": "Subtopic 1", "type": "Component", "description": "First major area", "importance": "high", "depth": 1}},
      {{"id": "subtopic_2_slug", "label": "Subtopic 2", "type": "Component", "description": "Second major area", "importance": "high", "depth": 1}},
      {{"id": "detail_1_1_slug", "label": "Detail 1.1", "type": "Prerequisite", "description": "Specific detail", "importance": "medium", "depth": 2}},
      {{"id": "detail_1_2_slug", "label": "Detail 1.2", "type": "Prerequisite", "description": "Another detail", "importance": "medium", "depth": 2}}
    ],
    "edges": [
      {{"source": "main_concept_slug", "target": "subtopic_1_slug", "relation": "HAS_COMPONENT"}},
      {{"source": "main_concept_slug", "target": "subtopic_2_slug", "relation": "HAS_COMPONENT"}},
      {{"source": "subtopic_1_slug", "target": "detail_1_1_slug", "relation": "INCLUDES"}},
      {{"source": "subtopic_1_slug", "target": "detail_1_2_slug", "relation": "INCLUDES"}}
    ]
  }}
}}
Types: Concept, Prerequisite, Application, Component
CRITICAL: Use UNIQUE, concept-based string IDs (e.g., "neural_networks_intro") instead of simple integers like "1" or "2". 
CRITICAL: Create a TREE structure, NOT a linear chain. Return ONLY valid JSON."""
        visual_prompt = f"""Generate a high-quality visual palette for a journey about: "{request.query}"
Provide a list of 10 unique, artistic keywords representing concepts in this field.
Return ONLY JSON: {{"visual_prompts": ["cybernetic neural network", "glowing neon circuits", ...]}}"""

        async def run_parallel():
            async def get_graph():
                # Graph Priority: Groq -> Gemini -> Cohere
                last_error = None
                
                # 1. Groq
                try:
                    resp = await generate_with_groq(graph_prompt, json_mode=True)
                    if resp: return resp
                except Exception as e:
                    logging.warning(f"Groq graph generation failed: {e}")
                    last_error = e

                # 2. Gemini
                try:
                    return await _generate_with_gemini_internal('gemini-2.0-flash', graph_prompt, forced_key_index=0)
                except Exception as e:
                    logging.warning(f"Gemini graph generation failed: {e}")
                    last_error = e

                # 3. Cohere
                try:
                    resp = await generate_with_cohere(graph_prompt)
                    if resp: return resp
                except Exception as e:
                    logging.warning(f"Cohere graph generation failed: {e}")
                    last_error = e
                
                # All failed
                raise HTTPException(status_code=503, detail=f"Failed to generate graph. All AI providers failed. Last error: {str(last_error)}")
            
            async def get_visuals():
                # Visuals can default to Gemini as it's good for lists
                key_index = 1 if len(api_keys) > 1 else 0
                try:
                    return await _generate_with_gemini_internal('gemini-2.0-flash', visual_prompt, forced_key_index=key_index)
                except:
                   # Fallback visuals
                   return '{"visual_prompts": []}'

            return await asyncio.gather(get_graph(), get_visuals())

        raw_response, visuals_response = await run_parallel()
        
        # ... processing logic remains same ...
        result = extract_json(raw_response)
        
        # Merge visuals
        try:
             vis_data = extract_json(visuals_response)
             if "visual_prompts" in vis_data:
                 result["visual_prompts"] = vis_data["visual_prompts"]
        except:
             pass

        # Validate and insert into Neo4j
        result = validate_and_normalize_graph(result)
        
        if "nodes" in result["graph"]:
             neo4j_service.insert_nodes(result["graph"]["nodes"], mode=request.mode)
        if "edges" in result["graph"]:
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

@app.post("/api/expand-node")
async def expand_node(request: ExpandNodeRequest):
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

@app.post("/api/explain-confusion")
async def explain_confusion(request: ExplainRequest):
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

@app.post("/api/explain-node")
async def explain_node(request: Request):
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
            
            return json.dumps(videos, indent=4)

        videos_json_str = get_real_youtube_embeds(node_label)

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
          "Key mechanism or step 2 with brief explanation",
          "Key mechanism or step 3 with brief explanation"
        ]
      }},
      {{
        "heading": "Real-World Applications",
        "content": "A paragraph describing where and how this concept is applied in practice.",
        "bullets": [
          "Application 1: specific real-world use case",
          "Application 2: specific real-world use case",
          "Application 3: specific real-world use case"
        ]
      }},
      {{
        "heading": "Key Takeaways",
        "content": "",
        "bullets": [
          "Most important insight about {node_label}",
          "Critical concept or principle to remember",
          "Common misconception clarified",
          "Future direction or emerging trend",
          "Practical tip for understanding or applying this concept"
        ]
      }}
    ]
  }},
  "externalLinks": [
    {{
      "title": "Wikipedia — {node_label}",
      "url": "https://en.wikipedia.org/wiki/{wiki_slug}",
      "description": "The comprehensive Wikipedia article covering the history, theory, and detailed technical aspects of {node_label}. A great starting point for deep research."
    }},
    {{
      "title": "Relevant tutorial or course (provide a real URL)",
      "url": "https://www.coursera.org/search?query={node_label.replace(' ', '+')}",
      "description": "Online courses and structured learning paths covering {node_label} from beginner to advanced level, with hands-on projects and certificates."
    }},
    {{
      "title": "Research papers and academic resources",
      "url": "https://scholar.google.com/scholar?q={node_label.replace(' ', '+')}",
      "description": "Academic papers, research articles, and scholarly publications on {node_label}. Ideal for understanding the scientific and theoretical foundations."
    }},
    {{
      "title": "Official documentation or authoritative source (provide a real URL if known)",
      "url": "https://www.google.com/search?q={node_label.replace(' ', '+')}+official+documentation",
      "description": "Official documentation, specifications, or authoritative reference material for {node_label}. Best for technical accuracy and implementation details."
    }}
  ],
  "images": [
    {{
      "title": "{node_label} — Architecture Diagram",
      "googleSearchUrl": "{google_img_base}+architecture+diagram",
      "description": "Visual diagrams showing the structural architecture and component relationships of {node_label}. Helpful for understanding how the parts fit together."
    }},
    {{
      "title": "{node_label} — Infographic Overview",
      "googleSearchUrl": "{google_img_base}+infographic+explained",
      "description": "Infographics and visual summaries that explain {node_label} concepts in an easy-to-understand visual format. Great for quick comprehension."
    }},
    {{
      "title": "{node_label} — Real-World Examples",
      "googleSearchUrl": "{google_img_base}+real+world+example",
      "description": "Photographs and illustrations showing {node_label} in real-world contexts and practical applications."
    }},
    {{
      "title": "{node_label} — Step-by-Step Process",
      "googleSearchUrl": "{google_img_base}+step+by+step+process+flowchart",
      "description": "Flowcharts and step-by-step visual guides illustrating how {node_label} works as a process or workflow."
    }}
  ],
  "videos": {videos_json_str}
}}"""

        explanation = None
        last_error = None

        # Priority 1: Groq (Blazing Fast API)
        try:
            explanation = await generate_with_groq(prompt, json_mode=True)
        except Exception as e:
            logging.warning(f"Groq explain failed: {e}")
            last_error = e

        # Priority 2: Gemini
        if not explanation:
            try:
                explanation = await _generate_with_gemini_internal("gemini-2.0-flash", prompt)
            except Exception as e:
                 logging.warning(f"Gemini explain failed: {e}")
                 last_error = e

        # Priority 3: Cohere
        if not explanation:
            try:
                explanation = await generate_with_cohere(prompt)
            except Exception as e:
                logging.warning(f"Cohere explain failed: {e}")
                last_error = e

        if not explanation:
             raise HTTPException(status_code=503, detail=f"Explanation generation failed. All AI services unavailable. Last error: {str(last_error)}")

        result = extract_json(explanation)
        
        # Filter Videos
        if "videos" in result:
            result["videos"] = [
                v for v in result["videos"] 
                if "embedUrl" in v and "???" not in v["embedUrl"] and "REPLACE" not in v["embedUrl"]
            ]

        logging.info(f"Extracted JSON keys: {list(result.keys())}")
        return result
    except HTTPException as e:
        logging.error(f"HTTP Exception in explain_node: {e.detail}")
        raise e
    except Exception as e:
        logging.error(f"Node explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ask-node")
async def ask_node(request: AskNodeRequest):
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

@app.post("/api/deep-dive")
async def deep_dive(request: DeepDiveRequest):
    try:
        prompt = f"""You are a master professor writing a DEFINITIVE TEXTBOOK on the subject: "{request.nodeLabel}".
{f"CRITICAL DOMAIN CONTEXT: This concept must be explained strictly within the domain of: {request.context}" if request.context else ""}

STRICT RULES (MUST FOLLOW EXACTLY):
1. CATEGORY: Analyze the topic and context. Pick the MOST RELEVANT category from: COMP_SCI, SCIENCE, HUMANITIES, MEDICAL, or GENERAL. (e.g., World War 2 must be HUMANITIES, Biology must be SCIENCE).
2. OVERVIEW: Must be a highly detailed, textbook-level explanation of the topic (at least 600-800 words). Break it down thoroughly. Use multiple paragraphs separated by \\n\\n.
3. MODULE CONTENT: For 'steps' or 'derivation' types, write EACH step as a NUMBERED item on its OWN LINE using \\n. EACH step must contain an exhaustive, highly detailed paragraph of information (at least 150 words per step). Do NOT just output short sentences, it must feel like reading an encyclopedic textbook.
4. imagePrompt: A single descriptive sentence for an academic scientific, technological, or historical diagram. Keep it concept-art focused and tell the prompt to strictly avoid generating text/words inside the image.
5. ALL values must be plain strings. Zero nested JSON objects as field values.

Return ONLY this valid JSON:
{{
  "title": "{request.nodeLabel}",
  "category": "PICKED_CATEGORY",
  "overview": "Introduction paragraph here.\\n\\nSection Title\\nDetailed explanation...\\n\\nSignificance\\nWhy this matters...",
  "imagePrompt": "A detailed academic diagram for {request.nodeLabel}.",
  "conceptGraph": [{{ "label": "Related Concept", "relation": "relationship type" }}],
  "dynamicModules": [
    {{ "type": "derivation", "title": "Inner Workings / Timeline", "content": "1. Step one\\n2. Step two" }},
    {{ "type": "list", "title": "Key Factors / Applications", "content": "1. Item one\\n2. Item two" }}
  ],
  "aiTutorContext": "Background info for AI expert...",
  "knowledgeChallenge": [{{ "question": "A test question?", "options": ["Option A", "Option B", "Option C", "Option D"], "answerIndex": 0 }}],
  "proactivePaths": ["Next topic 1", "Next topic 2"],
  "quickTips": ["Insight 1", "Insight 2"]
}}
"""
        response_text = await generate_with_fallback('gemini-2.0-flash', prompt, json_mode=True)
        result = extract_json(response_text)
        
        # Normalize: ensure all fields are plain strings so frontend never crashes
        def to_str(val):
            if val is None:
                return ''
            if isinstance(val, str):
                # If the string itself looks like a JSON object, try to flatten it
                stripped = val.strip()
                if (stripped.startswith('{') and stripped.endswith('}')) or \
                   (stripped.startswith('[') and stripped.endswith(']')):
                    try:
                        parsed = json.loads(stripped)
                        return to_str(parsed)
                    except Exception:
                        pass
                return val
            if isinstance(val, list):
                parts = []
                for i, item in enumerate(val, 1):
                    if isinstance(item, dict):
                        parts.append('\n'.join(f"{k}: {v}" for k, v in item.items()))
                    else:
                        parts.append(str(item))
                return '\n'.join(parts)
            if isinstance(val, dict):
                return '\n\n'.join(f"{k}\n{v}" for k, v in val.items())
            return str(val)

        result['overview'] = to_str(result.get('overview', ''))
        result['imagePrompt'] = to_str(result.get('imagePrompt', ''))
        result['aiTutorContext'] = to_str(result.get('aiTutorContext', ''))

        for mod in result.get('dynamicModules', []):
            mod['content'] = to_str(mod.get('content', ''))

        return result
    except Exception as e:
        logging.error(f"Deep dive error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "query-server"}

@app.get("/")
async def root():
    return {"message": "Query Server Active"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
