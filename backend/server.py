from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from google import genai
import json
import PyPDF2
import io
from groq import Groq
import cohere
from services.neo4j_service import Neo4jService
from services.session_service import SessionService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize Database Services
neo4j_service = Neo4jService()
session_service = SessionService()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# Models
class Node(BaseModel):
    id: str
    label: str
    type: str
    description: Optional[str] = None
    importance: Optional[int] = 1

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

class ExpandNodeRequest(BaseModel):
    node_id: str
    node_label: str
    current_graph: GraphData

class ExplainRequest(BaseModel):
    topic: str
    confusion: Optional[str] = None

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    query: str
    mode: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    preview: str
    response_data: Optional[dict] = None

# Initialize Gemini client
# API Key rotation state
current_api_key_index = 0
api_keys = []

def initialize_api_keys():
    """Load all available API keys from environment"""
    global api_keys
    api_keys = []
    
    # Load primary key
    primary_key = os.environ.get('GEMINI_API_KEY')
    if primary_key:
        api_keys.append(primary_key)
    
    # Load additional keys (GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.)
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
    
    logging.info(f"Loaded {len(api_keys)} API key(s) for rotation")
    return api_keys

# Initialize API keys on startup
initialize_api_keys()

def get_gemini_client(key_index=None):
    """Get Gemini client with specified or current API key"""
    global current_api_key_index
    
    if not api_keys:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    
    # Use specified index or current rotation index
    if key_index is not None:
        api_key = api_keys[key_index % len(api_keys)]
    else:
        api_key = api_keys[current_api_key_index % len(api_keys)]
    
    client = genai.Client(api_key=api_key)
    return client

def rotate_api_key():
    """Rotate to next API key"""
    global current_api_key_index
    current_api_key_index = (current_api_key_index + 1) % len(api_keys)
    logging.info(f"Rotated to API key {current_api_key_index + 1}/{len(api_keys)}")
    return current_api_key_index

# Models configuration
available_models = []

def initialize_models():
    """Load available models from environment"""
    global available_models
    models_str = os.environ.get('GEMINI_MODELS')
    if models_str:
        available_models = [m.strip() for m in models_str.split(',') if m.strip()]
    
    # Default fallback if not configured
    if not available_models:
        available_models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
    
    logging.info(f"Loaded {len(available_models)} models for fallback: {available_models}")

initialize_models()

# Initialize Third-Party Providers
groq_client = None
cohere_client = None

def initialize_providers():
    global groq_client, cohere_client
    if os.environ.get("GROQ_API_KEY"):
        try:
            groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
            logging.info("Groq client initialized")
        except Exception as e:
            logging.error(f"Failed to initialize Groq: {e}")
            
    if os.environ.get("COHERE_API_KEY"):
        try:
            cohere_client = cohere.Client(api_key=os.environ.get("COHERE_API_KEY"))
            logging.info("Cohere client initialized")
        except Exception as e:
            logging.error(f"Failed to initialize Cohere: {e}")

initialize_providers()

async def generate_with_groq(prompt):
    if not groq_client: return None
    logging.info("Attempting generation with Groq (Llama 3)...")
    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-70b-8192",
            response_format={"type": "json_object"}
        )
        return completion.choices[0].message.content
    except Exception as e:
        logging.error(f"Groq generation failed: {e}")
        raise e

async def generate_with_cohere(prompt):
    if not cohere_client: return None
    logging.info("Attempting generation with Cohere (Command R)...")
    try:
        response = cohere_client.chat(
            message=prompt,
            model="command-r-plus",
            response_format={"type": "json_object"}
        )
        return response.text
    except Exception as e:
        logging.error(f"Cohere generation failed: {e}")
        raise e

async def _generate_with_gemini_internal(preferred_model, prompt):
    """
    Generate content with dual-layer fallback:
    1. Loop through API Keys (Round-Robin)
    2. Loop through Available Models (if all keys fail for a model)
    """
    
    # Ensure preferred model is first in the list to try
    models_to_try = [preferred_model] + [m for m in available_models if m != preferred_model]
    
    last_error = None
    
    for model in models_to_try:
        logging.info(f"Attempting generation with model: {model}")
        
        # Try all keys for this model
        start_key_index = current_api_key_index
        keys_exhausted_for_model = False
        
        for i in range(len(api_keys)):
            try:
                # Get client with current key
                client = get_gemini_client()
                
                response = client.models.generate_content(
                    model=model,
                    contents=prompt
                )
                return response.text
                
            except Exception as e:
                error_msg = str(e)
                last_error = e
                
                # Check for quota/overload errors
                if any(code in error_msg for code in ['503', '429', 'overloaded', 'quota', 'UNAVAILABLE', 'RESOURCE_EXHAUSTED']):
                    logging.warning(f"Key {current_api_key_index + 1} failed on {model}: {error_msg}")
                    
                    # Rotate to next key
                    rotate_api_key()
                else:
                    logging.warning(f"Unexpected error with Key {current_api_key_index + 1} on {model}: {error_msg}")
                    rotate_api_key()
        
        logging.warning(f"All keys exhausted for model {model}. Switching to next model...")
    
    # If we get here, all keys on all models failed
    logging.error("All models and keys exhausted.")
    raise last_error

