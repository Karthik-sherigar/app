from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import logging
import os
import json
from typing import List
import urllib.parse
from dotenv import load_dotenv
import shared
from shared import (
    session_service, neo4j_service, HistoryItem, generate_image_with_gemini
)
# Explicitly load .env from the same directory as this file
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
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

# Ensure static directory exists
os.makedirs("static/images", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Sub-server configurations
QUERY_SERVER_URL = os.environ.get("QUERY_SERVER_URL", "http://localhost:8011")
PDF_SERVER_URL = os.environ.get("PDF_SERVER_URL", "http://localhost:8012")
PROGRAMMING_SERVER_URL = os.environ.get("PROGRAMMING_SERVER_URL", "http://localhost:8013")

client = httpx.AsyncClient()

# Task tracking for concurrent image generations to avoid duplicate work and costs
active_image_tasks = {}

# Concurrency control to prevent API exhaustion and server lag
image_semaphore = asyncio.Semaphore(3)

@app.post("/api/generate-graph")
async def generate_graph_proxy(request: Request):
    try:
        body = await request.json()
        query = body.get("query", "")
        mode = body.get("mode", "query")
        
        # 1. Check Cache for Queries
        if query and mode in ["query", "programming"]:
            cached_query = session_service.get_query_cache(query, mode=mode)
            if cached_query:
                logging.info(f"Serving {mode} query from cache: {query}")
                return json.loads(cached_query.answer)
        
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

@app.post("/api/history")
async def save_history_item(request: Request):
    try:
        body = await request.json()
        query = body.get("query", "")
        mode = body.get("mode", "query")
        response_data = body.get("response_data", {})
        user_email = body.get("user_email")
        
        item = session_service.save_query_history(
            query=query,
            answer_data=json.dumps(response_data),
            mode=mode,
            user_email=user_email
        )
        return {"id": item.id}
    except Exception as e:
        logging.error(f"Error saving history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/history/{item_id}")
async def update_history_item(item_id: int, request: Request):
    try:
        body = await request.json()
        # Validating that body is a dict is good practice
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
            
        query = body.get("query")
        # For full update, we can pass response_data explicitly if it exists, 
        # but let's maintain the contract where body is the answer_data
        updated_item = session_service.update_history_item(item_id, json.dumps(body), query=query)
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
            
            # OPTIMIZATION: Kick off image generation in background if imagePrompt is present
            image_prompt = data.get("imagePrompt")
            category = data.get("category", "GENERAL")
            if image_prompt and not data.get("imageUrl"):
                logging.info(f"Triggering background image pre-generation for: {node_id} (Category: {category})")
                image_cache_key = f"{node_id}:{context}" if context else str(node_id)
                if image_cache_key not in active_image_tasks:
                    active_image_tasks[image_cache_key] = asyncio.create_task(
                        generate_image_internal(image_prompt, node_id, context, mode, category)
                    )
            
        return data
    except Exception as e:
        logging.error(f"Proxy error (deep-dive): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def generate_image(request: Request):
    """Generate an IEEE textbook-style image using Freepik's Mystic AI"""
    try:
        body = await request.json()
        image_prompt = body.get("prompt", "")
        node_id = body.get("nodeId")
        context = body.get("context", "")
        refresh = body.get("refresh", False)
        mode = request.headers.get("x-mode", "query")
        cache_key = f"{node_id}:{context}" if context else str(node_id)
        category = "GENERAL"

        # 1. Check Cache First (Skip if refresh=True)
        if node_id and not refresh:
            cached = session_service.get_deep_dive(cache_key, mode=mode)
            if cached:
                cached_data = json.loads(cached.data)
                category = cached_data.get("category", "GENERAL")
                if cached_data.get("imageUrl"):
                    logging.info(f"Serving image from cache for: {cache_key}")
                    return {"image_url": cached_data["imageUrl"]}

        # 2. Check if a background task is already running for this image (Skip if refresh=True)
        if cache_key in active_image_tasks and not refresh:
            logging.info(f"Joining active image generation task for: {cache_key}")
            try:
                # Wait for the existing task to complete
                image_url = await active_image_tasks[cache_key]
                if image_url:
                    return {"image_url": image_url}
            except Exception as e:
                logging.warning(f"Joined task failed for {cache_key}: {e}")
                # Fall through to start a new attempt if the joined task failed

        # 3. Start New Generation
        if not image_prompt and node_id:
            image_prompt = f"Technical diagram of {node_id.replace('_', ' ')}"
        
        if not image_prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        # Create and track the task
        task = asyncio.create_task(generate_image_internal(image_prompt, node_id, context, mode, category))
        active_image_tasks[cache_key] = task
        
        try:
            image_url = await task
            return {"image_url": image_url}
        finally:
            pass

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Image generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def search_wikipedia_image(topic: str, wclient: httpx.AsyncClient) -> str:
    """Search Wikipedia using full-text search to find a real educational image. Free, no key needed."""
    try:
        headers = {
            "User-Agent": "EyePhish-EduApp/1.0 (educational; contact: admin@eyephish.com)",
            "Accept": "application/json"
        }
        # Step 1: Use Wikipedia full-text search to find the closest matching article
        search_url = (
            f"https://en.wikipedia.org/w/api.php?action=query&list=search"
            f"&srsearch={urllib.parse.quote(topic)}&format=json&srlimit=1&srprop="
        )
        search_resp = await wclient.get(search_url, headers=headers, timeout=8.0)
        if search_resp.status_code != 200:
            return None

        results = search_resp.json().get("query", {}).get("search", [])
        if not results:
            logging.info(f"No Wikipedia search results for '{topic}'")
            return None

        best_title = results[0].get("title", "")
        logging.info(f"Wikipedia best match for '{topic}': '{best_title}'")
        encoded_title = urllib.parse.quote(best_title)

        # Step 2: Get image for the matched article via Summary API
        summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}"
        resp = await wclient.get(summary_url, headers=headers, timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            img = data.get("originalimage", {}).get("source") or data.get("thumbnail", {}).get("source")
            if img:
                logging.info(f"Wikipedia image found for '{best_title}': {img}")
                return img

        # Step 3: Fallback to Page Images API
        pageimg_url = (
            f"https://en.wikipedia.org/w/api.php?action=query"
            f"&titles={encoded_title}&prop=pageimages&format=json&pithumbsize=800"
        )
        resp2 = await wclient.get(pageimg_url, headers=headers, timeout=5.0)
        if resp2.status_code == 200:
            pages = resp2.json().get("query", {}).get("pages", {})
            for page in pages.values():
                thumb = page.get("thumbnail", {}).get("source")
                if thumb:
                    logging.info(f"Wikipedia page image for '{best_title}': {thumb}")
                    return thumb
    except Exception as e:
        logging.warning(f"Wikipedia image search failed for '{topic}': {e}")
    return None


async def search_serper_image(topic: str, sclient: httpx.AsyncClient) -> str:
    """Search Google Images via Serper API for a real educational diagram. Fast, high quality."""
    try:
        serper_key = os.environ.get("SERPER_API_KEY")
        if not serper_key:
            return None

        def upgrade_wikimedia_url(url: str) -> str:
            """Upgrade Wikimedia thumbnail URLs to full-size (e.g. 250px -> 1200px or original)"""
            import re
            # Pattern: /thumb/X/XX/FILENAME.EXT/NNNpx-FILENAME.EXT
            match = re.match(r"(https://upload\.wikimedia\.org/wikipedia/\w+/)thumb/(.+?)/\d+px-(.+)$", url)
            if match:
                base = match.group(1)
                path = match.group(2)
                # Return direct file URL (no thumb, no size restriction)
                return f"{base}{path}"
            return url

        def is_relevant(title: str, query: str) -> bool:
            """Check if the result title contains at least one significant word from the query."""
            significant_words = [w.lower() for w in query.split() if len(w) > 3]
            if not significant_words: return True  # Fallback if query too short
            title_lower = title.lower()
            return any(word in title_lower for word in significant_words)

        headers = {
            "X-API-KEY": serper_key,
            "Content-Type": "application/json"
        }
        # Refined query for better educational results
        search_query = f"{topic} educational technical diagram architecture textbook infographic"
        payload = {
            "q": search_query,
            "num": 15,
            "gl": "us",
            "hl": "en"
        }

        resp = await sclient.post(
            "https://google.serper.dev/images",
            headers=headers,
            json=payload,
            timeout=8.0
        )
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("images", [])
            preferred_domains = ["wikipedia.org", "wikimedia.org", ".edu", "britannica.com", "researchgate.net"]

            # Pass 1: Preferred educational domains + Relevance + Size
            for img_data in images:
                img_url = img_data.get("imageUrl", "")
                source = img_data.get("link", "")
                title = img_data.get("title", "")
                width = img_data.get("imageWidth", 0) or 0
                height = img_data.get("imageHeight", 0) or 0
                
                is_preferred = any(domain in source for domain in preferred_domains)
                is_large_enough = width >= 400 or height >= 300
                if is_preferred and img_url and is_large_enough and is_relevant(title, topic):
                    final_url = upgrade_wikimedia_url(img_url)
                    logging.info(f"Serper HQ Priority Image ({width}x{height}): {final_url}")
                    return final_url

            # Pass 2: Relevance + Any domain + Size
            for img_data in images:
                img_url = img_data.get("imageUrl", "")
                title = img_data.get("title", "")
                width = img_data.get("imageWidth", 0) or 0
                if img_url and width >= 400 and is_relevant(title, topic):
                    bad_keywords = ["blocked", "login", "forbidden", "403", "404", "access denied"]
                    if any(bad in title.lower() for bad in bad_keywords):
                        continue
                    logging.info(f"Serper Relevant Image ({width}px): {img_url}")
                    return img_url
                    
            logging.info(f"No sufficiently relevant images found on Serper for '{topic}'")
        else:
            logging.warning(f"Serper API returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logging.warning(f"Serper image search failed for '{topic}': {e}")
    return None


async def generate_image_internal(image_prompt: str, node_id: str, context: str, mode: str, category: str = "GENERAL"):
    """Internal helper for image generation with cache population and task tracking compatibility"""
    cache_key = f"{node_id}:{context}" if context else str(node_id)
    
    # Use semaphore to limit global concurrency
    async with image_semaphore:
        try:
            if not isinstance(image_prompt, str):
                if isinstance(image_prompt, dict):
                    image_prompt = image_prompt.get("description", str(image_prompt))
                else:
                    image_prompt = str(image_prompt)

            # MINIMALIST ACADEMIC STYLE - STRICTLY NO GARBLED TEXT
            ctx_str = f" in the domain of {context}" if context else ""
            if category in ["COMP_SCI", "SCIENCE"]:
                tech_prefix = (
                    f"A high-clarity University Textbook diagram{ctx_str}. "
                    "Technical schematic with heavy weighted black outlines and bold structural strokes. "
                    "Clean 2D vector style on a stark white background. "
                    "Visualization of: "
                )
                tech_suffix = (
                    ". CRITICAL: Strictly NO text labels, NO garbled letters, and NO symbols. "
                    "Focus entirely on structural clarity and schematic accuracy. "
                    "High-contrast black ink on white background, no gradients, patent drawing style."
                )
            else:
                tech_prefix = (
                    f"A professional formal University Textbook illustration{ctx_str}. "
                    "Bold high-contrast diagram with thick structural strokes. "
                    "Minimalist technical graphic on a solid stark white background. "
                    "Clear visualization of: "
                )
                tech_suffix = (
                    ". CRITICAL: Do NOT include any text or alphabet characters in the image. "
                    "Ensure maximum conceptual relevance through visual elements alone. "
                    "Stark white background, heavy weighted black lines, textbook simplicity."
                )
            
            final_prompt = f"{tech_prefix} {image_prompt} {tech_suffix}"
            logging.info(f"--- IMAGE GENERATION START [Node: {node_id}] ---")

            # Shared context terms
            clean_node = str(node_id).replace("_slug", "").replace("_", " ")
            ctx_subject = ""
            if context:
                ctx_words = context.lower().replace("in the context of the study of", "").replace("explain", "").strip().split()
                ctx_subject = ctx_words[-1] if ctx_words else ""
            wiki_search_term = f"{clean_node} {ctx_subject}".strip()

            # Priority 1: Wikipedia
            logging.info(f"Priority 1: Wikipedia search for '{wiki_search_term}'")
            wiki_url = await search_wikipedia_image(wiki_search_term, client)
            if wiki_url:
                session_service.cache_image_url(cache_key, wiki_url)
                return wiki_url

            # Priority 2: Serper
            logging.info(f"Priority 2: Serper Google Image search for '{wiki_search_term}'")
            serper_url = await search_serper_image(wiki_search_term, client)
            if serper_url:
                session_service.cache_image_url(cache_key, serper_url)
                return serper_url

            # Priority 3: Freepik Mystic
            freepik_key = os.environ.get("FREEPIK_API_KEY")
            if freepik_key:
                try:
                    logging.info(f"Priority 3: Attempting Freepik Mystic for: {node_id}")
                    c_headers = {
                        "x-freepik-api-key": freepik_key,
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                    create_resp = await client.post(
                        "https://api.freepik.com/v1/ai/mystic",
                        headers=c_headers,
                        json={"prompt": final_prompt, "aspect_ratio": "widescreen_16_9", "guidance_scale": 5},
                        timeout=45.0
                    )
                    if create_resp.status_code == 200:
                        data = create_resp.json()
                        task_id = data.get("data", {}).get("task_id") or data.get("data", {}).get("id")
                        if task_id:
                            for attempt in range(40):
                                await asyncio.sleep(2)
                                status_resp = await client.get(f"https://api.freepik.com/v1/ai/mystic/{task_id}", headers=c_headers, timeout=10.0)
                                if status_resp.status_code == 200:
                                    s_data = status_resp.json().get("data", {})
                                    if s_data.get("status") == "COMPLETED":
                                        img_url = s_data.get("result", {}).get("url") or s_data.get("url") or s_data.get("image_url") or ((s_data.get("images") or [{}])[0]).get("url")
                                        if img_url:
                                            logging.info(f"Freepik SUCCESS: {img_url}")
                                            session_service.cache_image_url(cache_key, img_url)
                                            return img_url
                                        break
                except Exception as fe:
                    logging.warning(f"Freepik Priority 3 failed: {fe}")

            # Priority 4: Gemini
            try:
                logging.info(f"Priority 4: Attempting Gemini for: {node_id}")
                image_url = await generate_image_with_gemini(final_prompt, f"img_{node_id}_{int(asyncio.get_event_loop().time())}")
                if image_url:
                    session_service.cache_image_url(cache_key, image_url)
                    return image_url
            except Exception as ge:
                logging.warning(f"Gemini Priority 4 failed: {ge}")

            # Priority 5: Pollinations
            try:
                logging.info(f"Priority 5: Attempting Pollinations for: {node_id}")
                encoded = urllib.parse.quote(f"Technical white background scientific diagram of {clean_node}")
                image_url = f"https://pollinations.ai/p/{encoded}?width=800&height=450&seed=42&nologo=true"
                session_service.cache_image_url(cache_key, image_url)
                return image_url
            except Exception as pe:
                logging.error(f"Pollinations Priority 5 failed: {pe}")

            return None
        except Exception as e:
            logging.error(f"Internal image generation error: {e}")
            return None
        finally:
            # CRITICAL: Always clean up task reference from global tracking
            if cache_key in active_image_tasks:
                del active_image_tasks[cache_key]
                logging.info(f"Cleaned up image task for: {cache_key}")

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
