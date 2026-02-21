from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import json
import subprocess
import tempfile
import os
import re
from shared import (
    QueryRequest, CodeExecutionRequest,
    neo4j_service, session_service,
    generate_with_fallback, validate_and_normalize_graph,
    extract_json
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
    if request.mode != "programming":
        raise HTTPException(status_code=400, detail="Invalid mode for programming server")
    
    try:
        prompt = f"""You are a senior software architect. Analyze the following code and create a high-level logic flow visualization.

DO NOT create nodes for every variable or print statement. Instead, focus on the "Story" of the code:
1. **Modules/Classes**: Represent the main structural containers.
2. **Logic Phases**: Group code into logical blocks (e.g., "Initialization", "Data Processing", "Main Loop", "Validation").
3. **Control Flow**: Capture critical decision points (If/Else) or recursive loops as nodes.
4. **Key Operations**: Show major functions or state changes.

CODE TO ANALYZE:
{request.query}

Format as JSON with this exact structure:
{{
  "answer": "A comprehensive explanatory narration of the entire generated graph, explicitly detailing how each node connects to the others and the nature of their relationships.",
  "sections": {{ 
    "overview": "Brief 2-3 sentence overview of the subject.",
    "summary": "A concise 2-3 paragraph summary of the detailed overview, capturing the essence of the graph's structure and concepts."
  }},
  "graph": {{
    "nodes": [
      {{ "id": "slug", "label": "Name", "type": "LogicPhase", "description": "...", "importance": "high" }}
    ],
    "edges": [
      {{ "source": "slug1", "target": "slug2", "relation": "FLOWS_TO" }}
    ]
  }}
}}

Node Types: "Component" (structural), "LogicPhase" (process block), "Decision" (if/else), "DataStore" (main variables/db), "Entry" (start point).
Relations: "FLOWS_TO" (sequence), "CALLS" (function calls), "CONTAINS" (hierarchy).

CRITICAL REQUIREMENTS:
1. Use UNIQUE, concept-based string IDs for nodes (e.g., "module_init", "loop_check") instead of integers.
2. Ensure ALL nodes are connected by at least one relation to show a complete logic flow.
3. Every LogicPhase MUST have a FLOWS_TO relation to the next phase/node.

Create 8-12 meaningful nodes that explain the code flow. Return ONLY valid JSON."""


        response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
        logging.info(f"LLM Response received: {response_text[:100]}...")
        
        graph_data = extract_json(response_text)
        graph_data = validate_and_normalize_graph(graph_data)

        if "graph" in graph_data:
            if graph_data["graph"]["nodes"]: neo4j_service.insert_nodes(graph_data["graph"]["nodes"])
            if graph_data["graph"]["edges"]: neo4j_service.insert_relationships(graph_data["graph"]["edges"])
        
        session_service.save_query_history(request.query, json.dumps(graph_data), mode=request.mode)
        
        return graph_data
    except Exception as e:
        logging.error(f"Programming generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execute-code")
async def execute_code(request: CodeExecutionRequest):
    lang = request.language.lower()
    code = request.code

    try:
        if lang == "python":
            suffix = ".py"
        elif lang == "javascript":
            suffix = ".js"
        elif lang == "java":
            suffix = ".java"
        else:
            return {"output": "", "error": f"Execution for {lang} is not supported yet.", "success": False}

        with tempfile.NamedTemporaryFile(mode='w', suffix=suffix, delete=False) as f:
            f.write(code)
            temp_path = f.name

        try:
            if lang == "python":
                process = subprocess.Popen(["python", temp_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            elif lang == "javascript":
                process = subprocess.Popen(["node", temp_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            elif lang == "java":
                class_match = re.search(r'public\s+class\s+(\w+)', code)
                class_name = class_match.group(1) if class_match else "Main"
                temp_dir = tempfile.mkdtemp()
                java_file_path = os.path.join(temp_dir, f"{class_name}.java")
                with open(java_file_path, "w") as jf:
                    jf.write(code)
                compile_proc = subprocess.run(["javac", java_file_path], capture_output=True, text=True)
                if compile_proc.returncode != 0:
                    return {"output": "", "error": f"Compilation Error:\n{compile_proc.stderr}", "success": False}
                process = subprocess.Popen(["java", "-cp", temp_dir, class_name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            
            stdout, stderr = process.communicate(timeout=5)
            return {"output": stdout, "error": stderr, "success": process.returncode == 0}
        finally:
            if os.path.exists(temp_path): os.remove(temp_path)
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Execution timed out (5s limit)", "success": False}
    except Exception as e:
        logging.error(f"Code execution error: {e}")
        return {"output": "", "error": str(e), "success": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
