import React, { useState } from "react";
import { Upload, Send, Trash2, History, FileText, Menu, Download, ChevronLeft, ChevronRight, Plus, Ghost, MessageCircle, RotateCcw } from "lucide-react";
import { useDropzone } from "react-dropzone";
import Editor from "@monaco-editor/react";

function Sidebar({
  mode,
  generateGraph,
  generateGraphFromPDF,
  handleNewQuery,
  handleTemporaryQuery,
  deleteAllHistory,
  explainConfusion,
  resetGraph,
  history,
  restoreFromHistory,
  deleteHistoryItem,
  onShowFullHistory,
  loading,
  isCollapsed,
  setIsCollapsed
}) {
  const [pdfFile, setPdfFile] = useState(null);
  const [code, setCode] = useState("");

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (files) => setPdfFile(files[0])
  });

  const handleSubmit = () => {
    if (mode === "pdf" && pdfFile) {
      generateGraphFromPDF(pdfFile);
    } else if (mode === "programming" && code.trim()) {
      generateGraph(code, "programming");
    }
  };

  const handleClear = () => {
    setPdfFile(null);
    setCode("");
  };

  const handleDeleteHistory = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this chat?")) {
      deleteHistoryItem(id);
    }
  };

  return (
    <aside
      className={`sidebar ${mode === "query" ? "query-mode-autohide" : ""} ${mode === "pdf" ? "pdf-mode-autohide" : ""} ${mode === "programming" ? "programming-mode-autohide" : ""} ${isCollapsed && mode !== "query" && mode !== "pdf" && mode !== "programming" ? "collapsed" : ""}`}
      data-testid="sidebar"
    >
      {/* Manual Toggle - Only for modes that don't autohide */}
      {mode !== "query" && mode !== "pdf" && mode !== "programming" && (
        <div className="sidebar-toggle-container">
          <button
            className="sidebar-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      )}

      <div className="sidebar-content">
        {/* INPUT SECTION - Restricted to Programming */}
        {mode === "programming" && (
          <div className="sidebar-section">
            <h3 className="section-title">
              <FileText size={16} />
              <span>INPUT</span>
            </h3>

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
          </div>
        )}

        {/* ACTIONS SECTION */}
        <div className="sidebar-section">
          <h3 className="section-title">
            <Menu size={16} />
            <span>ACTIONS</span>
          </h3>
          <div className="action-buttons">
            {mode === 'query' ? (
              <>
                <button
                  className="btn-action"
                  onClick={handleNewQuery}
                  data-testid="new-query-btn"
                >
                  <Plus size={16} />
                  <span>New Query</span>
                </button>
                <button
                  className="btn-action"
                  onClick={handleTemporaryQuery}
                  data-testid="temporary-query-btn"
                  title="Starts a temporary session that won't be saved"
                >
                  <Ghost size={16} />
                  <span>Temporary Query</span>
                </button>
                <button
                  className="btn-action"
                  onClick={() => {
                    window.dispatchEvent(new Event('export-organic-graph'));
                  }}
                  data-testid="export-graph-btn"
                >
                  <Download size={16} />
                  <span>Export Graph</span>
                </button>
              </>
            ) : mode === 'pdf' ? (
              <>
                <button
                  className="btn-action"
                  onClick={handleNewQuery}
                  data-testid="new-pdf-btn"
                >
                  <Plus size={16} />
                  <span>New Upload</span>
                </button>
                <button
                  className="btn-action"
                  onClick={handleTemporaryQuery}
                  data-testid="temporary-pdf-btn"
                >
                  <Ghost size={16} />
                  <span>Temporary Upload</span>
                </button>
                <button
                  className="btn-action"
                  onClick={() => {
                    const canvas = document.querySelector('.cy-container canvas') || document.querySelector('.organic-tree-container');
                    if (canvas) {
                      // Generic export logic
                      window.dispatchEvent(new Event(mode === 'query' ? 'export-organic-graph' : 'export-graph-snapshot'));
                    }
                  }}
                  data-testid="export-pdf-btn"
                >
                  <Download size={16} />
                  <span>Export Graph</span>
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* HISTORY SECTION */}
        <div className="sidebar-section history-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              <History size={16} />
              <span>RECENT HISTORY</span>
            </h3>
            {(mode === 'query' || mode === 'pdf') && history.filter(h => h.mode === mode).length > 0 && (
              <button
                className="delete-all-history-btn"
                onClick={deleteAllHistory}
                title="Delete All History"
                style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '4px' }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="history-list" data-testid="history-list">
            {history
              .filter(item => item.mode === mode)
              .slice(0, mode === 'query' ? 10 : undefined)
              .map((item) => (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => restoreFromHistory(item)}
                  data-testid={`history-item-${item.id}`}
                >
                  <div className="history-item-content">
                    <div className="history-preview-classic">{item.preview}</div>
                    <div className="history-meta">
                      <span className="history-mode-tag">{item.mode}</span>
                      <span className="history-time">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  {(mode === 'query' || mode === 'pdf') && (
                    <button
                      className="delete-history-btn"
                      onClick={(e) => handleDeleteHistory(e, item.id)}
                      title="Delete History"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

            {history.filter(item => item?.mode === mode).length === 0 && (
              <p className="empty-state">No history for this mode yet</p>
            )}
          </div>

          {mode === 'query' && history.filter(item => item?.mode === 'query').length > 10 && (
            <button
              className="load-history-link"
              onClick={(e) => {
                console.log("Load History button clicked in Sidebar");
                onShowFullHistory();
              }}
            >
              Load History
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default React.memo(Sidebar);
