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
        graph_prompt = f"""Construct a high-fidelity "Knowledge Expedition" railroad through the concepts of: "{request.query}"
Generate a structured JSON response with:
1. A detailed textual explanation
2. A sequence of 10-15 "Technical Stations" (Nodes) that form a logical train path.
3. Distinct relations (Edges) connecting these stations in a clear architectural timeline.

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
      {{"id": "1", "label": "Main Concept", "type": "Concept", "description": "Brief description", "importance": "high", "depth": 0}},
      {{"id": "2", "label": "Related Concept", "type": "Prerequisite", "description": "What's needed first", "importance": "medium", "depth": 1}}
    ],
    "edges": [
      {{"source": "1", "target": "2", "relation": "DEPENDS_ON"}}
    ]
  }}
}}
Types: Concept, Prerequisite, Application, Component
Focus on creating a clear, sequential path of discovery with 10-15 nodes. Return ONLY valid JSON."""

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
