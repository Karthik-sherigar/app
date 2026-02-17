import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import NodeCard from './NodeCard';
import ShapeNode from './ShapeNode';
import ConnectionPath from './ConnectionPath';
import { calculateVerticalLayout } from './utils/layoutAlgorithm';
import './VisualJourney.css';

const VisualJourney = ({ graphData, onNodeClick, isDialogMode = false }) => {
    const [layout, setLayout] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        if (graphData && graphData.nodes && graphData.nodes.length > 0) {
            const verticalLayout = calculateVerticalLayout(graphData.nodes, graphData.edges || []);
            setLayout(verticalLayout);
        }
    }, [graphData]);

    const handleNodeClick = (node, index) => {
        setSelectedNode(node);
        if (onNodeClick) {
            // Pass node, its index, and the full sibling list for dialog navigation
            onNodeClick(node, index, layout);
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
                    <h2>Start Your Expedition</h2>
                    <p>Enter a query to generate your master journey</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className={`visual-journey winding-path ${isDialogMode ? 'dialog-mode' : ''}`} id="visual-journey-root">
            {/* Expedition Header */}
            {!isDialogMode && (
                <motion.div
                    className="journey-header"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="premium-badge">KNOWLEDGE EXPEDITION</div>
                    <h1 className="journey-title">The Master Journey</h1>
                    <p className="journey-subtitle">A serpentine path through the architecture of {graphData.nodes[0]?.label || 'the concept'}</p>
                    <div className="scroll-indicator-v2">
                        <div className="mouse-wheel"></div>
                        <span>DESCEND INTO THE ARCHITECTURE</span>
                    </div>
                </motion.div>
            )}

            {/* Path Container */}
            <div className="journey-path-v3">
                {/* SVG Railroad Layer - The "Train Path" */}
                <svg
                    className="railroad-svg-layer"
                    viewBox={`0 0 1400 ${layout.length * 660}`}
                    style={{ height: `${layout.length * 660}px` }}
                >
                    {layout.map((node, index) => {
                        if (index === layout.length - 1) return null;

                        // Row height is calculated by card height (540) + gap (120) = 660
                        const rowHeight = 660;
                        const side = index % 2 === 0 ? 'left' : 'right';
                        const nextSide = (index + 1) % 2 === 0 ? 'left' : 'right';

                        // X Coordinates: center weights for staggered cards
                        // In Dialog Mode, it's more narrow
                        const startX = isDialogMode ?
                            (side === 'left' ? "30%" : "70%") :
                            (side === 'left' ? "22.5%" : "77.5%");

                        const endX = isDialogMode ?
                            (nextSide === 'left' ? "30%" : "70%") :
                            (nextSide === 'left' ? "22.5%" : "77.5%");

                        // SVG coords need units or pixels. We'll use a viewBox or percentage strings if supported, 
                        // but let's use a standard 1400px width based coordinate system for the SVG.
                        const startPx = side === 'left' ? 320 : 1080;
                        const endPx = nextSide === 'left' ? 320 : 1080;
                        const startPy = index * rowHeight + 270;
                        const endPy = (index + 1) * rowHeight + 270;

                        return (
                            <ConnectionPath
                                key={`path-${index}`}
                                startPylon={{ x: startPx, y: startPy }}
                                endPylon={{ x: endPx, y: endPy }}
                                color={node.type === 'prerequisite' ? '#f59e0b' : '#6366f1'}
                            />
                        );
                    })}
                </svg>

                {/* Nodes rendered in a strictly alternating staggered list */}
                {layout.map((node, index) => {
                    const side = index % 2 === 0 ? 'left' : 'right';

                    return (
                        <div key={node.id} className={`node-row row-${side}`}>
                            <div className="station-pylon">
                                <div className="pylon-pulse"></div>
                                <span className="pylon-number">{index + 1}</span>
                            </div>

                            <motion.div
                                className="winding-node-wrapper"
                                initial={{ opacity: 0, x: side === 'left' ? -150 : 150 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.8, delay: 0.1, type: "spring", stiffness: 40 }}
                            >
                                {isDialogMode ? (
                                    <ShapeNode
                                        node={node}
                                        onClick={() => handleNodeClick(node, index)}
                                    />
                                ) : (
                                    <NodeCard
                                        node={node}
                                        onClick={() => handleNodeClick(node, index)}
                                    />
                                )}
                            </motion.div>
                        </div>
                    );
                })}

                {/* Conclusion Section */}
                {!isDialogMode && (
                    <motion.div
                        className="journey-conclusion-v3"
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="conclusion-card">
                            <div className="conclusion-badge">GOAL REACHED</div>
                            <h3>Expedition Success</h3>
                            <p>You have mastered the {layout.length} stations of this journey.</p>
                            <button className="btn-return-home" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                                BACK TO TOP
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default VisualJourney;