async def generate_with_fallback(preferred_model, prompt):
    """
    Orchestrates Multi-Provider Fallback:
    1. Gemini
    2. Groq
    3. Cohere
    """
    # Priority 1: Gemini
    try:
        logging.info("PRIORITY 1: Attempting Gemini...")
        return await _generate_with_gemini_internal(preferred_model, prompt)
    except Exception as e:
        logging.warning(f"All Gemini attempts failed: {e}. Switching to PRIORITY 2: Groq.")

    # Priority 2: Groq
    try:
        if groq_client:
            logging.info("PRIORITY 2: Attempting Groq...")
            return await generate_with_groq(prompt)
        else:
            logging.warning("Groq not configured. Skipping.")
    except Exception as e:
        logging.warning(f"Groq failed: {e}. Switching to PRIORITY 3: Cohere.")

    # Priority 3: Cohere
    try:
        if cohere_client:
            logging.info("PRIORITY 3: Attempting Cohere...")
            return await generate_with_cohere(prompt)
        else:
            logging.warning("Cohere not configured. Skipping.")
    except Exception as e:
        logging.error(f"Cohere failed: {e}.")

    # If all fail
    raise HTTPException(status_code=503, detail="All AI providers are unavailable.")

# Validation Helper
def validate_and_normalize_graph(graph_data):
    """
    Validates and normalizes the graph structure.
    Ensures nodes and edges list exist and have required fields.
    """
    if not isinstance(graph_data, dict):
        graph_data = {}
    
    if "graph" not in graph_data:
        graph_data["graph"] = {"nodes": [], "edges": []}
    
    graph = graph_data["graph"]
    if "nodes" not in graph:
        graph["nodes"] = []
    if "edges" not in graph:
        graph["edges"] = []
    
    # Validate Nodes
    valid_nodes = []
    node_ids = set()
    for node in graph["nodes"]:
        if "id" in node and "label" in node and "type" in node:
            # Normalize
            node["id"] = str(node["id"])
            node["importance"] = int(node.get("importance", 1))
            valid_nodes.append(node)
            node_ids.add(node["id"])
    graph["nodes"] = valid_nodes
    
    # Validate Edges
    valid_edges = []
    for edge in graph["edges"]:
        if "source" in edge and "target" in edge and "relation" in edge:
            # Normalize
            edge["source"] = str(edge["source"])
            edge["target"] = str(edge["target"])
            # Only keep edges where both nodes exist
            if edge["source"] in node_ids and edge["target"] in node_ids:
                valid_edges.append(edge)
    graph["edges"] = valid_edges
    
    return graph_data

@api_router.post("/generate-graph")
async def generate_graph(request: QueryRequest):
    try:
        
        if request.mode == "query":
            prompt = f"""Create a comprehensive knowledge graph AND textual explanation for: "{request.query}"

Generate a structured JSON response with:
1. A detailed textual explanation
2. Nodes and edges representing key concepts
3. Organized sections for different views

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
      {{"id": "1", "label": "Main Concept", "type": "Concept", "description": "Brief description", "importance": 3, "depth": 0}},
      {{"id": "2", "label": "Related Concept", "type": "Prerequisite", "description": "What's needed first", "importance": 2, "depth": 1}}
    ],
    "edges": [
      {{"source": "1", "target": "2", "relation": "DEPENDS_ON"}}
    ]
  }}
}}

Types: Concept, Prerequisite, Application, Component
Relations: EXPLAINS, DEPENDS_ON, RELATED_TO, LEADS_TO
Importance: 1-3
Depth: 0=core concept
Create 15-25 nodes. Return ONLY valid JSON."""
        
        elif request.mode == "programming":
            prompt = f"""Analyze this code and create a knowledge graph showing its logic flow:

{request.query}

Format as JSON with "answer" (explanation), "sections", and "graph" keys.
Types: CodeBlock, Component, Variable, Function
Relations: CALLS, USES, RETURNS, DEPENDS_ON
Create 10-20 nodes. Return valid JSON only."""
        
        
        response_text = await generate_with_fallback('gemini-2.5-flash', prompt)
        
        # Extract JSON from response
        response_text = response_text.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        graph_data = json.loads(response_text)
        
        # VALIDATE & NORMALIZE
        graph_data = validate_and_normalize_graph(graph_data)

        # 1. SAVE GRAPH TO NEO4J
        if "graph" in graph_data:
            if graph_data["graph"]["nodes"]:
                neo4j_service.insert_nodes(graph_data["graph"]["nodes"])
            if graph_data["graph"]["edges"]:
                neo4j_service.insert_relationships(graph_data["graph"]["edges"])
        
        # 2. SAVE TEXT TO SQL (with original JSON structure for fallback/metadata)
        session_service.save_query_history(request.query, json.dumps(graph_data))
        
        return graph_data
    
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error: {e}, Response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to parse graph data")
    except Exception as e:
        logging.error(f"Graph generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/generate-graph-from-pdf")
