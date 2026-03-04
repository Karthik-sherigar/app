from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging
import os
import json
from typing import List
from shared import (
    session_service, neo4j_service, HistoryItem
)
from auth_routes import auth_router

app = FastAPI()

app.include_router(auth_router)

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
async def generate_graph_from_pdf_proxy(file: UploadFile = File(...), user_email: str = Form(None)):
    try:
        # Re-upload the file to the PDF server
        files = {"file": (file.filename, await file.read(), file.content_type)}
        data = {"user_email": user_email} if user_email else None
        response = await client.post(f"{PDF_SERVER_URL}/api/generate-graph-from-pdf", files=files, data=data, timeout=90.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (pdf): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pdf/deep-dive")
async def pdf_deep_dive_proxy(request: Request):
    try:
        body = await request.json()
        response = await client.post(f"{PDF_SERVER_URL}/api/pdf/deep-dive", json=body, timeout=120.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (pdf-deep-dive): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pdf/chat")
async def pdf_chat_proxy(request: Request):
    try:
        body = await request.json()
        response = await client.post(f"{PDF_SERVER_URL}/api/pdf/chat", json=body, timeout=120.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (pdf-chat): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expand-node")
async def expand_node_proxy(request: Request):
    try:
        body = await request.json()
        mode = body.get("mode", "query")
        
        if mode == "programming":
            target_url = f"{PROGRAMMING_SERVER_URL}/api/expand-node"
        else:
            target_url = f"{QUERY_SERVER_URL}/api/expand-node"
            
        response = await client.post(target_url, json=body, timeout=90.0)
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

@app.post("/api/format-code")
async def format_code_proxy(request: Request):
    try:
        body = await request.json()
        response = await client.post(f"{PROGRAMMING_SERVER_URL}/api/format-code", json=body, timeout=30.0)
        return response.json()
    except Exception as e:
        logging.error(f"Proxy error (format-code): {e}")
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
async def get_history(limit: int = 20, include_data: bool = True, mode: str = None, user_email: str = None):
    history_records = session_service.get_history(limit=limit, mode=mode, user_email=user_email)
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
async def delete_all_history(mode: str = None, user_email: str = None):
    try:
        session_service.clear_history(mode=mode, user_email=user_email)
        session_service.clear_deep_dive(mode=mode)
        if mode:
            neo4j_service.clear_mode_data(mode=mode)
        return {"message": f"History, deep dive cache, and graph data for {mode or 'all modes'} deleted"}
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
        
        # Extract mode from headers if present, else default to query
        mode = request.headers.get("x-mode", "query")

        # Create a unique cache key
        cache_key = f"{node_id}:{context}" if context else str(node_id)

        if node_id:
            cached = session_service.get_deep_dive(cache_key, mode=mode)
            if cached:
                logging.info(f"Serving deep dive from cache for: {cache_key} (mode={mode})")
                return json.loads(cached.data)

        target_url = f"{QUERY_SERVER_URL}/api/deep-dive"
        response = await client.post(target_url, json=body, timeout=90.0)
        data = response.json()
        
        # Cache the result with the unique key
        if node_id and response.status_code == 200:
            session_service.save_deep_dive(cache_key, json.dumps(data), mode=mode)
            
        return data
    except Exception as e:
        logging.error(f"Proxy error (deep-dive): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def generate_image(request: Request):
    """Generate an image using Freepik's Mystic AI API with caching"""
    import asyncio
    try:
        body = await request.json()
        prompt = body.get("prompt", "")
        node_id = body.get("nodeId")
        context = body.get("context", "")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        # Extract mode from headers
        mode = request.headers.get("x-mode", "query")

        # Create a unique cache key
        cache_key = f"{node_id}:{context}" if context else node_id

        # Check Cache
        if node_id:
            cached = session_service.get_deep_dive(cache_key, mode=mode)
            if cached:
                cached_data = json.loads(cached.data)
                # Serve base64 image or old pollinations url
                if cached_data.get("imageUrl") and ("base64," in cached_data["imageUrl"] or "pollinations.ai" in cached_data["imageUrl"]):
                    logging.info(f"Serving image from cache for: {cache_key} (mode={mode})")
                    return {"image_url": cached_data["imageUrl"]}

        # Use Freepik Synchronous Text-To-Image endpoint for high speed
        # Fallback to hardcoded key if .env is missing it
        freepik_key = os.environ.get("FREEPIK_API_KEY", "FPSX9e484a8f9e1bff7530a4c8249db38398")
        headers = {
            "x-freepik-api-key": freepik_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        
        # Adding constraints to enforce clean, academic, non-AI aesthetics while blocking text
        payload = {
            "prompt": f"{prompt}. Flat vector illustration style, clean academic diagram, white background, university textbook infographic aesthetic, strictly professional visualization, clear structure. ABSOLUTELY NO text, NO words, NO letters, NO numbers, NO labels",
            "negative_prompt": "cyberpunk, neon, glowing, 3d render, cinematic lighting, dark background, text, words, letters, typography, fonts, watermark, labels, alien language, gibberish, abstract art",
        }

        image_url = None
        logging.info(f"Creating Synchronous Freepik task for: {prompt}")
        resp = await client.post("https://api.freepik.com/v1/ai/text-to-image", headers=headers, json=payload, timeout=25.0)

        if resp.status_code == 200:
            data = resp.json()
            if data.get("data") and len(data["data"]) > 0:
                base64_str = data["data"][0].get("base64")
                if base64_str:
                    image_url = f"data:image/jpeg;base64,{base64_str}"
        
        # If Freepik failed or timed out, fallback to an empty string silently or throw
        if not image_url:
            logging.error(f"Freepik Sync Error: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=502, detail="Image generation failed")

        # Update cache with imageUrl (sharing same mode logic)
        if node_id:
            cached = session_service.get_deep_dive(cache_key, mode=mode)
            if cached:
                cached_data = json.loads(cached.data)
                cached_data["imageUrl"] = image_url
                session_service.save_deep_dive(cache_key, json.dumps(cached_data), mode=mode)

        return {"image_url": image_url}

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

# ---------------------------------------------------------
# Serve React Frontend Build
# ---------------------------------------------------------
frontend_build_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")

# Serve the 'static' folder (js/css/media) directly
if os.path.exists(os.path.join(frontend_build_dir, "static")):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_build_dir, "static")), name="static")

# Catch-all route to serve the SPA index.html or other root files
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Do not intercept API calls
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
        
    # Check if a specific file exists (like favicon.ico, manifest.json, robots.txt)
    file_path = os.path.join(frontend_build_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Otherwise, return the main index.html for React Router to handle
    index_path = os.path.join(frontend_build_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    raise HTTPException(status_code=404, detail="Frontend build missing. Run 'npm run build' inside frontend directory.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
