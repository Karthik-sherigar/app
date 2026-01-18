import React from "react";
import { motion } from "framer-motion";
import { X, Maximize2, MessageCircle, ChevronRight } from "lucide-react";

export default function NodeDetailsPanel({ node, onClose, onExpand, onExplain, graphData }) {
  const connectedEdges = graphData.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id
  );

  const importanceLabels = {
    1: "Basic",
    2: "Important", 
    3: "Critical"
  };

  return (
    <motion.div
      className="node-details-panel"
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ duration: 0.3 }}
      data-testid="node-details-panel"
    >
      <div className="panel-overlay" onClick={onClose} />
      
      <div className="panel-content">
        <div className="panel-header">
          <h3 data-testid="node-label">{node.label}</h3>
          <button 
            className="close-btn"
            onClick={onClose}
            data-testid="close-panel-btn"
          >
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          <div className="node-info-item">
            <span className="info-label">Type</span>
            <span className={`node-type-badge ${node.type}`} data-testid="node-type">
              {node.type}
            </span>
          </div>

          {node.description && (
            <div className="node-info-item">
              <span className="info-label">Description</span>
              <p className="info-value" data-testid="node-description">{node.description}</p>
            </div>
          )}

          <div className="node-info-item">
            <span className="info-label">Importance</span>
            <div className="importance-level">
              {[1, 2, 3].map((level) => (
                <div 
                  key={level}
                  className={`importance-dot ${level <= (node.importance || 1) ? 'active' : ''}`}
                />
              ))}
              <span className="importance-text" data-testid="node-importance">
                {importanceLabels[node.importance || 1]}
              </span>
            </div>
          </div>

          {connectedEdges.length > 0 && (
            <div className="node-info-item">
              <span className="info-label">Connected Edges ({connectedEdges.length})</span>
              <div className="edge-list" data-testid="connected-edges">
                {connectedEdges.slice(0, 5).map((edge, idx) => (
                  <div key={idx} className="edge-item">
                    <ChevronRight size={14} />
                    <span className="edge-relation">{edge.relation}</span>
                    <span className="edge-target">
                      {edge.source === node.id 
                        ? graphData.nodes.find(n => n.id === edge.target)?.label 
                        : graphData.nodes.find(n => n.id === edge.source)?.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel-actions">
          <button 
            className="panel-btn primary"
            onClick={onExpand}
            data-testid="expand-node-btn"
          >
            <Maximize2 size={16} />
            Expand Node
          </button>
          <button 
            className="panel-btn secondary"
            onClick={onExplain}
            data-testid="explain-node-btn"
          >
            <MessageCircle size={16} />
            Explain Node
          </button>
        </div>
      </div>
    </motion.div>
  );
}
