import React from 'react';
import { motion } from 'framer-motion';
import { getIconForType } from './VisualJourney/utils/iconMapper';
import './TreeNodeCard.css';

const TreeNodeCard = ({ node, onClick, level = 0 }) => {
    const Icon = getIconForType(node.type);

    // Glowing vibrant themes inspired by the reference image
    const typeThemes = {
        concept: { main: '#4f46e5', glow: '#6366f1' },       // Deep Indigo -> Bright Indigo
        prerequisite: { main: '#db2777', glow: '#ec4899' },   // Deep Pink -> Bright Pink
        application: { main: '#059669', glow: '#10b981' },    // Emerald
        component: { main: '#0284c7', glow: '#0ea5e9' },      // Light Blue
        codeblock: { main: '#7c3aed', glow: '#8b5cf6' },      // Violet
        documentsection: { main: '#c026d3', glow: '#d946ef' },// Fuchsia
        decision: { main: '#e11d48', glow: '#f43f5e' },       // Rose
        logicphase: { main: '#0891b2', glow: '#06b6d4' },     // Cyan
        datastore: { main: '#ea580c', glow: '#f97316' }       // Orange
    };
    const theme = typeThemes[node.type?.toLowerCase()] || typeThemes.concept;

    // Fixed optimal width for horizontal cards
    const width = 340;

    return (
        <motion.div
            className="tree-node-card-glass"
            style={{
                width: `${width}px`,
                cursor: 'pointer',
                '--theme-glow': theme.glow,
                '--theme-main': theme.main
            }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                duration: 0.6,
                delay: level * 0.15,
                ease: [0.22, 1, 0.36, 1]
            }}
            whileHover={{
                scale: 1.03,
                boxShadow: `0 0 30px ${theme.glow}40, inset 0 0 20px ${theme.main}20`
            }}
            onClick={() => onClick && onClick(node)}
            data-testid={`node-${node.id}`}
        >
            <div className="glass-capsule-content">
                {/* Left Side: Squircle Icon with deep glow */}
                <motion.div
                    className="icon-squircle"
                    style={{
                        background: `linear-gradient(135deg, ${theme.main}40, ${theme.main}10)`,
                        boxShadow: `0 0 15px ${theme.glow}40 inset, 0 0 10px ${theme.glow}20`,
                        border: `1px solid ${theme.glow}50`
                    }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                >
                    <Icon size={22} color={theme.glow} strokeWidth={2.5} />
                </motion.div>

                {/* Right Side: Text Container */}
                <div className="node-text-content">
                    <h3 className="node-title" style={{ textShadow: `0 0 10px ${theme.glow}80` }}>
                        {node.label}
                    </h3>
                    <p className="node-snippet">
                        {node.description ? node.description.length > 55 ? node.description.substring(0, 55) + '...' : node.description : 'Explore technical constraints and mechanisms...'}
                    </p>
                </div>
            </div>

            {/* Ambient Background Glow Layer */}
            <div className="ambient-node-glow" style={{ background: theme.main }}></div>
        </motion.div>
    );
};

export default TreeNodeCard;
