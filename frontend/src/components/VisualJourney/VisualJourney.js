import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import NodeCard from './NodeCard';
import ConnectionPath from './ConnectionPath';
import { calculateVerticalLayout } from './utils/layoutAlgorithm';
import './VisualJourney.css';

const VisualJourney = ({ graphData, onNodeClick }) => {
    const [layout, setLayout] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        if (graphData && graphData.nodes && graphData.nodes.length > 0) {
            const verticalLayout = calculateVerticalLayout(graphData.nodes, graphData.edges || []);
            setLayout(verticalLayout);
        }
    }, [graphData]);

    const handleNodeClick = (node) => {
        setSelectedNode(node);
        if (onNodeClick) {
            onNodeClick(node);
        }
    };

    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        return (
            <div className="visual-journey-empty">
                <motion.div
                    className="empty-state"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="empty-icon">🚀</div>
                    <h2>Start Your Learning Journey</h2>
                    <p>Enter a query to generate a beautiful knowledge map</p>
                </motion.div>
            </div>
        );
    }

    // Group nodes by depth for vertical layout
    const nodesByDepth = {};
    layout.forEach(node => {
        const depth = node.position.depth;
        if (!nodesByDepth[depth]) {
            nodesByDepth[depth] = [];
        }
        nodesByDepth[depth].push(node);
    });

    const depths = Object.keys(nodesByDepth).sort((a, b) => a - b);

    return (
        <div className="visual-journey">
            {/* Header */}
            <motion.div
                className="journey-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <h1 className="journey-title">Your Learning Journey</h1>
                <p className="journey-subtitle">Scroll down to explore concepts</p>
                <div className="scroll-indicator">
                    <motion.div
                        className="scroll-arrow"
                        animate={{ y: [0, 10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        ↓
                    </motion.div>
                </div>
            </motion.div>

            {/* Journey path */}
            <div className="journey-path">
                {/* Vertical timeline line */}
                <div className="timeline-line" />

                {/* SVG for connections */}
                <svg className="connections-svg" viewBox="0 0 1200 5000" preserveAspectRatio="xMidYMin meet">
                    {graphData.edges && graphData.edges.map((edge, index) => (
                        <ConnectionPath
                            key={`${edge.source}-${edge.target}-${index}`}
                            edge={edge}
                            sourceNode={layout.find(n => n.id === edge.source)}
                            targetNode={layout.find(n => n.id === edge.target)}
                        />
                    ))}
                </svg>

                {/* Nodes grouped by depth */}
                {depths.map((depth, depthIndex) => {
                    const nodesAtDepth = nodesByDepth[depth];
                    const isMultiple = nodesAtDepth.length > 1;

                    return (
                        <motion.div
                            key={depth}
                            className="depth-section"
                            style={{
                                '--depth-index': depthIndex
                            }}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: depthIndex * 0.1 }}
                        >
                            {/* Depth indicator */}
                            <div className="depth-marker">
                                <span className="depth-number">{parseInt(depth) + 1}</span>
                            </div>

                            {/* Nodes container */}
                            <div className={`nodes-container ${isMultiple ? 'multiple' : 'single'}`}>
                                {nodesAtDepth.map((node, index) => (
                                    <NodeCard
                                        key={node.id}
                                        node={node}
                                        onClick={handleNodeClick}
                                        style={{
                                            '--node-index': index,
                                            '--total-nodes': nodesAtDepth.length
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    );
                })}

                {/* End marker */}
                <motion.div
                    className="journey-end"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                >
                    <div className="end-icon">🎯</div>
                    <h3>Journey Complete!</h3>
                    <p>You've explored all concepts</p>
                </motion.div>
            </div>

            {/* Progress indicator */}
            <div className="progress-indicator">
                <div className="progress-bar" />
            </div>
        </div>
    );
};

export default VisualJourney;
