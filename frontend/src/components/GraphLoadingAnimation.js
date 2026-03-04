import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Network, Database, Brain, Cpu, Zap, Activity, Code, Terminal, Brackets, Layers, Workflow } from 'lucide-react';
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

const PROGRAMMING_VERBS = [
    "Parsing source code",
    "Identifying functions",
    "Mapping control flow",
    "Analyzing logic branches",
    "Constructing logic tree",
    "Finalizing visualization"
];

const ICONS = [Network, Database, Brain, Cpu, Zap, Activity];
const PROGRAMMING_ICONS = [Code, Terminal, Brackets, Cpu, Layers, Workflow];

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

const ProgrammingSkeleton = () => {
    return (
        <div className="programming-skeleton-container">
            <div className="code-matrix-bg">
                {[...Array(10)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="code-column"
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 500, opacity: [0, 0.5, 0] }}
                        transition={{
                            duration: 5 + Math.random() * 5,
                            repeat: Infinity,
                            delay: Math.random() * 5,
                            ease: "linear"
                        }}
                    >
                        {Math.random().toString(2).substring(2, 15)}
                    </motion.div>
                ))}
            </div>
            <div className="logic-flow-visual">
                <motion.div
                    className="main-processor"
                    animate={{
                        boxShadow: [
                            "0 0 20px rgba(99, 102, 241, 0.2)",
                            "0 0 40px rgba(99, 102, 241, 0.5)",
                            "0 0 20px rgba(99, 102, 241, 0.2)"
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Cpu size={32} className="text-indigo-400" />
                    <div className="processing-rings">
                        <div className="ring" />
                        <div className="ring" />
                    </div>
                </motion.div>

                <div className="data-points">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="data-node"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                                scale: [0, 1, 0],
                                opacity: [0, 1, 0],
                                rotate: [0, 180, 360]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                delay: i * 0.5,
                                ease: "easeInOut"
                            }}
                        >
                            {React.createElement(PROGRAMMING_ICONS[i % PROGRAMMING_ICONS.length], { size: 16 })}
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const GraphLoadingAnimation = ({ mode = 'query' }) => {
    const [verbIndex, setVerbIndex] = useState(0);
    const currentVerbs = mode === 'pdf' ? PDF_VERBS : (mode === 'programming' ? PROGRAMMING_VERBS : VERBS);

    // Swap text every 2s
    useEffect(() => {
        const interval = setInterval(() => {
            setVerbIndex((prev) => (prev + 1) % currentVerbs.length);
        }, 2200);
        return () => clearInterval(interval);
    }, [currentVerbs.length]);

    if (mode !== 'query' && mode !== 'pdf' && mode !== 'programming') {
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
                {mode === 'programming' ? (
                    <ProgrammingSkeleton />
                ) : (
                    <>
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
                    </>
                )}
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
