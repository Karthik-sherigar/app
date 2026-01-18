import React, { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import GraphCanvas from "./components/GraphCanvas";
import NodeDetailsPanel from "./components/NodeDetailsPanel";
import ExplanationPanel from "./components/ExplanationPanel";
import { Toaster, toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [mode, setMode] = useState("query");
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("loading");
  const [history, setHistory] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationData, setExplanationData] = useState(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    checkBackendHealth();
    fetchHistory();
  }, []);

  const checkBackendHealth = async () => {
    try {
      await axios.get(`${API}/health`);
      setBackendStatus("connected");
    } catch (e) {
      setBackendStatus("error");
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  };

  const generateGraph = async (query, selectedMode) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/generate-graph`, {
        query,
        mode: selectedMode || mode
      });
      setGraphData(response.data);
      toast.success("Knowledge graph generated!");
      fetchHistory();
    } catch (e) {
      toast.error("Failed to generate graph");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateGraphFromPDF = async (file) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.post(`${API}/generate-graph-from-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setGraphData(response.data);
      toast.success("PDF analyzed successfully!");
      fetchHistory();
    } catch (e) {
      toast.error("Failed to process PDF");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const expandNode = async (nodeId, nodeLabel) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/expand-node`, {
        node_id: nodeId,
        node_label: nodeLabel,
        current_graph: graphData
      });
      
      setGraphData({
        nodes: [...graphData.nodes, ...response.data.nodes],
        edges: [...graphData.edges, ...response.data.edges]
      });
      toast.success("Node expanded!");
    } catch (e) {
      toast.error("Failed to expand node");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const explainConfusion = async (topic, confusion = null) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/explain-confusion`, {
        topic,
        confusion
      });
      setExplanationData(response.data);
      setShowExplanation(true);
    } catch (e) {
      toast.error("Failed to generate explanation");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetGraph = () => {
    setGraphData({ nodes: [], edges: [] });
    setSelectedNode(null);
    setShowNodePanel(false);
    setShowExplanation(false);
    toast.info("Graph reset");
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setShowNodePanel(true);
  };

  const restoreFromHistory = (historyItem) => {
    // In a real app, you'd fetch the saved graph data
    toast.info("Restoring from history...");
  };

  return (
    <div className={`app ${theme}`} data-testid="app-container">
      <Navbar 
        mode={mode}
        setMode={setMode}
        backendStatus={backendStatus}
        resetGraph={resetGraph}
        theme={theme}
        setTheme={setTheme}
      />
      
      <div className="app-layout">
        <Sidebar 
          mode={mode}
          generateGraph={generateGraph}
          generateGraphFromPDF={generateGraphFromPDF}
          explainConfusion={() => {
            if (selectedNode) {
              explainConfusion(selectedNode.label);
            } else {
              toast.error("Select a node first");
            }
          }}
          resetGraph={resetGraph}
          history={history}
          restoreFromHistory={restoreFromHistory}
          loading={loading}
        />
        
        <main className="workspace" data-testid="main-workspace">
          {loading && (
            <div className="loading-overlay" data-testid="loading-indicator">
              <div className="spinner"></div>
              <p>Generating Knowledge Graph...</p>
            </div>
          )}
          
          <GraphCanvas 
            graphData={graphData}
            onNodeClick={handleNodeClick}
            selectedNode={selectedNode}
          />
        </main>

        <AnimatePresence>
          {showNodePanel && selectedNode && (
            <NodeDetailsPanel 
              node={selectedNode}
              onClose={() => setShowNodePanel(false)}
              onExpand={() => expandNode(selectedNode.id, selectedNode.label)}
              onExplain={() => explainConfusion(selectedNode.label)}
              graphData={graphData}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showExplanation && explanationData && (
            <ExplanationPanel 
              data={explanationData}
              onClose={() => setShowExplanation(false)}
            />
          )}
        </AnimatePresence>
      </div>
      
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
