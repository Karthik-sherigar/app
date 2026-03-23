import React from "react";
import { Send, Trash2, History, FileText, Menu, Download, Plus, Ghost } from "lucide-react";
import Editor from "@monaco-editor/react";

/**
 * Dedicated Sidebar for Programming Mode
 * 
 * Features:
 * - Persistent Code Editor for input
 * - Actions: New Program, Temporary Session, Export Flow
 * - History: Recent programs with individual and bulk delete
 */
function ProgrammingSidebar({
  handleNewQuery,
  handleTemporaryQuery,
  deleteAllHistory,
  history,
  restoreFromHistory,
  deleteHistoryItem,
  loading,
  isMobileOpen,
  setMobileOpen
}) {
  const mode = "programming";

  const handleDeleteHistory = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this program from history?")) {
      deleteHistoryItem(id);
    }
  };

  return (
    <>
      {isMobileOpen && (
        <div className="sidebar-mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`sidebar programming-mode-autohide ${isMobileOpen ? "mobile-open" : ""}`}
        data-testid="programming-sidebar"
      >
        <div className="sidebar-content">
          {/* ACTIONS SECTION */}
          <div className="sidebar-section">
            <h3 className="section-title">
              <Menu size={16} />
              <span>ACTIONS</span>
            </h3>
            <div className="action-buttons">
              <button
                className="btn-action"
                onClick={handleNewQuery}
                data-testid="new-program-btn"
              >
                <Plus size={16} />
                <span>New Program</span>
              </button>
              <button
                className="btn-action"
                onClick={handleTemporaryQuery}
                data-testid="temporary-program-btn"
                title="Starts a temporary session that won't be saved"
              >
                <Ghost size={16} />
                <span>Temporary Mode</span>
              </button>
              <button
                className="btn-action"
                onClick={() => {
                   // Try to export the main logic flow graph
                   window.dispatchEvent(new Event('export-organic-graph'));
                }}
                data-testid="export-program-btn"
              >
                <Download size={16} />
                <span>Export Flow</span>
              </button>
            </div>
          </div>

          {/* HISTORY SECTION */}
          <div className="sidebar-section history-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                <History size={16} />
                <span>RECENT PROGRAMS</span>
              </h3>
              {history.filter(h => h.mode === mode).length > 0 && (
                <button
                  className="delete-all-history-btn"
                  onClick={deleteAllHistory}
                  title="Delete All Programming History"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="history-list" data-testid="programming-history-list">
              {history
                .filter(item => item.mode === mode)
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
                        <span className="history-time">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <button
                      className="delete-history-btn"
                      onClick={(e) => handleDeleteHistory(e, item.id)}
                      title="Delete History"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

              {history.filter(item => item?.mode === mode).length === 0 && (
                <p className="empty-state">No programs yet</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default React.memo(ProgrammingSidebar);
