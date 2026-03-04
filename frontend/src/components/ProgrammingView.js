import React, { useState, useRef } from "react";
import Editor, { loader } from "@monaco-editor/react";
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
    AlertCircle,
    Wand2,
    Sparkles,
    Layout,
    Eraser
} from "lucide-react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import OrganicTreeGraph from "./OrganicTreeGraph";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";

export default function ProgrammingView({
    code,
    setCode,
    onGenerateGraph,
    graphData,
    loading,
    onNodeClick,
    onExpandNode,
    selectedNode,
    externalSelectedNode
}) {
    const [language, setLanguage] = useState("javascript");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showExplanation, setShowExplanation] = useState(true);
    const [executionResult, setExecutionResult] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [isFormatting, setIsFormatting] = useState(false);
    const [terminalInput, setTerminalInput] = useState("");
    const [accumulatedStdin, setAccumulatedStdin] = useState("");
    const terminalBodyRef = useRef(null);
    const fileInputRef = useRef(null);
    const editorRef = useRef(null);

    const runCode = async (overrideStdin = null) => {
        if (!code.trim()) return;
        setIsExecuting(true);
        setShowTerminal(true);

        // Ensure overrideStdin is either a string or specifically null
        const stdinToUse = (typeof overrideStdin === 'string') ? overrideStdin : null;
        const newStdin = stdinToUse !== null ? stdinToUse : (accumulatedStdin + (terminalInput ? terminalInput + "\n" : ""));

        try {
            const apiBase = process.env.REACT_APP_BACKEND_URL || '';
            const response = await axios.post(`${apiBase}/api/execute-code`, {
                code,
                language,
                stdin: newStdin
            });

            let data = response.data;

            // MASKING LOGIC: If the program crashed with NoSuchElementException (EOF), 
            // it's likely just waiting for more input. We mask the error so the user 
            // doesn't see a "crash" mid-session.
            if (!data.success && data.error && (
                data.error.includes("NoSuchElementException") ||
                data.error.includes("EOFError") ||
                data.output.trim().endsWith(":") // Common prompt pattern
            )) {
                data.success = true; // Treat as "waiting" rather than "failed"
                data.error = ""; // Hide the stack trace
            }

            setExecutionResult(data);
            setAccumulatedStdin(newStdin);
            setTerminalInput("");

            if (data.success && !data.error && overrideStdin !== "") {
                if (!data.output.trim().endsWith(":")) {
                    toast.success("Execution complete");
                }
            }
        } catch (e) {
            toast.error("Failed to run code");
            setExecutionResult({ output: "", error: e.message, success: false });
        } finally {
            setIsExecuting(false);
            setTimeout(() => {
                if (terminalBodyRef.current) {
                    terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
                }
                const input = document.querySelector('.terminal-shell-input');
                if (input) input.focus();
            }, 50);
        }
    };

    const formatCode = async () => {
        if (!code.trim() || isFormatting) return;
        setIsFormatting(true);
        try {
            const apiBase = process.env.REACT_APP_BACKEND_URL || '';
            const response = await axios.post(`${apiBase}/api/format-code`, {
                code,
                language
            });
            if (response.data.formatted_code) {
                setCode(response.data.formatted_code);
                toast.success("AI Refactoring Complete", {
                    description: "Code has been formatted and optimized."
                });
            }
        } catch (e) {
            toast.error("AI Formatting Failed");
        } finally {
            setIsFormatting(false);
        }
    };

    const clearTerminal = () => {
        setExecutionResult(null);
        setAccumulatedStdin("");
        setTerminalInput("");
        toast.info("Terminal Cleared");
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

    // Reset terminal session if code or language changes
    React.useEffect(() => {
        setAccumulatedStdin("");
        setExecutionResult(null);
    }, [code, language]);

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
                                    onClick={() => {
                                        setAccumulatedStdin(""); // Reset buffer for fresh analysis
                                        onGenerateGraph(code, "programming");
                                        runCode(""); // Start execution with empty stdin
                                    }}
                                    disabled={!code.trim() || loading}
                                >
                                    <Play size={16} fill="currentColor" />
                                    Analyze & Run
                                </button>
                            </div>
                        </div>

                        <div className="graph-viewer">
                            {(graphData.nodes.length > 0 || loading) ? (
                                <PanelGroup direction="vertical">
                                    <Panel minSize={30}>
                                        <OrganicTreeGraph
                                            graphData={graphData}
                                            onNodeClick={onNodeClick}
                                            onExpandNode={onExpandNode}
                                            selectedNode={selectedNode}
                                            mode="programming"
                                            loading={loading}
                                        />
                                    </Panel>

                                    <PanelResizeHandle className="resize-handle-v">
                                        <div className="handle-line-h" />
                                    </PanelResizeHandle>

                                    <Panel defaultSize={35} minSize={15}>
                                        <div className="logic-summary-panel">
                                            <div className="panel-header" onClick={() => setShowExplanation(!showExplanation)}>
                                                <div className="header-left">
                                                    <Info size={16} className="text-accent" />
                                                    <span>AI LOGIC ANALYSIS SUMMARY</span>
                                                </div>
                                                {showExplanation ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                            </div>
                                            <AnimatePresence mode="wait">
                                                {showExplanation && (
                                                    <motion.div
                                                        className="panel-body"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                    >
                                                        {selectedNode ? (
                                                            <div className="node-detail-focus">
                                                                <div className="node-header">
                                                                    <div className="node-type-tag">{selectedNode.type}</div>
                                                                    <h4>{selectedNode.label}</h4>
                                                                </div>
                                                                <p className="node-description">{selectedNode.description}</p>
                                                                <button
                                                                    className="btn-expand-logic"
                                                                    onClick={() => onExpandNode(selectedNode.id, selectedNode.label)}
                                                                    disabled={loading}
                                                                >
                                                                    <Maximize2 size={14} />
                                                                    Drill Down into Internal Logic
                                                                </button>
                                                                <div className="detail-separator" />
                                                                <div className="general-summary-header">GENERAL ANALYSIS</div>
                                                                <div className="summary-content">
                                                                    {graphData.answer}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="summary-content">
                                                                {graphData.answer || "Select a node to see detailed logic or run analysis to generate the summary."}
                                                            </div>
                                                        )}
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
                                <button
                                    className={`toolbar-btn ${isFormatting ? 'animating' : ''}`}
                                    onClick={() => {
                                        if (editorRef.current) {
                                            // Focus first to ensure the action can run
                                            editorRef.current.focus();
                                            // Trigger the built-in format action which now uses our AI provider
                                            editorRef.current.trigger('editor', 'editor.action.formatDocument');
                                        } else {
                                            formatCode();
                                        }
                                    }}
                                    disabled={isFormatting || !code.trim()}
                                    title="AI Format & Correct (All Languages)"
                                >
                                    {isFormatting ? <Sparkles size={16} className="animate-pulse text-accent" /> : <Wand2 size={16} />}
                                    <span>Format</span>
                                </button>
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
                                <button
                                    className={`toolbar-btn ${showTerminal ? 'active' : ''}`}
                                    onClick={() => setShowTerminal(!showTerminal)}
                                    title="Toggle Terminal"
                                >
                                    <TerminalIcon size={16} />
                                </button>
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
                                        onMount={(editor, monaco) => {
                                            editorRef.current = editor;

                                            // Register Formatting Provider for ALL languages
                                            const languages = ['javascript', 'python', 'java', 'cpp', 'typescript', 'c', 'csharp'];
                                            languages.forEach(lang => {
                                                monaco.languages.registerDocumentFormattingEditProvider(lang, {
                                                    provideDocumentFormattingEdits: async (model) => {
                                                        const currentCode = model.getValue();
                                                        console.log(`Formatting initiated for ${lang}...`);
                                                        setIsFormatting(true); // Sync UI state
                                                        try {
                                                            const apiBase = process.env.REACT_APP_BACKEND_URL || '';
                                                            const response = await axios.post(`${apiBase}/api/format-code`, {
                                                                code: currentCode,
                                                                language: lang
                                                            });
                                                            if (response.data.formatted_code) {
                                                                console.log("Formatting successful");
                                                                toast.success("AI Refactoring Complete");
                                                                return [{
                                                                    range: model.getFullModelRange(),
                                                                    text: response.data.formatted_code
                                                                }];
                                                            }
                                                        } catch (e) {
                                                            console.error("Monaco Format Error:", e);
                                                            toast.error("AI Formatting Failed");
                                                        } finally {
                                                            setIsFormatting(false); // Sync UI state
                                                        }
                                                        return [];
                                                    }
                                                });
                                            });
                                        }}
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
                                                        <span>TERMINAL</span>
                                                    </div>
                                                    <div className="header-right">
                                                        <button
                                                            className="terminal-action-btn"
                                                            onClick={(e) => { e.stopPropagation(); clearTerminal(); }}
                                                            title="Clear Console"
                                                        >
                                                            <Eraser size={14} />
                                                        </button>
                                                        <button className="close-terminal">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="terminal-body" ref={terminalBodyRef}>
                                                    {isExecuting ? (
                                                        <div className="terminal-loading">Running code...</div>
                                                    ) : (
                                                        <>
                                                            <div className="terminal-output-container">
                                                                {executionResult?.output && <pre className="output-stdout">{executionResult.output}</pre>}
                                                                {executionResult?.error && <pre className="output-stderr">{executionResult.error}</pre>}
                                                            </div>

                                                            <div className="terminal-shell-line">
                                                                <span className="terminal-prompt-char">$</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder=""
                                                                    value={terminalInput}
                                                                    onChange={(e) => setTerminalInput(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            runCode();
                                                                        }
                                                                    }}
                                                                    className="terminal-shell-input"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </>
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
                                onClick={() => {
                                    setAccumulatedStdin(""); // Reset session for a fresh run from the main button
                                    runCode("");
                                }}
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
                                    <OrganicTreeGraph
                                        graphData={graphData}
                                        onNodeClick={onNodeClick}
                                        onExpandNode={onExpandNode}
                                        selectedNode={selectedNode}
                                        mode="programming"
                                        loading={loading}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
