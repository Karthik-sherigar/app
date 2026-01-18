from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import PyPDF2
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
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

# Initialize Gemini client
def get_gemini_client():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    
    chat = LlmChat(
        api_key=api_key,
        session_id=str(uuid.uuid4()),
        system_message="You are an expert at creating structured knowledge graphs and explanations."
    )
    chat.with_model("gemini", "gemini-3-flash-preview")
    return chat

@api_router.post("/generate-graph")
async def generate_graph(request: QueryRequest):
    try:
        chat = get_gemini_client()
        
        if request.mode == "query":
            prompt = f"""Create a comprehensive knowledge graph for: "{request.query}"

Generate a structured JSON response with nodes and edges that represent the key concepts and their relationships.

Return ONLY valid JSON in this exact format:
{{
  "nodes": [
    {{"id": "1", "label": "Main Concept", "type": "Concept", "description": "Brief description", "importance": 3}},
    {{"id": "2", "label": "Prerequisite", "type": "Prerequisite", "description": "What's needed first", "importance": 2}}
  ],
  "edges": [
    {{"source": "1", "target": "2", "relation": "DEPENDS_ON"}}
  ]
}}

Types: Concept, Prerequisite, Application, Component
Relations: EXPLAINS, DEPENDS_ON, RELATED_TO, LEADS_TO
Importance: 1-3 (1=basic, 2=important, 3=critical)

Create 15-25 nodes with meaningful connections."""
        
        elif request.mode == "programming":
            prompt = f"""Analyze this code and create a knowledge graph showing its logic flow:

{request.query}

Return ONLY valid JSON in this exact format:
{{
  "nodes": [
    {{"id": "1", "label": "Function/Class Name", "type": "CodeBlock", "description": "What it does", "importance": 3}},
    {{"id": "2", "label": "Variable/Logic", "type": "Component", "description": "Purpose", "importance": 2}}
  ],
  "edges": [
    {{"source": "1", "target": "2", "relation": "USES"}}
  ]
}}

Types: CodeBlock, Component, Variable, Function
Relations: CALLS, USES, RETURNS, DEPENDS_ON
Create 10-20 nodes showing code structure."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Extract JSON from response
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        graph_data = json.loads(response_text)
        
        # Save to history
        history_item = HistoryItem(
            query=request.query[:100],
            mode=request.mode,
            preview=request.query[:50] + "..." if len(request.query) > 50 else request.query
        )
        doc = history_item.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.history.insert_one(doc)
        
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
        
        chat = get_gemini_client()
        prompt = f"""Analyze this document and create a knowledge graph of key concepts:

{text}

Return ONLY valid JSON in this exact format:
{{
  "nodes": [
    {{"id": "1", "label": "Main Topic", "type": "DocumentSection", "description": "Summary", "importance": 3}},
    {{"id": "2", "label": "Subtopic", "type": "Concept", "description": "Details", "importance": 2}}
  ],
  "edges": [
    {{"source": "1", "target": "2", "relation": "CONTAINS"}}
  ]
}}

Types: DocumentSection, Concept, Definition, Example
Relations: CONTAINS, EXPLAINS, RELATED_TO
Create 15-30 nodes representing document structure."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        graph_data = json.loads(response_text)
        
        # Save to history
        history_item = HistoryItem(
            query=file.filename,
            mode="pdf",
            preview=f"PDF: {file.filename}"
        )
        doc = history_item.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.history.insert_one(doc)
        
        return graph_data
    
    except Exception as e:
        logging.error(f"PDF processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/expand-node")
async def expand_node(request: ExpandNodeRequest):
    try:
        chat = get_gemini_client()
        prompt = f"""Expand the knowledge graph around the node: "{request.node_label}"

Current context: {len(request.current_graph.nodes)} existing nodes

Create 5-8 new related nodes that expand understanding of "{request.node_label}".

Return ONLY valid JSON in this exact format:
{{
  "nodes": [
    {{"id": "new_1", "label": "Related Concept", "type": "Concept", "description": "How it relates", "importance": 2}}
  ],
  "edges": [
    {{"source": "{request.node_id}", "target": "new_1", "relation": "EXPLAINS"}}
  ]
}}

Connect new nodes to existing node id: {request.node_id}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        return json.loads(response_text)
    
    except Exception as e:
        logging.error(f"Node expansion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/explain-confusion")
async def explain_confusion(request: ExplainRequest):
    try:
        chat = get_gemini_client()
        prompt = f"""Explain "{request.topic}" in a simple, clear way.
        
{"Focus on: " + request.confusion if request.confusion else ""}

Provide:
1. Simple explanation (2-3 sentences)
2. A relatable analogy
3. Step-by-step breakdown (3-5 steps)

Format as JSON:
{{
  "simple": "Simple explanation here",
  "analogy": "Imagine it like...",
  "steps": ["Step 1", "Step 2", "Step 3"]
}}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        response_text = response.strip()
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
    history = await db.history.find({}, {"_id": 0}).sort("timestamp", -1).limit(20).to_list(20)
    for item in history:
        if isinstance(item['timestamp'], str):
            item['timestamp'] = datetime.fromisoformat(item['timestamp'])
    return history

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "knowledge-graph-api"}

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
async def shutdown_db_client():
    client.close()
