import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  // Exploration Stack for Deep-Dives
  const [explorationStack, setExplorationStack] = useState([]); // [{ concept, data, graph, index, siblings }]

  // Navigation within the stack
  const pushExploration = async (node, index = null, siblings = null) => {
    setLoading(true);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.post(`${API}/generate-graph`, {
          query: `Construct a specialized Knowledge Expedition through the sub-architecture of: ${node.label}. Identify 8-12 distinct technical 'stations' that explore its inner logic, data flow, and functional components in a sequential roadmap. Each station should be a unique sub-concept.`,
          mode: "query"
        });

        const newEntry = {
          concept: node,
          data: response.data,
          graph: response.data.graph || { nodes: [], edges: [] },
          index: index,
          siblings: siblings
        };

        setExplorationStack(prev => [...prev, newEntry]);
        toast.success(`Station Discovered: ${node.label}`);
        setLoading(false);
        return; // Success
      } catch (e) {
        attempts++;
        if (attempts < maxAttempts) {
          toast.warning(`Expedition Delayed (Quota). Retrying in 5s... (${attempts}/${maxAttempts})`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          toast.error(`Access Denied to Station: ${node.label}`);
          console.error(e);
        }
      }
    }
    setLoading(false);
  };

  const navigateSibling = (direction) => {
    const currentEntry = explorationStack[explorationStack.length - 1];
    if (!currentEntry || !currentEntry.siblings) return;

    const nextIndex = direction === 'next' ? currentEntry.index + 1 : currentEntry.index - 1;
    if (nextIndex >= 0 && nextIndex < currentEntry.siblings.length) {
      // Pop current level and push next sibling to replace it
      setExplorationStack(prev => prev.slice(0, -1));
      pushExploration(currentEntry.siblings[nextIndex], nextIndex, currentEntry.siblings);
    } else {
      toast.info(`End of the station line reached.`);
    }
  };

  const popExploration = () => {
    setExplorationStack(prev => prev.slice(0, -1));
  };

  const clearExploration = () => {
    setExplorationStack([]);
  };

  useEffect(() => {
    checkBackendHealth();
    fetchHistory();
  }, []);

  // Mode Isolation: Reset graph when switching modes
  useEffect(() => {
    setGraphData({ nodes: [], edges: [] });
    setSelectedNode(null);
    setShowNodePanel(false);
    setShowExplanation(false);
    setShowChat(false);
    setHasNewResponse(false);
    clearExploration();
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
    clearExploration();
    toast.info("Map cleared.");
  }, []);

  const handleNodeClick = React.useCallback((node, index = null, siblings = null) => {
    if (mode === 'query') {
      // Trigger full-page Deep-Dive
      pushExploration(node, index, siblings);
    } else {
      setSelectedNode(node);
      setShowNodePanel(true);
      setExternalSelectedNode(node?.id);
    }
  }, [mode]);

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
          ) : (loading || graphData.nodes.length > 0) ? (
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
                <OrganicTreeGraph
                  graphData={graphData}
                  onNodeClick={handleNodeClick}
                  selectedNode={externalSelectedNode}
                  mode={mode}
                  loading={loading}
                />
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

        {mode === "query" && (
          <BottomInputBar
            onSubmit={(query) => generateGraph(query, "query")}
            loading={loading}
            disabled={backendStatus !== "connected"}
          />
        )}

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
