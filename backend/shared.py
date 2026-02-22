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

class ExpandNodeRequest(BaseModel):
    node_id: str
    node_label: str
    current_graph: GraphData

class ExplainRequest(BaseModel):
    topic: str
    confusion: Optional[str] = None

class CodeExecutionRequest(BaseModel):
    code: str
    language: str

class AskNodeRequest(BaseModel):
    nodeLabel: str
    context: str
    question: str

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
        available_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

def initialize_providers():
    global groq_client, cohere_client
    if os.environ.get("GROQ_API_KEY"):
        try:
            # max_retries=0 ensures instant failure on rate limit instead of sleeping
            groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"), max_retries=0)
        except Exception as e:
            logging.error(f"Failed to initialize Groq: {e}")
    if os.environ.get("COHERE_API_KEY"):
        try:
            # max_retries=0 ensures instant failure on rate limit
            cohere_client = cohere.Client(api_key=os.environ.get("COHERE_API_KEY"), max_retries=0)
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

async def generate_with_cohere(prompt):
    if not cohere_client: return None    
    try:
        # Run synchronous Cohere client in a thread pool with 45s timeout
        response = await asyncio.wait_for(
            asyncio.to_thread(
                cohere_client.chat,
                message=prompt,
                model="command-r-08-2024"
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
                    timeout=30.0 # 30s per Gemini attempt
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
    """Wraps Gemini fallback loop with an absolute 45-second timeout."""
    try:
        return await asyncio.wait_for(
            _gemini_loop(preferred_model, prompt, forced_key_index),
            timeout=45.0
        )
    except asyncio.TimeoutError:
        raise Exception("Gemini overall timeout exceeded. Failing over to next provider.")

async def generate_with_fallback(preferred_model, prompt):
    try:
        return await _generate_with_gemini_internal(preferred_model, prompt)
    except Exception as e:
        logging.warning(f"Gemini failed: {e}. Trying Groq.")
    try:
        if groq_client: return await generate_with_groq(prompt)
    except Exception as e:
        logging.warning(f"Groq failed: {e}. Trying Cohere.")
    try:
        if cohere_client: return await generate_with_cohere(prompt)
    except Exception as e:
        logging.error(f"Cohere failed: {e}.")
    raise HTTPException(status_code=503, detail="All AI providers are unavailable.")

def extract_json(text):
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)

def validate_and_normalize_graph(graph_data):
    if not isinstance(graph_data, dict):
        graph_data = {}
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
        if "id" in node and "label" in node and "type" in node:
            node["id"] = str(node["id"])
            if "importance" in node and node["importance"] not in ["high", "medium", "low"]:
                node["importance"] = "medium"
            elif "importance" not in node:
                node["importance"] = "medium"
            valid_nodes.append(node)
            node_ids.add(node["id"])
    graph["nodes"] = valid_nodes
    valid_edges = []
    for edge in graph["edges"]:
        if "source" in edge and "target" in edge and "relation" in edge:
            edge["source"] = str(edge["source"])
            edge["target"] = str(edge["target"])
            if edge["source"] in node_ids and edge["target"] in node_ids:
                valid_edges.append(edge)
    graph["edges"] = valid_edges
    return graph_data
