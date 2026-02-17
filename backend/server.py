from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging
import os
import json
from typing import List
from shared import (
    session_service, neo4j_service, HistoryItem
)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sub-server configurations
QUERY_SERVER_URL = os.environ.get("QUERY_SERVER_URL", "http://localhost:8001")
PDF_SERVER_URL = os.environ.get("PDF_SERVER_URL", "http://localhost:8002")
PROGRAMMING_SERVER_URL = os.environ.get("PROGRAMMING_SERVER_URL", "http://localhost:8003")

client = httpx.AsyncClient()

@app.post("/api/generate-graph")
async def generate_graph_proxy(request: Request):
    try:
        body = await request.json()
        mode = body.get("mode", "query")
        
        if mode == "query":
            target_url = f"{QUERY_SERVER_URL}/api/generate-graph"
        elif mode == "programming":
            target_url = f"{PROGRAMMING_SERVER_URL}/api/generate-graph"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported mode: {mode}")
        
        response = await client.post(target_url, json=body, timeout=60.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (generate-graph): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-graph-from-pdf")
async def generate_graph_from_pdf_proxy(file: UploadFile = File(...)):
    try:
        # Re-upload the file to the PDF server
        files = {"file": (file.filename, await file.read(), file.content_type)}
        response = await client.post(f"{PDF_SERVER_URL}/api/generate-graph-from-pdf", files=files, timeout=60.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (pdf): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expand-node")
async def expand_node_proxy(request: Request):
    try:
        body = await request.json()
        # Node expansion is currently handled by query server
        response = await client.post(f"{QUERY_SERVER_URL}/api/expand-node", json=body, timeout=60.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (expand-node): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute-code")
async def execute_code_proxy(request: Request):
    try:
        body = await request.json()
        response = await client.post(f"{PROGRAMMING_SERVER_URL}/api/execute-code", json=body, timeout=10.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (execute-code): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/explain-confusion")
async def explain_confusion_proxy(request: Request):
    try:
        body = await request.json()
        # Explain confusion is currently handled by query server
        response = await client.post(f"{QUERY_SERVER_URL}/api/explain-confusion", json=body, timeout=30.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (explain-confusion): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history", response_model=List[HistoryItem])
async def get_history(limit: int = 20, include_data: bool = True):
    history_records = session_service.get_history(limit=limit)
    items = []
    for record in history_records:
        try:
            response_data = None
            if include_data and record.answer:
                try:
                    response_data = json.loads(record.answer)
                except Exception as e:
                    logging.error(f"Error parsing JSON for history {record.id}: {e}")
                    response_data = {"text": record.answer}
            
            items.append({
                "id": str(record.id),
                "query": record.query,
                "mode": getattr(record, 'mode', 'query'),
                "timestamp": record.timestamp.isoformat() + "Z" if record.timestamp.tzinfo is None else record.timestamp.isoformat(),
                "preview": record.query[:50] + "..." if len(record.query) > 50 else record.query,
                "response_data": response_data
            })
        except Exception as e:
            logging.error(f"Error processing history record {record.id}: {e}")
    return items

@app.get("/api/history/{id}", response_model=HistoryItem)
async def get_history_detail(id: int):
    record = session_service.get_history_item(id)
    if not record:
        raise HTTPException(status_code=404, detail="History not found")
    
    try:
        response_data = json.loads(record.answer)
        return {
            "id": str(record.id),
            "query": record.query,
            "mode": getattr(record, 'mode', 'query'),
            "timestamp": record.timestamp.isoformat() + "Z" if record.timestamp.tzinfo is None else record.timestamp.isoformat(),
            "preview": record.query[:50] + "..." if len(record.query) > 50 else record.query,
            "response_data": response_data
        }
    except Exception as e:
        logging.error(f"Error processing history item {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process history data")

@app.delete("/api/history/{item_id}")
async def delete_history_item(item_id: int):
    success = session_service.delete_history_item(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="History item not found")
    return {"message": "History item deleted"}

@app.post("/api/explain-node")
async def explain_node_proxy(request: Request):
    """Proxy endpoint for detailed node explanations"""
    try:
        body = await request.json()
        target_url = f"{QUERY_SERVER_URL}/api/explain-node"
        response = await client.post(target_url, json=body, timeout=30.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (explain-node): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "root-gateway",
        "sub_services": {
            "query": QUERY_SERVER_URL,
            "pdf": PDF_SERVER_URL,
            "programming": PROGRAMMING_SERVER_URL
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
