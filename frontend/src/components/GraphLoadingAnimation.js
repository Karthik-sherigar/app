import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Network, Database, Brain, Cpu, Zap, Activity } from 'lucide-react';
import './GraphLoadingAnimation.css';

const VERBS = [
    "Analyzing context",
    "Extracting entities",
    "Mapping binary logic",
    "Synthesizing knowledge",
    "Organizing concepts",
    "Generating tree"
];

const PDF_VERBS = [
    "Ingesting document",
    "Extracting content",
    "Analyzing structure",
    "Identifying sections",
    "Mapping relationships",
    "Generating knowledge tree"
];

const ICONS = [Network, Database, Brain, Cpu, Zap, Activity];

// Binary Tree Layout: 1 Root -> 2 Children
const TREE_NODES = [
    // Root
    { id: 'n1', x: 380, y: 120, icon: 2, lines: ['short'] },
    // Level 1
    { id: 'n2', x: 250, y: 280, icon: 0, lines: ['long', 'short'] },
    { id: 'n3', x: 510, y: 280, icon: 1, lines: ['long', 'short'] },
];

const TREE_EDGES = [
    { source: 'n1', target: 'n2', delay: 0.6 },
    { source: 'n1', target: 'n3', delay: 0.8 },
];

const SkeletonNode = ({ x, y, icon, lines, delay }) => {
    const Icon = ICONS[icon % ICONS.length];
    return (
        <motion.div
            className="skeleton-node"
            style={{ 
                left: x, 
                top: y
            }}
            initial={{ opacity: 0, scale: 0.8, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            transition={{ duration: 0.6, delay: delay, ease: "easeOut" }}
        >
            <div className="skeleton-node-shimmer" />
            <div className="skeleton-icon-box">
                <Icon size={14} />
            </div>
            <div className="skeleton-text-lines">
                {lines.map((len, i) => (
                    <div key={i} className={`skeleton-line ${len}`} />
                ))}
            </div>
        </motion.div>
    );
};

const SkeletonEdge = ({ sourceId, targetId, delay }) => {
    const sourceNode = TREE_NODES.find(n => n.id === sourceId);
    const targetNode = TREE_NODES.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) return null;

    const x1 = sourceNode.x;
    const y1 = sourceNode.y + 24; // Bottom of source
    const x2 = targetNode.x;
    const y2 = targetNode.y - 24; // Top of target

    // Cubic bezier for sweeping organic curve
    // Add a tiny jitter to x2 if x1 === x2 to ensure linearGradient (objectBoundingBox) doesn't collapse
    const safeX2 = x1 === x2 ? x2 + 0.01 : x2;
    const pathD = `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${safeX2} ${(y1 + y2) / 2}, ${safeX2} ${y2}`;

    return (
        <g>
            {/* Ghost Track */}
            <motion.path
                d={pathD}
                className="skeleton-edge-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: delay }}
            />
            {/* Energy flow beam overlay */}
            <motion.path
                d={pathD}
                className="skeleton-edge-flow"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: delay,
                    ease: "easeInOut",
                    times: [0, 0.6, 1]
                }}
            />
        </g>
    );
};

const GraphLoadingAnimation = ({ mode = 'query' }) => {
    const [verbIndex, setVerbIndex] = useState(0);
    const currentVerbs = mode === 'pdf' ? PDF_VERBS : VERBS;

    // Swap text every 2s
    useEffect(() => {
        const interval = setInterval(() => {
            setVerbIndex((prev) => (prev + 1) % currentVerbs.length);
        }, 2200);
        return () => clearInterval(interval);
    }, [currentVerbs.length]);

    if (mode !== 'query' && mode !== 'pdf') {
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
            <div className="tree-glow-bg" />

            <div className="skeleton-tree-wrapper">
                {/* SVG Curves Layer */}
                <svg className="skeleton-edge-container" viewBox="0 0 800 500">
                    <defs>
                        <linearGradient id="data-flow-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(99, 102, 241, 0)" />
                            <stop offset="50%" stopColor="rgba(99, 102, 241, 1)" />
                            <stop offset="100%" stopColor="rgba(139, 92, 246, 0.8)" />
                        </linearGradient>
                    </defs>
                    {TREE_EDGES.map((edge, idx) => (
                        <SkeletonEdge key={idx} sourceId={edge.source} targetId={edge.target} delay={edge.delay} />
                    ))}
                </svg>

                {/* Glassmorphic Nodes Layer */}
                {TREE_NODES.map((node, idx) => (
                    <SkeletonNode
                        key={node.id}
                        x={node.x}
                        y={node.y}
                        icon={node.icon}
                        lines={node.lines}
                        delay={idx * 0.25}
                    />
                ))}
            </div>

            <div className="loading-status-overlay">
                <div className="typewriter-status">
                    {currentVerbs[verbIndex]}
                    <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GraphLoadingAnimation;
