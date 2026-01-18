# AI Knowledge Graph Platform

A modern, professional AI-powered knowledge graph visualization system for exploring concepts, analyzing documents, and understanding code structure.

## 🎯 Features

### Three Powerful Modes

1. **Query Mode** 📝
   - Enter any question or topic
   - AI generates a comprehensive knowledge graph with 15-25 nodes
   - Visualize concepts, prerequisites, and relationships

2. **PDF Mode** 📄
   - Upload PDF documents (research papers, articles, books)
   - AI extracts and structures key information
   - Creates visual representation of document hierarchy

3. **Programming Mode** 💻
   - Paste code snippets or full programs
   - Visualizes code logic, functions, and dependencies
   - Understand code flow at a glance

## 🎨 Design

- **Dark Theme**: Professional SaaS-style interface with glassmorphism
- **Interactive Graph**: Powered by Cytoscape.js with smooth animations
- **Node Types**: Color-coded for easy identification
  - 🔵 Concept (Blue)
  - 🟠 Prerequisite (Orange)
  - 🟢 CodeBlock (Green)
  - 🟣 DocumentSection (Purple)
  - 🔷 Component/Application (Cyan)

## 🚀 Getting Started

### Demo Queries (Query Mode)

Try these sample queries:
- "Explain Machine Learning"
- "What is Quantum Computing?"
- "How does Blockchain work?"
- "Explain Neural Networks"
- "What is Cloud Computing?"

### Demo Code (Programming Mode)

Use the sample code from `/app/demo/sample-code.js`:
- Binary Search Algorithm
- Shows function flow and logic structure

### Demo Document

Sample text about Blockchain Technology available in `/app/demo/sample-blockchain.txt`

## 🎮 Using the Platform

### Generating a Graph

1. **Select Mode**: Click on Query/PDF/Programming Mode in the navbar
2. **Enter Input**: 
   - Query Mode: Type your question
   - PDF Mode: Drag & drop or browse for PDF
   - Programming Mode: Paste your code
3. **Generate**: Click "Generate Graph" button
4. **Explore**: Pan, zoom, and click nodes to explore

### Interacting with Nodes

- **Click Node**: Opens details panel showing:
  - Node type and importance level
  - Description
  - Connected edges and relationships
  
- **Expand Node**: Generate 5-8 additional related concepts
  
- **Explain Node**: Get simplified explanation with:
  - Simple explanation
  - Relatable analogy
  - Step-by-step breakdown

### Additional Features

- **Reset Graph**: Clear the workspace and start fresh
- **Export PNG**: Download graph visualization as image
- **History**: View and restore previous queries (Recent History sidebar)
- **Theme Toggle**: Switch between dark and light themes
- **Backend Status**: Green indicator shows API connection health

## 🏗️ Architecture

### Frontend
- **React** + **Framer Motion** for smooth animations
- **Cytoscape.js** for graph visualization
- **Radix UI** components for accessible design
- **Monaco Editor** for code input

### Backend
- **FastAPI** for high-performance API
- **Gemini 3 Flash** (Google AI) for knowledge graph generation
- **MongoDB** for history storage
- **PyPDF2** for PDF text extraction

## 📊 Graph Controls

- **Pan**: Click and drag the canvas
- **Zoom**: Mouse wheel or pinch gesture
- **Node Focus**: Double-click to center on node
- **Select**: Click to highlight and view details

## 💡 Tips for Best Results

1. **Be Specific**: "Explain neural network backpropagation" works better than "AI"
2. **Code Context**: Include comments in your code for better visualization
3. **PDF Quality**: Text-based PDFs work better than scanned images
4. **Node Expansion**: Expand key nodes to dive deeper into specific concepts

## 🎓 Perfect For

- **Students**: Visualize complex topics and study connections
- **Researchers**: Map document structures and research relationships
- **Developers**: Understand code architecture and dependencies
- **Educators**: Create visual learning materials
- **Presentations**: Generate impressive knowledge graph visualizations

## 🔧 Technical Details

- **Graph Layout**: Force-directed COSE algorithm
- **Max Nodes**: 150 initial (lazy loading for larger graphs)
- **Response Time**: 2-5 seconds for typical queries
- **Supported Code**: JavaScript, Python, Java, C++, and more

## 📈 Future Enhancements

- Real-time collaborative editing
- Graph export to various formats (JSON, GraphML)
- Custom node styling and themes
- Integration with external knowledge bases
- Multi-language support

---

**Built with** ❤️ **using Emergent Platform**

*For academic and research purposes*