async def generate_graph_from_pdf(file: UploadFile = File(...)):
    try:
        # Read PDF
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        
        # Extract text
        text = ""
        for page in pdf_reader.pages[:10]:  # Limit to first 10 pages
            text += page.extract_text()
        
        if len(text) > 4000:
            text = text[:4000]
        

        prompt = f"""Analyze this document and create a knowledge graph:

{text}

Format as JSON with "answer", "sections", "graph".
Types: DocumentSection, Concept, Definition, Example
Relations: CONTAINS, EXPLAINS, RELATED_TO
Create 15-30 nodes. Return valid JSON only."""
        
        
        response_text = await generate_with_fallback('gemini-2.5-flash', prompt)
        
        response_text = response_text.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        graph_data = json.loads(response_text)
        
        # VALIDATE & NORMALIZE
        graph_data = validate_and_normalize_graph(graph_data)
        
        # 1. SAVE GRAPH TO NEO4J
        if "graph" in graph_data:
            if graph_data["graph"]["nodes"]:
                neo4j_service.insert_nodes(graph_data["graph"]["nodes"])
            if graph_data["graph"]["edges"]:
                neo4j_service.insert_relationships(graph_data["graph"]["edges"])
        
        # 2. SAVE TEXT TO SQL
        session_service.save_query_history(f"PDF: {file.filename}", json.dumps(graph_data))
        
        return graph_data
    
    except Exception as e:
        logging.error(f"PDF processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/expand-node")
async def expand_node(request: ExpandNodeRequest):
    try:
        prompt = f"""Expand the knowledge graph around the node: "{request.node_label}"
Current context: {len(request.current_graph.nodes)} existing nodes
Create 5-8 new related nodes.
Return ONLY valid JSON with "nodes" and "edges" lists."""
        
        response_text = await generate_with_fallback('gemini-2.5-flash', prompt)
        
        response_text = response_text.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response_text)

        # VALIDATE EXPANSION (Partial Graph)
        # Note: validate_and_normalize_graph expects {graph: {nodes: ...}}
        # But expansion returns {nodes:..., edges:...} directly often.
        # We'll handle it manually for now or wrap it.
        if "nodes" in result:
             # Basic normalize
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

@api_router.post("/explain-confusion")
async def explain_confusion(request: ExplainRequest):
    try:
        prompt = f"""Explain "{request.topic}" in a simple, clear way.
{"Focus on: " + request.confusion if request.confusion else ""}
Provide: Simple explanation, Analogy, Steps.
Format as JSON."""
        
        response_text = await generate_with_fallback('gemini-2.5-flash', prompt)
        
        response_text = response_text.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        return json.loads(response_text)
    
    except Exception as e:
        logging.error(f"Explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[HistoryItem])
async def get_history():
    # 1. Fetch Text/Metadata from SQL
    history_records = session_service.get_history(limit=20)
    
    items = []
    for record in history_records:
        try:
            # Parse stored JSON to get node IDs and Text
            stored_data = json.loads(record.answer)
            
            # Extract Node IDs to fetch live graph
            node_ids = []
            if "graph" in stored_data and "nodes" in stored_data["graph"]:
                node_ids = [n["id"] for n in stored_data["graph"]["nodes"]]
            
            # 2. Fetch Live Graph from Neo4j (if nodes exist)
            live_graph = {"nodes": [], "edges": []}
            if node_ids:
                live_graph = neo4j_service.get_subgraph_by_ids(node_ids)
            
            # 3. Construct Response
            # Use text from SQL (stored_data) but replace graph with proper Neo4j data
            # If Neo4j is empty (e.g. wiped), fallback to stored_data["graph"]?
            # User rule: "Fetch graph from Neo4j".
            # We will prefer Neo4j, but fallback if empty to avoid broken UI if Neo4j was reset.
            
            final_graph = live_graph if live_graph["nodes"] else stored_data.get("graph", {"nodes": [], "edges": []})
            
            response_data = stored_data
            response_data["graph"] = final_graph

            items.append({
                "id": str(record.id),
                "query": record.query,
                "mode": "query", 
                "timestamp": record.timestamp,
                "preview": record.query[:50] + "..." if len(record.query) > 50 else record.query,
                "response_data": response_data
            })
        except Exception as e:
            logging.error(f"Error processing history item {record.id}: {e}")
            continue
            
    return items

@api_router.get("/health")
async def health_check():
    neo4j_status = "connected" if neo4j_service.driver else "disconnected"
    return {
        "status": "healthy", 
        "service": "knowledge-graph-api", 
        "neo4j": neo4j_status,
        "database": "sqlite"
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_services():
    neo4j_service.close()
