from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import json
import subprocess
import tempfile
import os
import re
from shared import (
    QueryRequest, CodeExecutionRequest, ExpandNodeRequest,
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
        prompt = f"""Construct a hierarchical "Logic Tree" and "Visual Palette" explaining the code flow for:
{request.query}

STRICT VISUAL & STRUCTURAL REQUIREMENTS:
1. **Vertical Hierarchy**: Organize nodes into multiple horizontal levels using the "depth" property. 
   - Level 0: Global entry point / script start (Root).
   - Level 1-2: Main functions or logic phases.
   - Level 3+: Internal steps or callbacks.
2. **Branching**: For each parent node, try to generate exactly 2 distinct child paths (Binary Branching) where logical.
3. **Node Definition**: Return 10-15 meaningful nodes representing the system structure.

JSON Response Format:
{{
  "answer": "A detailed narration of the execution journey through this code.",
  "sections": {{
    "overview": "High-level purpose of the code (2-3 sentences).",
    "summary": "Technical architecture summary."
  }},
  "graph": {{
    "nodes": [
      {{ "id": "main_fn", "label": "main()", "type": "Entry", "description": "Entry point", "depth": 0 }}
    ],
    "edges": [
      {{ "source": "parent", "target": "child", "relation": "CALLS" }}
    ]
  }},
  "visual_prompts": ["cybernetic circuits", "logic gates", "binary rain"]
}}

Node Types: "Component", "LogicPhase", "Decision", "DataStore", "Entry".
Relations: "CALLS", "FLOWS_TO", "CONTAINS"."""

        def is_placeholder(data):
            if not data or "nodes" not in data.get("graph", {}): return True
            if len(data.get("graph", {}).get("nodes", [])) < 5: return True
            if len(data.get("sections", {}).get("overview", "")) < 50: return True
            return False

        async def get_response():
            # Priority: Groq -> Gemini
            from shared import generate_with_groq
            res_text = None
            try:
                res_text = await generate_with_groq(prompt, json_mode=True)
            except Exception as e:
                logging.warning(f"Groq programming generation failed: {e}")
            
            if not res_text:
                res_text = await generate_with_fallback('gemini-2.0-flash', prompt)
            
            return extract_json(res_text)

        graph_data = await get_response()
        
        if is_placeholder(graph_data):
            logging.info("Placeholder programming graph detected, retrying...")
            graph_data = await get_response()

        graph_data = validate_and_normalize_graph(graph_data)

        if "graph" in graph_data:
            if graph_data["graph"]["nodes"]: neo4j_service.insert_nodes(graph_data["graph"]["nodes"], mode=request.mode)
            if graph_data["graph"]["edges"]: neo4j_service.insert_relationships(graph_data["graph"]["edges"], mode=request.mode)
        
        if not getattr(request, 'is_temporary', False):
            session_service.save_query_history(request.query, json.dumps(graph_data), mode=request.mode, user_email=getattr(request, 'user_email', None))
        
        return graph_data
    except Exception as e:
        logging.error(f"Programming generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expand-node")
async def expand_node(request: ExpandNodeRequest):
    """
    Detailed logic flow expansion for a specific function/component.
    """
    if request.mode != "programming":
         raise HTTPException(status_code=400, detail="Invalid mode for programming expand")
    
    code_context = request.context_code or ""
    if not code_context:
        # Fallback to current labels if no code provided
        return {"nodes": [], "edges": []}

    try:
        prompt = f"""You are a debugging expert. Zoom into the logic flow of the following specific entity within the code.
ENTITY TO DRILL DOWN: {request.node_label} (ID: {request.node_id})

ORIGINAL CODE CONTEXT:
{code_context}

Analyze only the internal logic, loops, and conditional branches INSIDE this function/entity.
Create a local control flow graph (CFG).

Format as JSON:
{{
  "nodes": [
    {{ "id": "detailed_id", "label": "Specific Step", "type": "LogicPhase", "description": "...", "importance": "medium" }}
  ],
  "edges": [
    {{ "source": "step1", "target": "step2", "relation": "FLOWS_TO" }}
  ]
}}

Ensure all new node IDs are unique and prefixed with {request.node_id}_ to prevent collisions.
Connect the first new node to the parent node {request.node_id}.

Return ONLY valid JSON."""

        response_text = await generate_with_fallback('gemini-2.0-flash', prompt)
        expanded_data = extract_json(response_text)
        expanded_data = validate_and_normalize_graph(expanded_data)

        graph = expanded_data.get("graph", {"nodes": [], "edges": []})
        
        # Link the first node to the expanded parent
        if graph["nodes"]:
            first_node_id = graph["nodes"][0]["id"]
            graph["edges"].append({
                "source": request.node_id,
                "target": first_node_id,
                "relation": "INTERNALS"
            })

            # Persistent save
            neo4j_service.insert_nodes(graph["nodes"], mode=request.mode)
            neo4j_service.insert_relationships(graph["edges"], mode=request.mode)
            
        return graph
    except Exception as e:
        logging.error(f"Programming expansion error: {e}")
        return {"nodes": [], "edges": []}



@app.post("/api/format-code")
async def format_code(request: CodeExecutionRequest):
    """
    AI-powered code formatting and correction.
    """
    try:
        prompt = f"""You are a senior software engineer. Your task is to format and correct the following code for better readability, PEP8/Industry standards, and potential bug fixes.

Language: {request.language}
Original Code:
```{request.language}
{request.code}
```

STRICT REQUIREMENTS:
1. Preserve all logic—only fix formatting, docstrings, variable naming if egregious, and minor syntax errors.
2. Return ONLY the corrected code. No explanations, no markdown code blocks.
3. If the code is already perfect, return it as is.
"""
        formatted_code = await generate_with_fallback('gemini-2.0-flash', prompt)
        
        # Clean up any potential markdown formatting in the response
        if "```" in formatted_code:
            lines = formatted_code.split('\n')
            code_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith('```'):
                    in_block = not in_block
                    continue
                if in_block or not line.strip().startswith('```'):
                    code_lines.append(line)
            formatted_code = '\n'.join(code_lines) if in_block else formatted_code
            # Second attempt at cleaning if first failed
            formatted_code = re.sub(r'```[a-zA-Z]*\n', '', formatted_code)
            formatted_code = formatted_code.replace('```', '')

        return {"formatted_code": formatted_code.strip()}
    except Exception as e:
        logging.error(f"Formatting error: {e}")
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

        stdin_data = getattr(request, 'stdin', "")

        try:
            if lang == "python":
                process = subprocess.Popen(["python", temp_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE, text=True)
            elif lang == "javascript":
                process = subprocess.Popen(["node", temp_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE, text=True)
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
                process = subprocess.Popen(["java", "-cp", temp_dir, class_name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE, text=True)
            
            stdout, stderr = process.communicate(input=stdin_data, timeout=5)
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
