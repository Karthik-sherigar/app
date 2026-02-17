import React, { useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
    Play,
    PlayCircle,
    FileCode,
    Trash2,
    Maximize2,
    Minimize2,
    FolderOpen,
    Info,
    X,
    ChevronUp,
    ChevronDown,
    Terminal as TerminalIcon,
    AlertCircle
} from "lucide-react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import GraphCanvas from "./GraphCanvas";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";

export default function ProgrammingView({
    code,
    setCode,
    onGenerateGraph,
    graphData,
    loading,
    onNodeClick,
    selectedNode,
    externalSelectedNode
}) {
    const [language, setLanguage] = useState("javascript");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showExplanation, setShowExplanation] = useState(true);
    const [executionResult, setExecutionResult] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const fileInputRef = useRef(null);

    const runCode = async () => {
        if (!code.trim()) return;
        setIsExecuting(true);
        setShowTerminal(true);
        setExecutionResult(null);
        try {
            const apiBase = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
            const response = await axios.post(`${apiBase}/api/execute-code`, {
                code,
                language
            });
            setExecutionResult(response.data);
            if (response.data.success) {
                toast.success("Execution complete");
            } else {
                toast.error("Execution failed");
            }
        } catch (e) {
            toast.error("Failed to run code");
            setExecutionResult({ output: "", error: e.message, success: false });
        } finally {
            setIsExecuting(false);
        }
    };

    const handleFileOpen = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCode(e.target.result);
                const ext = file.name.split('.').pop();
                const langMap = {
                    'js': 'javascript', 'py': 'python', 'java': 'java',
                    'cpp': 'cpp', 'ts': 'typescript', 'html': 'html',
                    'css': 'css', 'json': 'json'
                };
                if (langMap[ext]) setLanguage(langMap[ext]);
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="programming-view-container">
            <PanelGroup direction="horizontal">
                {/* Graph/Analysis Section - NOW ON THE LEFT */}
                <Panel minSize={30}>
                    <div className="graph-section">
                        <div className="graph-toolbar">
                            <div className="toolbar-left">
                                <span className="toolbar-title">AI GRAPH ANALYSIS</span>
                                {loading && <div className="loading-dot" />}
                            </div>
                            <div className="toolbar-right">
                                <button
                                    className="toolbar-btn"
                                    onClick={() => setIsFullscreen(true)}
                                    disabled={graphData.nodes.length === 0}
                                    title="Fullscreen Mode"
                                >
                                    <Maximize2 size={16} />
                                </button>
                                <button
                                    className="btn-analyze"
                                    onClick={() => onGenerateGraph(code, "programming")}
                                    disabled={!code.trim() || loading}
                                >
                                    <Play size={16} fill="currentColor" />
                                    Analyze
                                </button>
                            </div>
                        </div>

                        <div className="graph-viewer">
                            {graphData.nodes.length > 0 ? (
                                <PanelGroup direction="vertical">
                                    <Panel minSize={30}>
                                        <GraphCanvas
                                            graphData={graphData}
                                            onNodeClick={onNodeClick}
                                            selectedNode={selectedNode}
                                            externalSelectedNode={externalSelectedNode}
                                            mode="programming"
                                        />
                                    </Panel>

                                    <PanelResizeHandle className="resize-handle-v">
                                        <div className="handle-line-h" />
                                    </PanelResizeHandle>

                                    <Panel defaultSize={30} minSize={15}>
                                        <div className="logic-summary-panel">
                                            <div className="panel-header" onClick={() => setShowExplanation(!showExplanation)}>
                                                <div className="header-left">
                                                    <Info size={16} className="text-accent" />
                                                    <span>AI LOGIC ANALYSIS SUMMARY</span>
                                                </div>
                                                {showExplanation ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                            </div>
                                            <AnimatePresence>
                                                {showExplanation && (
                                                    <motion.div
                                                        className="panel-body"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                    >
                                                        <div className="summary-content">
                                                            {graphData.answer}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </Panel>
                                </PanelGroup>
                            ) : (
                                <div className="empty-graph-placeholder">
                                    <div className="placeholder-icon">🤖</div>
                                    <h3>Waiting for Code Analysis</h3>
                                    <p>Write or open code and click "Analyze" to see its logic structure.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className="resize-handle">
                    <div className="handle-line" />
                </PanelResizeHandle>

                {/* Editor Section - NOW ON THE RIGHT */}
                <Panel defaultSize={45} minSize={30}>
                    <div className="editor-section">
                        <div className="editor-toolbar">
                            <div className="toolbar-left">
                                <FileCode size={18} className="text-accent" />
                                <span className="toolbar-title">CODE EDITOR</span>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="language-select"
                                >
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                    <option value="typescript">TypeScript</option>
                                </select>
                            </div>
                            <div className="toolbar-right">
                                <button className="toolbar-btn" onClick={() => fileInputRef.current.click()} title="Open File">
                                    <FolderOpen size={16} />
                                    <span>Open</span>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: "none" }}
                                    onChange={handleFileOpen}
                                />
                                <button className="toolbar-btn text-error" onClick={() => setCode("")} title="Clear Code">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="editor-main">
                            <PanelGroup direction="vertical">
                                <Panel minSize={20}>
                                    <Editor
                                        height="100%"
                                        language={language}
                                        theme="vs-dark"
                                        value={code}
                                        onChange={(val) => setCode(val || "")}
                                        options={{
                                            minimap: { enabled: true },
                                            fontSize: 14,
                                            lineNumbers: "on",
                                            roundedSelection: false,
                                            scrollBeyondLastLine: false,
                                            readOnly: false,
                                            automaticLayout: true,
                                            padding: { top: 10 }
                                        }}
                                    />
                                </Panel>

                                {showTerminal && (
                                    <>
                                        <PanelResizeHandle className="resize-handle-v">
                                            <div className="handle-line-h" />
                                        </PanelResizeHandle>
                                        <Panel defaultSize={30} minSize={15}>
                                            <div className="terminal-section">
                                                <div className="terminal-header" onClick={() => setShowTerminal(false)}>
                                                    <div className="header-left">
                                                        <TerminalIcon size={14} className="text-accent" />
                                                        <span>OUTPUT</span>
                                                    </div>
                                                    <button className="close-terminal">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <div className="terminal-body">
                                                    {isExecuting ? (
                                                        <div className="terminal-loading">Running code...</div>
                                                    ) : executionResult ? (
                                                        <>
                                                            {executionResult.output && <pre className="output-stdout">{executionResult.output}</pre>}
                                                            {executionResult.error && <pre className="output-stderr">{executionResult.error}</pre>}
                                                            {!executionResult.output && !executionResult.error && <div className="terminal-empty">No output</div>}
                                                        </>
                                                    ) : (
                                                        <div className="terminal-empty">Ready to execute...</div>
                                                    )}
                                                </div>
                                            </div>
                                        </Panel>
                                    </>
                                )}
                            </PanelGroup>
                        </div>
                        <div className="editor-footer">
                            <button
                                className={`run-btn ${isExecuting ? 'executing' : ''}`}
                                onClick={runCode}
                                disabled={isExecuting || !code.trim()}
                            >
                                {isExecuting ? (
                                    <div className="run-spinner" />
                                ) : (
                                    <PlayCircle size={16} />
                                )}
                                Run Code
                            </button>
                        </div>
                    </div>
                </Panel>
            </PanelGroup>

            {/* Fullscreen Overlay */}
            <AnimatePresence>
                {isFullscreen && (
                    <motion.div
                        className="fullscreen-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Logic Flow Visualization</h3>
                                <button className="close-modal" onClick={() => setIsFullscreen(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="fullscreen-graph-container">
                                    <GraphCanvas
                                        graphData={graphData}
                                        onNodeClick={onNodeClick}
                                        selectedNode={selectedNode}
                                        externalSelectedNode={externalSelectedNode}
                                        mode="programming"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
