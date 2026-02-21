from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import json
import io
import PyPDF2
from shared import (
    neo4j_service, session_service,
    generate_with_fallback, validate_and_normalize_graph
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/generate-graph-from-pdf")
async def generate_graph_from_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        
        text = ""
        for page in pdf_reader.pages[:10]:
            text += page.extract_text()
        
        if len(text) > 4000:
            text = text[:4000]
        
        prompt = f"""Analyze this document and create a knowledge graph:

{text}

Return ONLY valid JSON in this exact format:
{{
  "answer": "A comprehensive explanatory narration of the entire generated graph, explicitly detailing how each node connects to the others and the nature of their relationships.",
  "sections": {{
    "overview": "Brief 2-3 sentence overview of the subject.",
    "summary": "A concise 2-3 paragraph summary of the detailed overview, capturing the essence of the graph's structure and concepts."
  }},
  "graph": {{
    "nodes": [
      {{"id": "concept_1", "label": "Concept", "type": "Concept", "description": "Desc", "importance": "high", "depth": 0}}
    ],
    "edges": [
      {{"source": "concept_1", "target": "concept_2", "relation": "RELATED_TO"}}
    ]
  }}
}}
Types: DocumentSection, Concept, Definition, Example
Relations: CONTAINS, EXPLAINS, RELATED_TO
Create 15-30 nodes. Return valid JSON only."""
        
        response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
        
        response_text = response_text.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        graph_data = json.loads(response_text)
        graph_data = validate_and_normalize_graph(graph_data)
        
        if "graph" in graph_data:
            if graph_data["graph"]["nodes"]: neo4j_service.insert_nodes(graph_data["graph"]["nodes"])
            if graph_data["graph"]["edges"]: neo4j_service.insert_relationships(graph_data["graph"]["edges"])
        
        session_service.save_query_history(f"PDF: {file.filename}", json.dumps(graph_data), mode="pdf")
        
        return graph_data
    except Exception as e:
        logging.error(f"PDF processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
