import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import GraphCanvas from "./components/GraphCanvas";
import OrganicTreeGraph from "./components/OrganicTreeGraph";
import VisualJourney from "./components/VisualJourney/VisualJourney";
import NodeDetailsPanel from "./components/NodeDetailsPanel";
import ExplanationPanel from "./components/ExplanationPanel";
import TextResponsePanel from "./components/TextResponsePanel";
import ProgrammingView from "./components/ProgrammingView";
import BottomInputBar from "./components/BottomInputBar";
import HistoryDialog from "./components/HistoryDialog";
import "./components/HistoryDialog.css";
import { Toaster, toast } from "sonner";
import { MessageSquare, X } from "lucide-react";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import SkeletonLoader from "./components/SkeletonLoader";
import NodeExplorationItem from "./components/NodeExplorationItem";

import { useLocation } from "react-router-dom";
import ExplorationPage from "./components/ExplorationPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const location = useLocation(); // Hook for route checking
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
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [nodeExplanation, setNodeExplanation] = useState(null); // Deprecated in favor of stack, but keeping for transition? No, removing.
  // Actually, let's keep nodeExplanation just as a "current loading" placeholder if needed, but better to use stack.

  // NEW STATE
  const [explorationStack, setExplorationStack] = useState([]);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [nodeExplanationLoading, setNodeExplanationLoading] = useState(false);
  const [nodeExploreTab, setNodeExploreTab] = useState('text');

  const fetchFullHistory = async () => {
    if (historyLoading) return;
    console.log("Fetching full history...");
    setShowHistoryDialog(true);
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API}/history?limit=100&include_data=false`);
      console.log("Full history received:", response.data);
      setHistory(response.data);
    } catch (e) {
      console.error("Failed to load full history:", e);
      toast.error("Failed to load full history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Mode Isolation: Reset graph when switching modes
  useEffect(() => {
    setGraphData({ nodes: [], edges: [] });
    setSelectedNode(null);
    setShowNodePanel(false);
    setShowExplanation(false);
    setShowChat(false);
    setHasNewResponse(false);
    setExplorationStack([]);
    setCurrentHistoryId(null);
  }, [mode]);

  const checkBackendHealth = useCallback(async () => {
    try {
      await axios.get(`${API}/health`);
      setBackendStatus("connected");
    } catch (e) {
      setBackendStatus("error");
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
    fetchHistory();
  }, [checkBackendHealth, fetchHistory]);

  const generateGraph = async (query, selectedMode) => {
    setLoading(true);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.post(`${API}/generate-graph`, {
          query,
          mode: selectedMode || mode
        });

        const data = response.data;
        // Merge graph data with metadata like 'answer' and 'sections'
        const normalizedData = data.graph ? { ...data, nodes: data.graph.nodes, edges: data.graph.edges } : data;
        setGraphData(normalizedData);
        setSelectedNode(null);
        setShowNodePanel(false);
        setHasNewResponse(true);
        setLoading(false);

        // NEW: Set History ID and Clear Stack
        setCurrentHistoryId(data.historyId);
        setExplorationStack([]);

        fetchHistory(); // Refresh history
        return; // Success
      } catch (e) {
        attempts++;
        if (attempts < maxAttempts) {
          toast.warning(`Expedition Delayed (Quota). Retrying in 5s... (${attempts}/${maxAttempts})`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          toast.error("Failed to generate knowledge graph. Please check your query or try again later.");
          setGraphData({ nodes: [], edges: [] });
        }
      }
    }
    setLoading(false);
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

      toast.success("Document architecture extracted!");
      fetchHistory();
    } catch (e) {
      toast.error("Failed to process document structure.");
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

      setGraphData(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...response.data.nodes],
        edges: [...prev.edges, ...response.data.edges]
      }));
      toast.success("Satellite concepts deployed!");
    } catch (e) {
      toast.error("Node expansion failed.");
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
      toast.error("Failed to resolve concept confusion.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetGraph = useCallback(() => {
    setGraphData({ nodes: [], edges: [] });
    setSelectedNode(null);
    setShowNodePanel(false);
    setShowExplanation(false);
    setExplorationStack([]);
    setCurrentHistoryId(null);
    toast.info("Map cleared.");
  }, []);

  const handleNodeClick = React.useCallback((node) => {
    // Standard click handler
    setSelectedNode(node);
    setExternalSelectedNode(node?.id);
  }, []);

  const handleTextNodeClick = React.useCallback((nodeId) => {
    const node = graphData.nodes?.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setExternalSelectedNode(nodeId);
    }
  }, [graphData]);

  const handleExpandConcept = async (nodeId) => {
    const node = graphData.nodes?.find(n => n.id === nodeId);
    if (node) {
      await expandNode(node.id, node.label);
    }
  };

  const restoreFromHistory = async (historyItem) => {
    try {
      let dataToRestore = historyItem.response_data;

      // If data is missing (lite record), fetch it now
      if (!dataToRestore) {
        setLoading(true);
        const response = await axios.get(`${API}/history/${historyItem.id}`);
        dataToRestore = response.data.response_data;
        setLoading(false);
      }

      if (dataToRestore) {
        const normalizedData = dataToRestore.graph ? { ...dataToRestore.graph, ...dataToRestore } : dataToRestore;
        setGraphData(normalizedData);
        setMode(historyItem.mode);

        // NEW: Restore Stack and ID
        setExplorationStack(dataToRestore.explorationStack || []);
        setCurrentHistoryId(historyItem.id);

        if (!showChat) {
          setHasNewResponse(true);
        }
        toast.success("Expedition history restored.");
      }
    } catch (e) {
      console.error("Restoration failed:", e);
      setLoading(false);
      toast.error("Failed to restore history.");
    }
  };

  const deleteHistoryItem = async (id) => {
    try {
      await axios.delete(`${API}/history/${id}`);
      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success("Chat history removed.");
    } catch (e) {
      toast.error("Failed to delete history item.");
      console.error(e);
    }
  };

  // ROUTING CHECK
  if (location.pathname.startsWith('/explore')) {
    return <ExplorationPage />;
  }

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
              toast.error("Identify a station first.");
            }
          }}
          resetGraph={resetGraph}
          history={history}
          restoreFromHistory={restoreFromHistory}
          deleteHistoryItem={deleteHistoryItem}
          onShowFullHistory={fetchFullHistory}
          loading={loading}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <main
          className={`workspace ${loading ? 'no-scroll' : ''}`}
          data-testid="main-workspace"
          style={{ position: 'relative' }}
        >

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
          ) : (loading || graphData.nodes?.length > 0) ? (
            <>
              <AnimatePresence>
                {showChat && (
                  <motion.div
                    className="floating-chat-panel"
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", damping: 25 }}
                  >
                    <div className="chat-header">
                      <h3>AI Analysis</h3>
                      <button onClick={() => setShowChat(false)} className="close-chat-btn">
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

              {/* Main Graph Visualization */}
              {mode === 'query' ? (
                <>
                  <OrganicTreeGraph
                    graphData={graphData}
                    onNodeClick={handleNodeClick}
                    onExploreNode={async (nodeData) => {
                      if (!nodeData) return;

                      // Check if already in stack
                      const existingIndex = explorationStack.findIndex(item => item.nodeId === nodeData.id);
                      if (existingIndex !== -1) {
                        document.getElementById(`explanation-${nodeData.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        toast.info("Station already explored.");
                        return;
                      }

                      setNodeExplanationLoading(true);
                      // Scroll to loading area (bottom)
                      setTimeout(() => {
                        document.querySelector('.node-explore-loading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);

                      try {
                        const res = await fetch('/api/explain-node', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            nodeId: nodeData.id,
                            nodeLabel: nodeData.label,
                            context: nodeData.description || ''
                          })
                        });

                        if (res.ok) {
                          const data = await res.json();

                          // Flexible data handling
                          if (!data.textResponse && (data.content || data.response || data.message)) {
                            const text = data.content || data.response || data.message;
                            if (typeof text === 'string') {
                              data.textResponse = { overview: text };
                            } else if (typeof text === 'object') {
                              data.textResponse = text;
                            }
                          }

                          // Validate response
                          if (data && (data.textResponse || data.explanation || data.answer)) {
                            const newExplanation = {
                              ...data,
                              nodeId: nodeData.id,
                              nodeLabel: nodeData.label,
                              timestamp: Date.now()
                            };

                            // Update Stack
                            const newStack = [...explorationStack, newExplanation];
                            setExplorationStack(newStack);

                            // PERSIST to History
                            if (currentHistoryId) {
                              axios.put(`${API}/history/${currentHistoryId}`, {
                                ...graphData,
                                explorationStack: newStack
                              }).catch(err => console.error("Failed to auto-save history:", err));
                            }
                          } else {
                            console.error("Invalid explanation data format.");
                            toast.error("Received invalid data from station.");
                          }
                        } else {
                          toast.error('Failed to load explanation.');
                        }
                      } catch (e) {
                        console.error('Node explanation error:', e);
                        toast.error('Failed to load explanation.');
                      } finally {
                        setNodeExplanationLoading(false);
                      }
                    }}
                    selectedNode={externalSelectedNode}
                    mode={mode}
                    loading={loading}
                  />

                  {/* Below-graph exploration section — Stacked Explanations */}
                  <div className="exploration-stack">
                    {explorationStack.map((exp, index) => (
                      <NodeExplorationItem key={exp.nodeId || index} data={exp} />
                    ))}

                    {nodeExplanationLoading && (
                      <div className="node-explore-section node-explore-loading">
                        <SkeletonLoader />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <GraphCanvas
                  graphData={graphData}
                  onNodeClick={handleNodeClick}
                  selectedNode={externalSelectedNode}
                  mode={mode}
                  loading={loading}
                />
              )}

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
              <div className="empty-icon">🗺️</div>
              <h3>Expedition Not Started</h3>
              <p>Enter a query to map your learning path<br />or upload a data source.</p>
            </div>
          )}

        </main>

        {mode === "query" && graphData.nodes.length === 0 && (
          <BottomInputBar
            onSubmit={(query) => generateGraph(query, "query")}
            loading={loading}
            disabled={backendStatus !== "connected"}
          />
        )}


        <AnimatePresence>
          {showExplanation && explanationData && (
            <ExplanationPanel
              data={explanationData}
              onClose={() => setShowExplanation(false)}
            />
          )}
        </AnimatePresence>
      </div>

      <Toaster position="bottom-right" theme="dark" />



      <AnimatePresence>
        {showHistoryDialog && (
          <HistoryDialog
            isOpen={showHistoryDialog}
            onClose={() => setShowHistoryDialog(false)}
            history={history}
            onRestore={restoreFromHistory}
            onDelete={deleteHistoryItem}
            mode={mode}
            isLoading={historyLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWrapper;
