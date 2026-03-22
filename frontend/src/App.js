import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "@/App.css";
import { loader } from "@monaco-editor/react";

// Pre-configure Monaco to use a stable CDN version and prevent worker loading errors on mode switch
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs"
  },
});
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
import { Loader2 } from "lucide-react";
import { MessageSquare, X } from "lucide-react";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import SkeletonLoader from "./components/SkeletonLoader";
import NodeExplorationItem from "./components/NodeExplorationItem";

import { useLocation, useNavigate } from "react-router-dom";
import ExplorationPage from "./components/ExplorationPage";
import PDFExplorationPage from "./components/PDFExplorationPage";
import PDFUploadLanding from "./components/PDFUploadLanding";
import PDFTextPanel from "./components/PDFTextPanel";
import PDFLearningPath from "./components/PDFLearningPath";
import GraphLoadingAnimation from "./components/GraphLoadingAnimation";
import PDFLoadingAnimation from "./components/PDFLoadingAnimation";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import QueryLanding from "./components/QueryLanding";

// Legal Pages
import PrivacyPage from "./components/legal/PrivacyPage";
import TermsPage from "./components/legal/TermsPage";
import SecurityPage from "./components/legal/SecurityPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

function App() {
  const location = useLocation(); // Hook for route checking
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("authenticated") === "true" || false;
  });

  // Extract initial state from URL to fundamentally prevent UI page flashing (Home Page -> Loader)
  const getInitialMode = () => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('restoreMode')) return searchParams.get('restoreMode');
    if (searchParams.get('mode')) return searchParams.get('mode');
    if (location.pathname === '/query') return 'query';
    if (location.pathname === '/pdf') return 'pdf';
    if (location.pathname === '/programming') return 'programming';

    // Check old style parameter mapping
    const qp = new URLSearchParams(window.location.search);
    if (qp.get("mode")) return qp.get("mode");
    return null;
  };

  const getInitialLoading = () => {
    const searchParams = new URLSearchParams(location.search);
    return !!(searchParams.get('restoreMode') && searchParams.get('historyId'));
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mode, setMode] = useState(getInitialMode);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [loading, setLoading] = useState(getInitialLoading);
  const [isRestoringFromDb, setIsRestoringFromDb] = useState(getInitialLoading);
  const [backendStatus, setBackendStatus] = useState("loading");
  const [history, setHistory] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationData, setExplanationData] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("overview");
  const [externalSelectedNode, setExternalSelectedNode] = useState(null);
  const [activeQuery, setActiveQuery] = useState("");
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
  const [isTemporary, setIsTemporary] = useState(false);
  const [pdfText, setPdfText] = useState("");

  // Refs for async callbacks
  const graphDataRef = useRef(graphData);
  const currentHistoryIdRef = useRef(currentHistoryId);
  const explorationStackRef = useRef(explorationStack);

  useEffect(() => { graphDataRef.current = graphData; }, [graphData]);
  useEffect(() => { currentHistoryIdRef.current = currentHistoryId; }, [currentHistoryId]);
  useEffect(() => { explorationStackRef.current = explorationStack; }, [explorationStack]);

  // IMPORTANT: URL State Restoration Observer
  // Ensures returning from explore modes or refreshing doesn't lose your place
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const restoreMode = searchParams.get('restoreMode');
    const initHistoryId = searchParams.get('historyId');
    const initMode = searchParams.get('mode');

    if (restoreMode && initHistoryId) {
      const loadHistoryFromUrl = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${API}/history/${initHistoryId}`);
          const historyItem = response.data;
          const dataToRestore = historyItem.response_data;

          if (dataToRestore) {
            isRestoringRef.current = true; // Lock out the canvas wiper!

            const normalizedData = dataToRestore.graph ? { ...dataToRestore.graph, ...dataToRestore } : dataToRestore;

            // Bypass prevent-clear logic by setting mode directly first
            setMode(historyItem.mode || restoreMode);
            prevModeRef.current = historyItem.mode || restoreMode;

            setGraphData(normalizedData);
            setActiveQuery(historyItem.query || "Restored Session");
            setExplorationStack(dataToRestore.explorationStack || []);
            setCurrentHistoryId(historyItem.id);
            toast.success("Expedition restored from URL.");

            setTimeout(() => {
              isRestoringRef.current = false;
            }, 150);
          }
        } catch (e) {
          console.error("Failed to restore history from URL:", e);
          // If the history is gone, at least default to the requested mode
          setMode(restoreMode);
          prevModeRef.current = restoreMode;
          setIsRestoringFromDb(false);
        } finally {
          setLoading(false);
          setIsRestoringFromDb(false);
        }
      };
      // Short timeout to guarantee mode swap doesn't clear our data asynchronously
      setTimeout(loadHistoryFromUrl, 50);

    } else if (initMode) {
      if (!window.location.pathname.startsWith('/explore')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setMode(initMode);
      prevModeRef.current = initMode;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount!

  // Natively sync the active database session into the URL so that browser refreshes perfectly restore the user's workspace
  useEffect(() => {
    if (window.location.pathname.startsWith('/explore')) return;

    if (currentHistoryId && mode && mode !== 'null') {
      const targetUrl = `/${mode}?restoreMode=${mode}&historyId=${currentHistoryId}`;
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.replaceState(null, '', targetUrl);
      }
    } else if (!currentHistoryId && mode) {
      // Clear history tracking if we start a fresh session but keep mode
      if (window.location.search.includes('historyId')) {
        window.history.replaceState(null, '', `/${mode}`);
      }
    }
  }, [currentHistoryId, mode]);

  const fetchFullHistory = async () => {
    if (historyLoading) return;
    console.log("Fetching full history...");
    setShowHistoryDialog(true);
    setHistoryLoading(true);
    try {
      const email = localStorage.getItem("userEmail");
      const response = await axios.get(`${API}/history`, {
        params: { limit: 100, include_data: false, mode, user_email: email }
      });
      console.log("Full history received:", response.data);
      setHistory(response.data);
    } catch (e) {
      console.error("Failed to load full history:", e);
      toast.error("Failed to load full history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleModeChange = (newMode) => {
    // Synchronously clear data used by other components
    setGraphData({ nodes: [], edges: [] });
    setSelectedNode(null);
    setShowNodePanel(false);
    setShowExplanation(false);
    setShowChat(false);
    setExplorationStack([]);
    setCurrentHistoryId(null);
    if (!newMode) {
      navigate('/');
    } else {
      navigate(`/${newMode}`);
    }
  };

  // Sync mode state with route changes directly for Back button and Logo clicks!
  useEffect(() => {
    if (isRestoringRef.current) return; // Prevent async route delays from interfering with manual history restoration

    if (location.pathname === '/' || location.pathname === '/login') {
      if (mode !== null) setMode(null);
    } else if (location.pathname === '/query') {
      if (mode !== 'query') setMode('query');
    } else if (location.pathname === '/pdf') {
      if (mode !== 'pdf') setMode('pdf');
    } else if (location.pathname === '/programming') {
      if (mode !== 'programming') setMode('programming');
    }
  }, [location.pathname, mode]);


  // Mode Isolation: Secondary fallback reset
  // Track previous mode to prevent accidental clearing
  const prevModeRef = useRef(mode);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    // Only clear if the mode actually changed and we aren't loading new data for the current mode
    if (prevModeRef.current !== mode) {
      if (isRestoringRef.current) {
        console.log(`Bypassing canvas wipe during restoration to ${mode}.`);
        prevModeRef.current = mode;
        return;
      }
      console.log(`Mode changing from ${prevModeRef.current} to ${mode}. Clearing workspace.`);
      setGraphData({ nodes: [], edges: [] });
      setHasNewResponse(false);
      prevModeRef.current = mode;
    }
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
      const email = localStorage.getItem("userEmail");
      const response = await axios.get(`${API}/history`, {
        params: { mode, user_email: email }
      });
      setHistory(response.data);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }, [mode]);

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
        const email = localStorage.getItem("userEmail");
        const response = await axios.post(`${API}/generate-graph`, {
          query,
          mode: selectedMode || mode,
          is_temporary: isTemporary,
          user_email: email
        }, { timeout: 120000 });

        const data = response.data;
        // Merge graph data with metadata like 'answer' and 'sections'
        const normalizedData = data.graph ? { ...data, nodes: data.graph.nodes || [], edges: data.graph.edges || [] } : data;
        setGraphData(normalizedData);
        setSelectedNode(null);
        setShowNodePanel(false);
        setHasNewResponse(true);
        setLoading(false);

        // NEW: Set History ID and Clear Stack
        setCurrentHistoryId(data.historyId);
        setExplorationStack([]);
        setActiveQuery(query);

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
      const email = localStorage.getItem("userEmail");
      if (email) formData.append("user_email", email);

      const response = await axios.post(`${API}/generate-graph-from-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const data = response.data;
      console.log("PDF Response Data:", data);

      const nodes = data.nodes || data.graph?.nodes || [];
      const edges = data.edges || data.graph?.edges || [];

      console.log(`Setting PDF Graph State: ${nodes.length} nodes, ${edges.length} edges`);

      const finalGraph = {
        nodes: nodes,
        edges: edges,
        title: data.title || (file ? `PDF: ${file.name}` : "Document Analysis")
      };

      // Order matters: Set mode first, then data to avoid race with effects
      setMode("pdf");
      setGraphData(finalGraph);
      setPdfText(data.extracted_text || "");
      setActiveQuery(finalGraph.title);
      setSelectedNode(null);
      setShowNodePanel(false);

      if (data.historyId) setCurrentHistoryId(data.historyId);

      setHasNewResponse(true);
      toast.success("Document roadmap generated!");
      fetchHistory();
    } catch (e) {
      const errorMessage = e.response?.data?.detail || "Failed to process document structure.";
      toast.error(errorMessage);
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
        mode: mode,
        current_graph: { nodes: graphData.nodes || [], edges: graphData.edges || [] },
        context_code: mode === 'programming' ? programmingCode : null
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
    setPdfText("");
  }, []);

  const handleNewQuery = useCallback(() => {
    resetGraph();
    setIsTemporary(false);
    toast.info("New chart initialized.");
  }, [resetGraph]);

  const handleTemporaryQuery = useCallback(() => {
    resetGraph();
    setIsTemporary(true);
    toast.info("Temporary mode active. Queries won't be saved to DB.");
  }, [resetGraph]);

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
    const node = (graphData.nodes || []).find(n => n.id === nodeId);
    if (node) {
      await expandNode(node.id, node.label);
    }
  };

  const restoreFromHistory = async (historyItem) => {
    try {
      setIsRestoringFromDb(true);
      setLoading(true);
      // ALWAYS fetch fresh data from the server because the stack may have been updated
      const response = await axios.get(`${API}/history/${historyItem.id}`);
      let dataToRestore = response.data.response_data;
      setLoading(false);
      setIsRestoringFromDb(false);

      if (dataToRestore) {
        const targetMode = historyItem.mode || 'query';
        // Block the canvas-wipe useEffect from running!
        isRestoringRef.current = true;

        // Synchronously jump the route first
        navigate(`/${targetMode}`);

        // Immediately sync the underlying ref tracker so the wiping useEffect ignores this!
        prevModeRef.current = targetMode;

        const normalizedData = dataToRestore.graph ? { ...dataToRestore.graph, ...dataToRestore } : dataToRestore;
        setGraphData(normalizedData);
        setMode(targetMode);
        setActiveQuery(historyItem.query);

        // NEW: Restore Stack and ID
        setExplorationStack(dataToRestore.explorationStack || []);
        setCurrentHistoryId(historyItem.id);

        if (!showChat) {
          setHasNewResponse(true);
        }

        toast.success("Expedition history restored.");

        // Unlock restoration bypass safely after routing settles
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 150);
      }
    } catch (e) {
      console.error("Restoration failed:", e);
      setLoading(false);
      setIsRestoringFromDb(false);
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

  const deleteAllHistory = async () => {
    try {
      if (window.confirm(`Are you sure you want to delete all history for ${mode} mode?`)) {
        const email = localStorage.getItem("userEmail");
        await axios.delete(`${API}/history`, {
          params: { mode: mode, user_email: email }
        });
        setHistory(prev => prev.filter(h => h.mode !== mode));
        if (mode === "pdf") {
          setPdfText("");
        }
        setExplorationStack([]);
        setCurrentHistoryId(null);
        toast.success(`${mode} history permanently deleted.`);
      }
    } catch (e) {
      toast.error("Failed to delete all history.");
      console.error(e);
    }
  };

  const updateExplorationItem = useCallback((updatedExp) => {
    // We compute the new stack from the ref to avoid stale closure state
    const currentStack = explorationStackRef.current;
    if (!currentStack) return;

    const newStack = currentStack.map(item =>
      item.nodeId === updatedExp.nodeId ? updatedExp : item
    );
    setExplorationStack(newStack);

    // PERSIST safely with refs
    if (currentHistoryIdRef.current && graphDataRef.current) {
      axios.put(`${API}/history/${currentHistoryIdRef.current}`, {
        ...graphDataRef.current,
        explorationStack: newStack
      }).catch(err => console.error("Failed to auto-save history:", err));
    }
  }, []);

  const handleLoginSuccess = () => {
    localStorage.setItem("authenticated", "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("profilePic");
    setIsAuthenticated(false);
    setMode(null);
    setHistory([]);
  };

  // ROUTING CHECK
  // ROUTING CHECK
  const publicPaths = ['/login', '/privacy', '/terms', '/security'];
  if (!isAuthenticated && !publicPaths.includes(location.pathname)) {
    return <LoginPage onLogin={handleLoginSuccess} />;
  }

  if (location.pathname === '/login') {
    return <LoginPage onLogin={handleLoginSuccess} />;
  }

  if (location.pathname.startsWith('/explore')) {
    const searchParams = new URLSearchParams(location.search);
    const routeMode = searchParams.get('mode');

    if (routeMode === 'pdf') {
      return <PDFExplorationPage />;
    }
    return <ExplorationPage />;
  }

  // Legal routes
  if (location.pathname === '/privacy') {
    return <PrivacyPage />;
  }
  if (location.pathname === '/terms') {
    return <TermsPage />;
  }
  if (location.pathname === '/security') {
    return <SecurityPage />;
  }

  return (
    <div className={`app ${theme}`} data-testid="app-container">
      <Navbar
        mode={mode}
        setMode={handleModeChange}
        backendStatus={backendStatus}
        resetGraph={resetGraph}
        theme={theme}
        setTheme={setTheme}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="app-layout">
        {mode !== null && mode !== 'programming' && (
          <Sidebar
            mode={mode}
            isMobileOpen={isMobileSidebarOpen}
            setMobileOpen={setIsMobileSidebarOpen}
            generateGraph={generateGraph}
            generateGraphFromPDF={generateGraphFromPDF}
            handleNewQuery={handleNewQuery}
            handleTemporaryQuery={handleTemporaryQuery}
            deleteAllHistory={deleteAllHistory}
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
        )}

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
              onExpandNode={expandNode}
              selectedNode={selectedNode}
              externalSelectedNode={externalSelectedNode}
            />
          ) : (graphData.nodes && graphData.nodes.length > 0) ? (
            <div key={`graph-${mode}-${currentHistoryId}`} className="graph-workspace-container">
              {mode === 'pdf' ? (
                <PDFLearningPath
                  data={graphData}
                  pdfFilename={activeQuery.startsWith("PDF: ") ? activeQuery.replace("PDF: ", "") : "Document"}
                  onNodeClick={(node) => {
                    window.open(`/explore?nodeId=${node.id}&mode=pdf&label=${encodeURIComponent(node.label)}&historyId=${currentHistoryId}`, '_blank');
                  }}
                />
              ) : (
                <>
                  <OrganicTreeGraph
                    graphData={graphData}
                    activeQuery={activeQuery}
                    onNodeClick={handleNodeClick}
                    onExploreNode={async (nodeData) => {
                      if (!nodeData) return;
                      const existingIndex = explorationStack.findIndex(item => item.nodeId === nodeData.id);
                      if (existingIndex !== -1) {
                        document.getElementById(`explanation-${nodeData.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        toast.info("Station already explored.");
                        return;
                      }
                      setNodeExplanationLoading(true);
                      setTimeout(() => {
                        document.querySelector('.node-explore-loading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                      try {
                        const res = await fetch(`${BACKEND_URL}/api/explain-node`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-mode': mode },
                          body: JSON.stringify({ nodeId: nodeData.id, nodeLabel: nodeData.label, context: nodeData.description || '' })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data && (data.textResponse || data.explanation || data.answer)) {
                            const newExplanation = { ...data, nodeId: nodeData.id, nodeLabel: nodeData.label, rootQuery: activeQuery, timestamp: Date.now() };
                            const newStack = [...explorationStackRef.current, newExplanation];
                            setExplorationStack(newStack);
                            if (currentHistoryIdRef.current) {
                              axios.put(`${API}/history/${currentHistoryIdRef.current}`, { ...graphDataRef.current, explorationStack: newStack }).catch(err => console.error("Auto-save failed:", err));
                            }
                          }
                        }
                      } catch (e) {
                        toast.error('Failed to load explanation.');
                      } finally {
                        setNodeExplanationLoading(false);
                      }
                    }}
                    selectedNode={externalSelectedNode}
                    mode={mode}
                    loading={loading}
                  />
                  <div className="exploration-stack">
                    {explorationStack.map((exp, index) => (
                      <NodeExplorationItem key={exp.nodeId || index} data={exp} onUpdate={updateExplorationItem} mode={mode} />
                    ))}
                    {nodeExplanationLoading && <div className="node-explore-section node-explore-loading"><SkeletonLoader /></div>}
                  </div>
                </>
              )}
              {loading && (
                <div className="workspace-overlay-loader">
                  <GraphLoadingAnimation mode={mode} />
                </div>
              )}
            </div>
          ) : mode === 'pdf' ? (
            loading ? (
              <div className="workspace-centered-loader">
                {isRestoringFromDb ? <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" /> : <PDFLoadingAnimation />}
              </div>
            ) : (
              <PDFUploadLanding
                onUpload={generateGraphFromPDF}
                loading={loading}
              />
            )
          ) : loading ? (
            <div className="workspace-centered-loader">
              <GraphLoadingAnimation mode={mode} />
            </div>
          ) : mode === 'query' ? (
            <QueryLanding />
          ) : (
            <HomePage
              setMode={handleModeChange}
              history={history}
              onLogout={handleLogout}
              onRestore={restoreFromHistory}
            />
          )}

        </main>

        {mode === "query" && (graphData.nodes || []).length === 0 && !loading && (
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
