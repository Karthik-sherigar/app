from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
import json
from shared import (
    QueryRequest, ExpandNodeRequest, ExplainRequest, 
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
2. A HIERARCHICAL TREE of 10-15 nodes organized in levels with BRANCHING relationships
3. Distinct relations (Edges) connecting parent nodes to MULTIPLE child nodes

CRITICAL STRUCTURE REQUIREMENTS:
- Level 0: 1 root node (main concept)
- Level 1: 2-3 child nodes (major subtopics)
- Level 2: 2-3 children PER level-1 node (detailed concepts)
- Level 3+: Additional depth as needed
- Each non-leaf node should have 2-3 children to create a BRANCHING TREE

Return ONLY valid JSON in this exact format:
{{
  "answer": "A comprehensive 3-4 paragraph explanation of {request.query}...",
  "sections": {{
    "overview": "Brief 2-3 sentence overview",
    "concepts": [
      {{"id": "1", "name": "Main Concept", "explanation": "Detailed explanation"}}
    ],
    "dependencies": [
      {{"from": "Main Concept", "to": "Related Concept", "relation": "depends_on"}}
    ],
    "summary": "Key takeaways"
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
Focus on creating a HIERARCHICAL TREE with BRANCHING (each parent has 2-3 children). 
CRITICAL: Use UNIQUE, concept-based string IDs (e.g., "neural_networks_intro") instead of simple integers like "1" or "2". 
CRITICAL: Create a TREE structure, NOT a linear chain. Each node should have multiple children. Return ONLY valid JSON."""

        visual_prompt = f"""Generate a high-quality visual palette for a journey about: "{request.query}"
Provide a list of 25 unique, abstract, and artistic keywords/short descriptions that would represent concepts in this field.
Return ONLY a JSON array of strings: {{"visual_prompts": ["cybernetic neural network", "glowing neon circuits", "ethereal data flow", ...]}}"""

        async def run_parallel():
            async def get_graph():
                try:
                    return await _generate_with_gemini_internal('gemini-2.0-flash', graph_prompt, forced_key_index=0)
                except Exception as e:
                    logging.warning(f"Gemini failed for graph: {e}")
                    try:
                        resp = await generate_with_groq(graph_prompt)
                        if resp: return resp
                    except: pass
                    try:
                        resp = await generate_with_cohere(graph_prompt)
                        if resp: return resp
                    except: pass
                    raise e
            
            async def get_visuals():
                key_index = 1 if len(api_keys) > 1 else 0
                try:
                    return await _generate_with_gemini_internal('gemini-2.0-flash', visual_prompt, forced_key_index=key_index)
                except:
                    return json.dumps({"visual_prompts": []})

            g_task = asyncio.create_task(get_graph())
            await asyncio.sleep(2.0)
            v_task = asyncio.create_task(get_visuals())
            return await asyncio.gather(g_task, v_task)

        graph_resp, visual_resp = await run_parallel()
        graph_data = extract_json(graph_resp)
        visual_data = {}
        try: visual_data = extract_json(visual_resp)
        except: pass

        graph_data = validate_and_normalize_graph(graph_data)
        prompts = visual_data.get("visual_prompts", [])
        if prompts and "graph" in graph_data:
            for i, node in enumerate(graph_data["graph"]["nodes"]):
                node["image_prompt"] = prompts[i % len(prompts)]
        
        # Save to DBs
        if "graph" in graph_data:
            if graph_data["graph"]["nodes"]: neo4j_service.insert_nodes(graph_data["graph"]["nodes"])
            if graph_data["graph"]["edges"]: neo4j_service.insert_relationships(graph_data["graph"]["edges"])
        session_service.save_query_history(request.query, json.dumps(graph_data), mode=request.mode)
        
        return graph_data
    except Exception as e:
        logging.error(f"Query generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expand-node")
async def expand_node(request: ExpandNodeRequest):
    try:
        prompt = f"""Expand the knowledge graph around the node: "{request.node_label}"
Current context: {len(request.current_graph.nodes)} existing nodes
Create 5-8 new related nodes.
Return ONLY valid JSON with "nodes" and "edges" lists."""
        response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
        result = extract_json(response_text)
        if "nodes" in result:
             for n in result["nodes"]: n["id"] = str(n.get("id"))
             neo4j_service.insert_nodes(result["nodes"])
        if "edges" in result:
             for e in result["edges"]: 
                 e["source"] = str(e.get("source"))
                 e["target"] = str(e.get("target"))
             neo4j_service.insert_relationships(result["edges"])
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
        response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
        return extract_json(response_text)
    except Exception as e:
        logging.error(f"Explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/explain-node")
async def explain_node(request: dict):
    try:
        node_id = request.get("nodeId", "")
        node_label = request.get("nodeLabel", "")
        context = request.get("context", "")
        
        prompt = f"""Generate a comprehensive, detailed explanation for the concept: "{node_label}"
Context: {context}

Provide a rich, educational explanation with:
1. A brief overview (2-3 sentences)
2. Detailed explanation (3-4 paragraphs covering key aspects, real-world applications, and technical details)
3. 5-7 key points or takeaways
4. Suggest 2-3 relevant images with actual URLs (diagrams, infographics, or illustrations from educational sites)
5. Suggest 2-3 educational YouTube videos with actual embed URLs
6. Provide 3-5 external resources (Wikipedia, documentation, articles) with descriptions

Return ONLY valid JSON in this EXACT format:
{{
  "title": "{node_label}",
  "explanation": {{
    "overview": "Brief 2-3 sentence overview explaining what this concept is and why it matters...",
    "details": [
      "First detailed paragraph covering fundamental concepts and definitions...",
      "Second detailed paragraph explaining how it works or its core mechanisms...",
      "Third detailed paragraph discussing real-world applications and use cases...",
      "Fourth detailed paragraph on advanced aspects or future directions..."
    ],
    "keyPoints": [
      "Key point 1: Most important takeaway",
      "Key point 2: Critical concept to remember",
      "Key point 3: Practical application",
      "Key point 4: Common misconception clarified",
      "Key point 5: Future implications"
    ]
  }},
  "media": [
    {{"url": "https://example.com/image1.jpg", "caption": "Descriptive caption explaining what the image shows"}},
    {{"url": "https://example.com/image2.jpg", "caption": "Another relevant diagram or infographic"}}
  ],
  "videos": [
    {{"embedUrl": "https://www.youtube.com/embed/VIDEO_ID", "title": "Educational video title explaining the concept"}},
    {{"embedUrl": "https://www.youtube.com/embed/VIDEO_ID2", "title": "Another relevant tutorial or explanation"}}
  ],
  "externalLinks": [
    {{"title": "Wikipedia - {node_label}", "url": "https://en.wikipedia.org/wiki/{node_label.replace(' ', '_')}", "description": "Comprehensive encyclopedia entry with history and detailed information"}},
    {{"title": "Official Documentation", "url": "https://example.com/docs", "description": "Official technical documentation and API reference"}},
    {{"title": "Tutorial Article", "url": "https://example.com/tutorial", "description": "Step-by-step guide with practical examples"}}
  ]
}}

IMPORTANT: 
- Use REAL, working URLs for images (from Wikimedia Commons, educational sites, or public domain sources)
- Use REAL YouTube embed URLs in format: https://www.youtube.com/embed/VIDEO_ID
- Provide actual, clickable external links (Wikipedia, official docs, reputable educational sites)
- Make descriptions helpful and specific
- Ensure all JSON is valid and properly formatted

Return ONLY the JSON object, no additional text."""

        response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
        result = extract_json(response_text)
        return result
    except Exception as e:
        logging.error(f"Node explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
