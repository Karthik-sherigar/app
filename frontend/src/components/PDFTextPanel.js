import React from 'react';
import { motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import './PDFTextPanel.css';

const PDFTextPanel = ({ text, onClose }) => {
    if (!text) return null;

    return (
        <motion.div 
            className="pdf-text-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
        >
            <div className="panel-header">
                <div className="header-title">
                    <FileText size={18} />
                    <span>Extracted Artifact Content</span>
                </div>
                <button className="close-panel-btn" onClick={onClose}>
                    <X size={18} />
                </button>
            </div>
            <div className="panel-body">
                <div className="extracted-text-content">
                    {text.split('\n').map((para, i) => para.trim() && (
                        <p key={i}>{para}</p>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

export default PDFTextPanel;
