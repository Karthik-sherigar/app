import React, { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import GraphCanvas from "./components/GraphCanvas";
import VisualJourney from "./components/VisualJourney/VisualJourney";
import NodeDetailsPanel from "./components/NodeDetailsPanel";
import ExplanationPanel from "./components/ExplanationPanel";
import TextResponsePanel from "./components/TextResponsePanel";
import ProgrammingView from "./components/ProgrammingView";
import BottomInputBar from "./components/BottomInputBar";
import { Toaster, toast } from "sonner";
import { MessageSquare, X } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("overview");
  const [externalSelectedNode, setExternalSelectedNode] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [programmingCode, setProgrammingCode] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [hasNewResponse, setHasNewResponse] = useState(false);

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

      // Handle nested graph structure as per new backend format
      const data = response.data;
      // Normalize data: ensure graphData contains nodes/edges at top level for GraphCanvas
      // but also contains the full response structure for TextResponsePanel
      const normalizedData = data.graph ? { ...data.graph, ...data } : data;
      setGraphData(normalizedData);

      if (!showChat) {
        setHasNewResponse(true);
      }

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

      const data = response.data;
      const normalizedData = data.graph ? { ...data.graph, ...data } : data;
      setGraphData(normalizedData);

      if (!showChat) {
        setHasNewResponse(true);
      }

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
        current_graph: { nodes: graphData.nodes, edges: graphData.edges }
      });

      // Expand node returns just nodes/edges usually
      setGraphData(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...response.data.nodes],
        edges: [...prev.edges, ...response.data.edges]
      }));
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

  /* eslint-disable react-hooks/exhaustive-deps */
  const handleNodeClick = React.useCallback((node) => {
    setSelectedNode(node);
    setShowNodePanel(true);
    setExternalSelectedNode(node?.id);
  }, []);

  const handleTextNodeClick = React.useCallback((nodeId) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setExternalSelectedNode(nodeId);
    }
  }, [graphData]);

  const handleExpandConcept = async (nodeId) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node) {
      await expandNode(node.id, node.label);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  const restoreFromHistory = (historyItem) => {
    if (historyItem.response_data) {
      const data = historyItem.response_data;
      const normalizedData = data.graph ? { ...data.graph, ...data } : data;
      setGraphData(normalizedData);
      setMode(historyItem.mode);

      if (!showChat) {
        setHasNewResponse(true);
      }

      toast.success("Restored from history");
    } else {
      toast.info("No data available in history");
    }
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
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <main className="workspace" data-testid="main-workspace" style={{ position: 'relative' }}>
          {loading && (
            <div className="loading-overlay" data-testid="loading-indicator">
              <div className="spinner"></div>
              <p>Generating Knowledge Graph...</p>
              <p className="loading-sub">Analyzing Concepts...</p>
            </div>
          )}

          {mode === 'programming' ? (
            <ProgrammingView
              code={programmingCode}
              setCode={setProgrammingCode}
              onGenerateGraph={generateGraph}
              graphData={graphData}
              loading={loading}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
              externalSelectedNode={externalSelectedNode}
            />
          ) : graphData.nodes.length > 0 ? (
            <>
              <AnimatePresence>
                {showChat && (
                  <motion.div
                    className="chat-overlay-container"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  >
                    <div className="chat-panel-header">
                      <h3>Explanation</h3>
                      <button className="chat-close-btn" onClick={() => setShowChat(false)}>
                        <X size={20} />
                      </button>
                    </div>
                    <TextResponsePanel
                      graphData={graphData}
                      selectedNode={externalSelectedNode}
                      onNodeClick={handleTextNodeClick}
                      onExpandConcept={handleExpandConcept}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <VisualJourney
                graphData={graphData}
                onNodeClick={handleNodeClick}
              />

              {mode === "query" && (
                <motion.button
                  className={`floating-chat-btn ${hasNewResponse ? 'glow' : ''}`}
                  onClick={() => {
                    setShowChat(!showChat);
                    setHasNewResponse(false);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <MessageSquare size={24} />
                  {hasNewResponse && <span className="notification-dot" />}
                </motion.button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Knowledge Graph Yet</h3>
              <p>Enter a query or upload a document to generate<br />knowledge graph and explanation</p>
            </div>
          )}
        </main>

        {/* Bottom Input Bar - Query Mode Only */}
        {
          mode === "query" && (
            <BottomInputBar
              onSubmit={(query) => generateGraph(query, "query")}
              loading={loading}
              disabled={backendStatus !== "connected"}
            />
          )
        }

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
      </div >

      <Toaster position="bottom-right" />
    </div >
  );
}

export default App;
