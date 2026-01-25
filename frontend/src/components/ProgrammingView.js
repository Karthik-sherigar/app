import React, { useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
    Play,
    FileCode,
    Trash2,
    Maximize2,
    Minimize2,
    FolderOpen,
    Info,
    X,
    ChevronUp,
    ChevronDown
} from "lucide-react";
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
    const fileInputRef = useRef(null);

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
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className="resize-handle">
                    <div className="handle-line" />
                </PanelResizeHandle>

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
                                <>
                                    <GraphCanvas
                                        graphData={graphData}
                                        onNodeClick={onNodeClick}
                                        selectedNode={selectedNode}
                                        externalSelectedNode={externalSelectedNode}
                                    />

                                    {/* AI Explanation Overlay */}
                                    <div className={`explanation-overlay ${showExplanation ? 'expanded' : 'collapsed'}`}>
                                        <div className="overlay-header" onClick={() => setShowExplanation(!showExplanation)}>
                                            <div className="header-left">
                                                <Info size={16} className="text-accent" />
                                                <span>AI Analysis Summary</span>
                                            </div>
                                            {showExplanation ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                        </div>
                                        <AnimatePresence>
                                            {showExplanation && (
                                                <motion.div
                                                    className="overlay-body"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                >
                                                    <p>{graphData.answer}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </>
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
                                <GraphCanvas
                                    graphData={graphData}
                                    onNodeClick={onNodeClick}
                                    selectedNode={selectedNode}
                                    externalSelectedNode={externalSelectedNode}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
