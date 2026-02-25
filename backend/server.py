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
        
        response = await client.post(target_url, json=body, timeout=90.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (generate-graph): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-graph-from-pdf")
async def generate_graph_from_pdf_proxy(file: UploadFile = File(...)):
    try:
        # Re-upload the file to the PDF server
        files = {"file": (file.filename, await file.read(), file.content_type)}
        response = await client.post(f"{PDF_SERVER_URL}/api/generate-graph-from-pdf", files=files, timeout=90.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (pdf): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expand-node")
async def expand_node_proxy(request: Request):
    try:
        body = await request.json()
        # Node expansion is currently handled by query server
        response = await client.post(f"{QUERY_SERVER_URL}/api/expand-node", json=body, timeout=90.0)
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

@app.delete("/api/history")
async def delete_all_history():
    try:
        session_service.clear_history()
        return {"message": "All history deleted"}
    except Exception as e:
        logging.error(f"Error clearing history: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear history")

@app.put("/api/history/{item_id}")
async def update_history_item(item_id: int, request: Request):
    try:
        body = await request.json()
        # Validating that body is a dict is good practice
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
            
        updated_item = session_service.update_history_item(item_id, json.dumps(body))
        if not updated_item:
            raise HTTPException(status_code=404, detail="History item not found")
        return {"min_success": True}
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Update history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/explain-node")
async def explain_node_proxy(request: Request):
    """Proxy endpoint for detailed node explanations"""
    try:
        body = await request.json()
        target_url = f"{QUERY_SERVER_URL}/api/explain-node"
        response = await client.post(target_url, json=body, timeout=90.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (explain-node): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ask-node")
async def ask_node_proxy(request: Request):
    """Proxy endpoint for asking questions about a node"""
    try:
        body = await request.json()
        target_url = f"{QUERY_SERVER_URL}/api/ask-node"
        # Increase timeout for LLM generation
        response = await client.post(target_url, json=body, timeout=60.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (ask-node): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/deep-dive")
async def deep_dive_proxy(request: Request):
    """Proxy endpoint for immersive deep dives with context-aware caching"""
    try:
        body = await request.json()
        node_id = body.get("nodeId")
        context = body.get("context", "")
        logging.info(f"Deep-dive request for node: {node_id}, context: {context}")
        
        # Create a unique cache key that includes context to prevent collisions
        # (e.g., 'causes_of_origin' for WW2 vs 'causes_of_origin' for a CS bug)
        cache_key = f"{node_id}:{context}" if context else node_id
        
        if node_id:
            cached = session_service.get_deep_dive(cache_key)
            if cached:
                logging.info(f"Serving deep dive from cache for: {cache_key}")
                return json.loads(cached.data)

        target_url = f"{QUERY_SERVER_URL}/api/deep-dive"
        response = await client.post(target_url, json=body, timeout=90.0)
        data = response.json()
        
        # Cache the result with the unique key
        if node_id and response.status_code == 200:
            session_service.save_deep_dive(cache_key, json.dumps(data))
            
        return data
    except Exception as e:
        logging.error(f"Proxy error (deep-dive): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def generate_image(request: Request):
    """Generate an image using Freepik's Mystic AI API with caching"""
    import asyncio

    FREEPIK_API_KEY = os.environ.get("FREEPIK_API_KEY", "")
    if not FREEPIK_API_KEY:
        raise HTTPException(status_code=500, detail="Freepik API key not configured")

    try:
        body = await request.json()
        prompt = body.get("prompt", "")
        node_id = body.get("nodeId")
        context = body.get("context", "")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        # Create a unique cache key
        cache_key = f"{node_id}:{context}" if context else node_id

        # Check Cache
        if node_id:
            cached = session_service.get_deep_dive(cache_key)
            if cached:
                cached_data = json.loads(cached.data)
                if cached_data.get("imageUrl"):
                    logging.info(f"Serving image from cache for: {cache_key}")
                    return {"image_url": cached_data["imageUrl"]}

        headers = {
            "x-freepik-api-key": FREEPIK_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }

        # Step 1: Create image generation task
        create_payload = {
            "prompt": prompt,
            "negative_prompt": "text, watermarks, blurry, low quality",
            "aspect_ratio": "square_1_1",
            "model": "realism",
            "filter_nsfw": True
        }

        logging.info(f"Creating Freepik task for prompt: {prompt}")
        create_resp = await client.post(
            "https://api.freepik.com/v1/ai/mystic",
            headers=headers,
            json=create_payload,
            timeout=30.0
        )

        if create_resp.status_code not in (200, 201, 202):
            logging.error(f"Freepik create error {create_resp.status_code}: {create_resp.text}")
            raise HTTPException(status_code=502, detail=f"Freepik API error: {create_resp.text}")

        create_data = create_resp.json()
        task_id = create_data.get("data", {}).get("task_id") or create_data.get("task_id")

        if not task_id:
            logging.error(f"No task_id in Freepik response: {create_data}")
            raise HTTPException(status_code=502, detail="No task_id returned from Freepik API")

        # Step 2: Poll for completion (max 90s)
        max_polls = 30
        for poll_num in range(max_polls):
            await asyncio.sleep(3)

            status_resp = await client.get(
                f"https://api.freepik.com/v1/ai/mystic/{task_id}",
                headers=headers,
                timeout=15.0
            )

            if status_resp.status_code != 200:
                logging.warning(f"Freepik poll status error {status_resp.status_code}: {status_resp.text}")
                continue

            status_data = status_resp.json()
            status = status_data.get("data", {}).get("status") or status_data.get("status")

            if status == "COMPLETED":
                images = status_data.get("data", {}).get("generated", [])
                if images:
                    # generated is a list of URL strings per official docs
                    image_url = images[0] if isinstance(images[0], str) else images[0].get("url", "")
                    
                    # Update cache with imageUrl
                    if node_id:
                        cached = session_service.get_deep_dive(cache_key)
                        if cached:
                            cached_data = json.loads(cached.data)
                            cached_data["imageUrl"] = image_url
                            session_service.save_deep_dive(cache_key, json.dumps(cached_data))

                    return {"image_url": image_url}
                break
            elif status in ("FAILED", "ERROR", "CONTENT_MODERATION"):
                raise HTTPException(status_code=502, detail=f"Freepik image generation failed with status: {status}")

        raise HTTPException(status_code=504, detail="Image generation timed out")

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Image generation error: {e}")
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
