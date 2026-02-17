import React from 'react';
import { motion } from 'framer-motion';
import { getIconForType } from './VisualJourney/utils/iconMapper';
import './TreeNodeCard.css';

const TreeNodeCard = ({ node, onClick, level = 0 }) => {
    const Icon = getIconForType(node.type);

    const typeThemes = {
        concept: '#6366f1',
        prerequisite: '#f59e0b',
        application: '#22c55e',
        component: '#0ea5e9',
        codeblock: '#ec4899',
        documentsection: '#d946ef',
        decision: '#ef4444',
        logicphase: '#10b981',
        datastore: '#f97316'
    };
    const themeColor = typeThemes[node.type?.toLowerCase()] || '#6366f1';

    // Width based on level
    const widthMap = {
        0: 380,  // Root
        1: 340,  // Level 1
        2: 300   // Level 2+
    };
    const width = widthMap[Math.min(level, 2)] || 300;

    return (
        <motion.div
            className="tree-node-text"
            style={{ width: `${width}px`, cursor: 'pointer' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.6,
                delay: level * 0.15,
                ease: [0.22, 1, 0.36, 1]
            }}
            whileHover={{
                scale: 1.02,
                boxShadow: `0 8px 30px ${themeColor}40`
            }}
            onClick={() => onClick && onClick(node)}
        >
            {/* SVG Icon Placeholder */}
            <motion.div
                className="svg-icon-placeholder"
                style={{
                    background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`,
                    borderColor: `${themeColor}50`
                }}
                whileHover={{ scale: 1.05 }}
            >
                <Icon size={level === 0 ? 28 : 24} color={themeColor} />
                <div className="icon-label">SVG</div>
            </motion.div>

            {/* Main Concept Heading */}
            <h3
                className="concept-heading"
                style={{
                    fontSize: level === 0 ? '18px' : '16px',
                    color: '#ffffff'
                }}
            >
                {node.label}
            </h3>

            {/* Description */}
            <p className="concept-description">
                {node.description || `Complete description with more detailed with points and highlights about ${node.label}. This provides comprehensive insights into the fundamental concepts and technical aspects.`}
            </p>
        </motion.div>
    );
};

export default TreeNodeCard;
