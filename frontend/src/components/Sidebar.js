import React, { useState } from "react";
import { Upload, Send, Trash2, MessageCircle, History, FileText, Menu } from "lucide-react";
import { useDropzone } from "react-dropzone";
import Editor from "@monaco-editor/react";

export default function Sidebar({
  mode,
  generateGraph,
  generateGraphFromPDF,
  explainConfusion,
  resetGraph,
  history,
  restoreFromHistory,
  loading
}) {
  const [query, setQuery] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [code, setCode] = useState("");

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (files) => setPdfFile(files[0])
  });

  const handleSubmit = () => {
    if (mode === "query" && query.trim()) {
      generateGraph(query, "query");
    } else if (mode === "pdf" && pdfFile) {
      generateGraphFromPDF(pdfFile);
    } else if (mode === "programming" && code.trim()) {
      generateGraph(code, "programming");
    }
  };

  const handleClear = () => {
    setQuery("");
    setPdfFile(null);
    setCode("");
  };

  return (
    <aside className={`sidebar ${mode === "query" ? "query-mode" : ""}`} data-testid="sidebar">
      {/* Menu Icon for Query Mode (always visible when collapsed) */}
      {mode === "query" && (
        <div className="sidebar-menu-icon">
          <Menu size={24} />
        </div>
      )}

      {/* Input Section - Only for PDF and Programming modes */}
      {mode !== "query" && (
        <div className="sidebar-section">
          <h3 className="section-title">INPUT</h3>

          {mode === "pdf" && (
            <div className="input-container" data-testid="pdf-input-container">
              <div {...getRootProps()} className="dropzone" data-testid="pdf-dropzone">
                <input {...getInputProps()} />
                <Upload size={32} />
                <p>Drag & drop PDF here</p>
                <p className="dropzone-hint">or click to browse</p>
              </div>

              {pdfFile && (
                <div className="file-preview" data-testid="pdf-preview">
                  <FileText size={20} />
                  <span>{pdfFile.name}</span>
                  <button onClick={() => setPdfFile(null)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!pdfFile || loading}
                data-testid="generate-pdf-graph-btn"
              >
                <Send size={16} />
                Generate Graph from PDF
              </button>
            </div>
          )}

          {mode === "programming" && (
            <div className="input-container" data-testid="code-input-container">
              <div className="code-editor-wrapper">
                <Editor
                  height="200px"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false
                  }}
                />
              </div>
              <div className="button-group">
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={!code.trim() || loading}
                  data-testid="visualize-code-btn"
                >
                  <Send size={16} />
                  Visualize Code Logic
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleClear}
                  data-testid="clear-code-btn"
                >
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-section">
        <h3 className="section-title"><span>ACTIONS</span></h3>
        <div className="action-buttons">
          <button
            className="btn-action"
            onClick={explainConfusion}
            data-testid="explain-confusion-btn"
          >
            <MessageCircle size={16} />
            <span>Explain Confusion</span>
          </button>
          <button
            className="btn-action"
            onClick={resetGraph}
            data-testid="reset-graph-btn"
          >
            <RotateCcw size={16} />
            <span>Reset Graph</span>
          </button>
          <button
            className="btn-action"
            onClick={() => {
              const canvas = document.querySelector('.cy-container canvas');
              if (canvas) {
                canvas.toBlob((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'knowledge-graph.png';
                  a.click();
                });
              }
            }}
            data-testid="export-graph-btn"
          >
            <Download size={16} />
            <span>Export PNG</span>
          </button>
        </div>
      </div>

      <div className="sidebar-section history-section">
        <h3 className="section-title">
          <History size={16} />
          <span>RECENT HISTORY</span>
        </h3>
        <div className="history-list" data-testid="history-list">
          {history
            .filter(item => item.mode === mode)
            .map((item) => (
              <div
                key={item.id}
                className="history-item"
                onClick={() => restoreFromHistory(item)}
                data-testid={`history-item-${item.id}`}
              >
                <div className="history-preview">{item.preview}</div>
                <div className="history-meta">
                  <span className="history-mode">{item.mode}</span>
                  <span className="history-time">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          {history.filter(item => item.mode === mode).length === 0 && (
            <p className="empty-state">No history for this mode yet</p>
          )}
        </div>
      </div>
    </aside>
  );
}

// Import missing icon
import { RotateCcw, Download } from "lucide-react";
