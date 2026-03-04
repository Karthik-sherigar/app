import os
import logging
import json
import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv
from google import genai
from groq import Groq
import cohere
from fastapi import HTTPException
from services.neo4j_service import Neo4jService
from services.session_service import SessionService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize Database Services
neo4j_service = Neo4jService()
session_service = SessionService()

# Models
class Node(BaseModel):
    id: str
    label: str
    type: str
    description: Optional[str] = None
    importance: Optional[str] = "medium"

class Edge(BaseModel):
    source: str
    target: str
    relation: str

class GraphData(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

class QueryRequest(BaseModel):
    query: str
    mode: str
    is_temporary: Optional[bool] = False
    user_email: Optional[str] = None

class ExpandNodeRequest(BaseModel):
    node_id: str
    node_label: str
    mode: str = "query"
    current_graph: GraphData
    context_code: Optional[str] = None # For programming mode drill-down

class ExplainRequest(BaseModel):
    topic: str
    confusion: Optional[str] = None

class CodeExecutionRequest(BaseModel):
    code: str
    language: str
    stdin: Optional[str] = ""

class AskNodeRequest(BaseModel):
    nodeLabel: str
    context: str
    question: str

class DeepDiveRequest(BaseModel):
    nodeId: str
    nodeLabel: str
    context: Optional[str] = ""

class PDFDeepDiveRequest(BaseModel):
    nodeId: str
    nodeLabel: str
    historyId: int

class PDFChatRequest(BaseModel):
    nodeId: str
    nodeLabel: str
    historyId: int
    message: str
    history: List[dict] = []

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    query: str
    mode: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    preview: str
    response_data: Optional[dict] = None

# AI Client state
current_api_key_index = 0
api_keys = []
available_models = []
groq_client = None
cohere_client = None

def initialize_api_keys():
    global api_keys
    api_keys = []
    primary_key = os.environ.get('GEMINI_API_KEY')
    if primary_key:
        api_keys.append(primary_key)
    i = 2
    while True:
        key = os.environ.get(f'GEMINI_API_KEY_{i}')
        if key:
            api_keys.append(key)
            i += 1
        else:
            break
    if not api_keys:
        raise Exception("No GEMINI_API_KEY configured")
    return api_keys

def get_gemini_client(key_index=None):
    global current_api_key_index
    if not api_keys:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    if key_index is not None:
        api_key = api_keys[key_index % len(api_keys)]
    else:
        api_key = api_keys[current_api_key_index % len(api_keys)]
    return genai.Client(api_key=api_key)

def rotate_api_key():
    global current_api_key_index
    current_api_key_index = (current_api_key_index + 1) % len(api_keys)
    return current_api_key_index

def initialize_models():
    global available_models
    models_str = os.environ.get('GEMINI_MODELS')
    if models_str:
        available_models = [m.strip() for m in models_str.split(',') if m.strip()]
    if not available_models:
        available_models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest']

def initialize_providers():
    global groq_client, cohere_client
    if os.environ.get("GROQ_API_KEY"):
        try:
            # Reverting max_retries=0 as it may not be supported in some versions
            groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        except Exception as e:
            logging.error(f"Failed to initialize Groq: {e}")
    if os.environ.get("COHERE_API_KEY"):
        try:
            # Reverting max_retries=0
            cohere_client = cohere.Client(api_key=os.environ.get("COHERE_API_KEY"))
        except Exception as e:
            logging.error(f"Failed to initialize Cohere: {e}")

# Call initializations
initialize_api_keys()
initialize_models()
initialize_providers()

async def generate_with_groq(prompt, json_mode=True):
    if not groq_client: return None
    try:
        kwargs = {
            "messages": [{"role": "user", "content": prompt}],
            "model": "llama-3.3-70b-versatile"
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        # Run synchronous Groq client in a thread pool with 45s timeout
        completion = await asyncio.wait_for(
            asyncio.to_thread(
                groq_client.chat.completions.create,
                **kwargs
            ),
            timeout=45.0
        )
        return completion.choices[0].message.content
    except Exception as e:
        logging.error(f"Groq generation failed: {e}")
        raise e

async def generate_with_cohere(prompt, json_mode=False):
    if not cohere_client: return None    
    try:
        kwargs = {
            "message": prompt,
            "model": "command-r-08-2024"
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        # Run synchronous Cohere client in a thread pool with 45s timeout
        response = await asyncio.wait_for(
            asyncio.to_thread(
                cohere_client.chat,
                **kwargs
            ),
            timeout=45.0
        )
        return response.text
    except Exception as e:
        logging.error(f"Cohere generation failed: {e}")
        raise e

async def _gemini_loop(preferred_model, prompt, forced_key_index=None):
    models_to_try = [preferred_model] + [m for m in available_models if m != preferred_model]
    last_error = None
    for model in models_to_try:
        start_index = forced_key_index if forced_key_index is not None else current_api_key_index
        for i in range(len(api_keys)):
            k_index = (start_index + i) % len(api_keys)
            try:
                client = get_gemini_client(key_index=k_index)
                # Wrap synchronous SDK call in thread and enforce strict timeout
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=model,
                        contents=prompt
                    ),
                    timeout=60.0 # 60s per Gemini attempt
                )
                return response.text
            except asyncio.TimeoutError:
                last_error = Exception(f"Timeout waiting for Gemini model {model}")
                rotate_api_key()
            except Exception as e:
                error_msg = str(e)
                last_error = e
                rotate_api_key()
    raise last_error

async def _generate_with_gemini_internal(preferred_model, prompt, forced_key_index=None):
    """Wraps Gemini fallback loop with an absolute 90-second timeout."""
    try:
        return await asyncio.wait_for(
            _gemini_loop(preferred_model, prompt, forced_key_index),
            timeout=90.0
        )
    except asyncio.TimeoutError:
        raise Exception("Gemini overall timeout exceeded. Failing over to next provider.")

async def generate_with_fallback(preferred_model, prompt, json_mode=False, forced_key_index: Optional[int] = None):
    try:
        # If we need JSON, ensure prompt suggests it for safety when falling back
        if json_mode and "json" not in prompt.lower():
            prompt += "\nReturn ONLY valid JSON."
            
        return await _generate_with_gemini_internal(preferred_model, prompt, forced_key_index=forced_key_index)
    except Exception as e:
        logging.warning(f"Gemini failed: {e}. Trying Groq.")
    try:
        if groq_client: return await generate_with_groq(prompt, json_mode=json_mode)
    except Exception as e:
        logging.warning(f"Groq failed: {e}. Trying Cohere.")
    try:
        if cohere_client: return await generate_with_cohere(prompt, json_mode=json_mode)
    except Exception as e:
        logging.error(f"Cohere failed: {e}.")
    raise HTTPException(status_code=503, detail="All AI providers are unavailable.")

def extract_json(text):
    text = text.strip()
    # Try to find JSON within code blocks
    for marker in ["```json", "```"]:
        if marker in text:
            try:
                parts = text.split(marker)
                if len(parts) > 1:
                    text = parts[1].split("```")[0].strip()
            except: pass
    
    # Robust fallback: find the first { and last }
    try:
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            raw_json = text[start:end+1]
            
            # Basic cleaning for common AI mistakes
            # 1. Remove trailing commas before closing braces/brackets
            import re
            raw_json = re.sub(r',\s*([\]}])', r'\1', raw_json)
            # 2. Try to fix single quotes to double quotes if purely single quoted
            # This is risky but sometimes necessary. We'll try normal load first.
            try:
                return json.loads(raw_json)
            except:
                # Attempt aggressive cleaning if simple load fails
                try:
                    # Replace single quotes with double quotes only if they appear to be surrounding keys/values
                    cleaned = re.sub(r"'(.*?)'", r'"\1"', raw_json)
                    return json.loads(cleaned)
                except:
                    return json.loads(raw_json) # Let it throw if it still fails
        return {}
    except Exception as e:
        logging.error(f"JSON Extraction failed: {e}. Raw snippet: {text[:300]}")
        return {}

def validate_and_normalize_graph(graph_data):
    if not isinstance(graph_data, dict):
        graph_data = {}
    
    # Handle direct nodes/edges instead of nested graph
    if "nodes" not in graph_data and "modules" in graph_data:
        graph_data["nodes"] = graph_data.pop("modules")
    if "nodes" not in graph_data and "concepts" in graph_data:
        graph_data["nodes"] = graph_data.pop("concepts")
        
    if "nodes" in graph_data and "edges" in graph_data and "graph" not in graph_data:
        graph_data["graph"] = {"nodes": graph_data.pop("nodes"), "edges": graph_data.pop("edges")}
    elif "graph" not in graph_data:
        graph_data["graph"] = {"nodes": [], "edges": []}
        
    graph = graph_data["graph"]
    if not isinstance(graph, dict):
        graph = {"nodes": [], "edges": []}
        graph_data["graph"] = graph
    
    if "nodes" not in graph: graph["nodes"] = []
    if "edges" not in graph: graph["edges"] = []
    
    valid_nodes = []
    node_ids = set()
    
    for node in graph["nodes"]:
        if not isinstance(node, dict): continue
        
        # FLEXIBLE KEY MAPPING
        nid = node.get("id") or node.get("nodeId") or node.get("ID") or node.get("node_id")
        nlabel = node.get("label") or node.get("name") or node.get("Label") or node.get("title")
        ndesc = node.get("description") or node.get("desc") or node.get("explanation") or ""
        ntype = node.get("type") or node.get("role") or "Module"
        nimp = node.get("importance") or node.get("priority") or "medium"
        
        if nid and nlabel:
            normalized_node = {
                "id": str(nid),
                "label": str(nlabel),
                "description": str(ndesc),
                "type": str(ntype),
                "importance": str(nimp).lower() if str(nimp).lower() in ["high", "medium", "low"] else "medium",
                "depth": node.get("depth", 0)
            }
            valid_nodes.append(normalized_node)
            node_ids.add(normalized_node["id"])
            
    graph["nodes"] = valid_nodes
    valid_edges = []
    for edge in graph["edges"]:
        if not isinstance(edge, dict): continue
        
        # FLEXIBLE KEY MAPPING
        source = edge.get("source") or edge.get("from") or edge.get("start") or edge.get("src")
        target = edge.get("target") or edge.get("to") or edge.get("end") or edge.get("dest")
        rel = edge.get("relation") or edge.get("relationship") or edge.get("label") or edge.get("type") or "FOLLOWS"
        
        if source and target:
            source_s, target_s = str(source), str(target)
            if source_s in node_ids and target_s in node_ids:
                valid_edges.append({
                    "source": source_s,
                    "target": target_s,
                    "relation": str(rel).upper()
                })
                
    graph["edges"] = valid_edges
    return graph_data
