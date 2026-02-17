import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './GraphLoadingAnimation.css';

const NODE_LABELS = [
    "Analyzing...",
    "Extracting...",
    "Mapping...",
    "Linking...",
    "Synthesizing...",
    "Optimizing...",
    "Categorizing..."
];

const ICONS = {
    concept: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v8m0 0l-4-4m4 4l4-4M5 22h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v13a2 2 0 002 2z" />
        </svg>
    ),
    logic: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    ),
    data: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
    ),
    code: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
        </svg>
    )
};

const SkeletonCard = ({ x, y, type = 'concept', label = '' }) => (
    <motion.div
        className="skeleton-card pill colored-node"
        initial={{ opacity: 0, scale: 0.8, x: x - 75, y: y - 18 }}
        animate={{ opacity: 1, scale: 1, x: x - 75, y: y - 18 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
    >
        <div className="card-inner-construction">
            <div className={`skeleton-icon-box ${type}`}>{ICONS[type]}</div>
            <div className="skeleton-text-content">
                <span className="node-status-label">{label}</span>
                <div className="shimmer-line" />
            </div>
        </div>
    </motion.div>
);

const SkeletonLine = ({ x1, y1, x2, y2, id }) => (
    <svg className="skeleton-edge-container" style={{ pointerEvents: 'none' }}>
        <motion.path
            key={`path-${id}`}
            d={`M ${x1} ${y1} Q ${(x1 + x2) / 2 + 30} ${(y1 + y2) / 2} ${x2} ${y2}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
        />
    </svg>
);

const INITIAL_NODES = [
    { id: 'root', x: 300, y: 60, type: 'concept', parent: null, label: 'Root Concept' }
];

const GraphLoadingAnimation = ({ mode = 'query' }) => {
    const [nodes, setNodes] = useState(INITIAL_NODES);

    useEffect(() => {
        const spawnInterval = setInterval(() => {
            setNodes(prevNodes => {
                let nextNodes = [...prevNodes];

                if (nextNodes.length >= 7) {
                    // Smooth pruning
                    nextNodes.splice(1, 1);
                }

                const parent = nextNodes[Math.floor(Math.random() * nextNodes.length)];
                const nodeType = ['concept', 'logic', 'data', 'code'][Math.floor(Math.random() * 4)];

                let newNode = null;
                let attempts = 0;
                const MIN_DISTANCE = 110; // Increased distance to prevent overlap

                while (attempts < 8) {
                    const testNode = {
                        id: `node-${Date.now()}-${attempts}`,
                        x: parent.x + (Math.random() * 340 - 170),
                        y: parent.y + 140 + (Math.random() * 40),
                        type: nodeType,
                        label: NODE_LABELS[Math.floor(Math.random() * NODE_LABELS.length)],
                        parent: { x: parent.x, y: parent.y }
                    };

                    // Constraints to stay in view
                    if (testNode.x < 130) testNode.x = 160;
                    if (testNode.x > 470) testNode.x = 440;

                    // Collision check against all existing nodes
                    const isOverlapping = nextNodes.some(node => {
                        const dx = node.x - testNode.x;
                        const dy = node.y - testNode.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        return dist < MIN_DISTANCE;
                    });

                    if (!isOverlapping || attempts === 7) {
                        newNode = testNode;
                        if (!isOverlapping) break; // Found a good spot
                    }
                    attempts++;
                }

                if (newNode.y > 520) {
                    return INITIAL_NODES; // Reset if too deep
                }

                return [...nextNodes, newNode];
            });
        }, 1500);

        return () => clearInterval(spawnInterval);
    }, []);

    if (mode !== 'query') {
        return (
            <div className="graph-loading-container minimal">
                <div className="minimal-loader">
                    <motion.div
                        className="minimal-bar"
                        animate={{ width: ["0%", "100%", "0%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <p className="loading-subtitle">Processing Data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="graph-loading-container">
            <div className="graph-loading-content">
                <div className="skeleton-construction-area">
                    <AnimatePresence>
                        {nodes.map(node => node.parent && (
                            <SkeletonLine
                                key={`edge-${node.id}`}
                                id={node.id}
                                x1={node.parent.x}
                                y1={node.parent.y}
                                x2={node.x}
                                y2={node.y}
                            />
                        ))}
                    </AnimatePresence>

                    <AnimatePresence>
                        {nodes.map(node => (
                            <SkeletonCard
                                key={node.id}
                                x={node.x}
                                y={node.y}
                                type={node.type}
                                label={node.label}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default GraphLoadingAnimation;
