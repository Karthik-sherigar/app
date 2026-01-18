import React from "react";
import { motion } from "framer-motion";
import { X, Lightbulb, List } from "lucide-react";

export default function ExplanationPanel({ data, onClose }) {
  return (
    <motion.div
      className="explanation-panel"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      data-testid="explanation-panel"
    >
      <div className="explanation-overlay" onClick={onClose} />
      
      <div className="explanation-content">
        <div className="explanation-header">
          <h3>Simple Explanation</h3>
          <button 
            className="close-btn"
            onClick={onClose}
            data-testid="close-explanation-btn"
          >
            <X size={20} />
          </button>
        </div>

        <div className="explanation-body">
          <div className="explanation-section">
            <div className="section-icon">
              <Lightbulb size={24} />
            </div>
            <div className="section-content">
              <h4>Simple Explanation</h4>
              <p data-testid="simple-explanation">{data.simple}</p>
            </div>
          </div>

          <div className="explanation-section">
            <div className="section-icon analogy">
              💡
            </div>
            <div className="section-content">
              <h4>Analogy</h4>
              <p data-testid="analogy-explanation">{data.analogy}</p>
            </div>
          </div>

          <div className="explanation-section">
            <div className="section-icon">
              <List size={24} />
            </div>
            <div className="section-content">
              <h4>Step-by-Step</h4>
              <ol className="steps-list" data-testid="steps-list">
                {data.steps?.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
