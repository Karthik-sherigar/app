import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TreeNodeCard from './TreeNodeCard';
import NodeExplorationStack from './NodeExplorationStack';
import HorizontalDivider from './HorizontalDivider';
import './OrganicTreeGraph.css';

const OrganicTreeGraph = ({ graphData, onNodeClick, selectedNode, mode, loading }) => {
    const [treeLayout, setTreeLayout] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
    const containerRef = useRef(null);
    const exploreNodeRef = useRef(null); // Store exploration function

    // Build tree hierarchy from graph data
    const buildTreeHierarchy = (nodes, edges) => {
        if (!nodes || nodes.length === 0) return null;

        // Find root node (node with no incoming edges)
        const incomingEdges = new Set(edges.map(e => e.target));
        const root = nodes.find(n => !incomingEdges.has(n.id)) || nodes[0];

        // Build adjacency list
        const childrenMap = {};
        edges.forEach(edge => {
            if (!childrenMap[edge.source]) {
                childrenMap[edge.source] = [];
            }
            childrenMap[edge.source].push(edge.target);
        });

        // Build tree structure recursively
        const buildNode = (nodeId, level = 0) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;

            const childIds = childrenMap[nodeId] || [];
            const children = childIds
                .map(childId => buildNode(childId, level + 1))
                .filter(Boolean);

            return {
                ...node,
                level,
                children
            };
        };

        return buildNode(root.id);
    };

    // Calculate positions for vertical path layout - TRUE SINGLE COLUMN ZIGZAG
    const calculateTreeLayout = (tree, containerWidth) => {
        if (!tree) return [];

        const positions = [];
        const VERTICAL_SPACING = 200;
        const HORIZONTAL_OFFSET = 150; // Zigzag offset from center
        const centerX = containerWidth / 2;

        // Flatten tree into a single array (depth-first traversal)
        const allNodes = [];
        const flattenTree = (node) => {
            if (!node) return;
            allNodes.push(node);
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => flattenTree(child));
            }
        };

        flattenTree(tree);

        // Position each node in a vertical zigzag path
        allNodes.forEach((node, index) => {
            // Alternate left/right from center for zigzag effect
            let xOffset = 0;
            if (index > 0) {
                // Zigzag pattern: 0, right, left, right, left, ...
                const pattern = index % 4;
                if (pattern === 1) xOffset = HORIZONTAL_OFFSET;
                else if (pattern === 2) xOffset = -HORIZONTAL_OFFSET;
                else if (pattern === 3) xOffset = HORIZONTAL_OFFSET * 0.5;
            }

            positions.push({
                ...node,
                x: centerX + xOffset,
                y: 100 + (index * VERTICAL_SPACING),
                level: index
            });
        });

        return positions;
    };

    // Generate curved SVG path between parent and child
    const generateCurvePath = (parent, child) => {
        const startX = parent.x;
        const startY = parent.y + 180; // Bottom of parent node (after text)
        const endX = child.x;
        const endY = child.y - 40; // Top of child node (before icon)

        const midY = (startY + endY) / 2;

        // Smooth Bézier curve
        return `M ${startX} ${startY} 
                C ${startX} ${midY}, 
                  ${endX} ${midY}, 
                  ${endX} ${endY}`;
    };

    // Update layout when graph data changes
    useEffect(() => {
        if (graphData && graphData.nodes && graphData.edges) {
            const tree = buildTreeHierarchy(graphData.nodes, graphData.edges);
            if (tree) {
                const layout = calculateTreeLayout(tree, dimensions.width);
                setTreeLayout(layout);
            }
        }
    }, [graphData, dimensions]);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Find connections for rendering
    const getConnections = () => {
        if (!treeLayout || !graphData.edges) return [];

        const connections = [];
        graphData.edges.forEach(edge => {
            const parent = treeLayout.find(n => n.id === edge.source);
            const child = treeLayout.find(n => n.id === edge.target);

            if (parent && child) {
                connections.push({
                    id: `${edge.source}-${edge.target}`,
                    parent,
                    child,
                    path: generateCurvePath(parent, child)
                });
            }
        });

        return connections;
    };

    if (loading) {
        return (
            <div className="organic-tree-container" ref={containerRef}>
                <div className="tree-loading">
                    <motion.div
                        className="loading-spinner"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <p>Building knowledge tree...</p>
                </div>
            </div>
        );
    }

    if (!treeLayout || treeLayout.length === 0) {
        return (
            <div className="organic-tree-container" ref={containerRef}>
                <div className="tree-empty">
                    <h3>No Graph Data</h3>
                    <p>Generate a knowledge graph to see the tree visualization</p>
                </div>
            </div>
        );
    }

    const connections = getConnections();
    const maxY = Math.max(...treeLayout.map(n => n.y)) + 400;

    return (
        <div className="organic-tree-container" ref={containerRef}>
            <div className="tree-scroll-wrapper">
                <svg
                    className="tree-svg-layer"
                    style={{
                        width: dimensions.width,
                        height: maxY
                    }}
                >
                    <defs>
                        {/* Bright white gradient for visible connections */}
                        <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" />
                            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.4)" />
                            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.3)" />
                        </linearGradient>
                    </defs>

                    {/* Render connections */}
                    <AnimatePresence>
                        {connections.map((conn, index) => (
                            <motion.path
                                key={conn.id}
                                d={conn.path}
                                className="tree-connection-path"
                                stroke="url(#connection-gradient)"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{
                                    duration: 0.8,
                                    delay: index * 0.1,
                                    ease: "easeInOut"
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </svg>

                {/* Render nodes */}
                <div className="tree-nodes-layer" style={{ height: maxY }}>
                    {treeLayout.map((node) => (
                        <div
                            key={node.id}
                            className="tree-node-wrapper"
                            style={{
                                position: 'absolute',
                                left: node.x,
                                top: node.y,
                                transform: 'translateX(-50%)'
                            }}
                        >
                            <TreeNodeCard
                                node={node}
                                level={node.level}
                                onClick={(clickedNode) => {
                                    // Call original onNodeClick if provided
                                    if (onNodeClick) onNodeClick(clickedNode);
                                    // Trigger exploration
                                    if (exploreNodeRef.current) {
                                        exploreNodeRef.current(clickedNode);
                                    }
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Horizontal Divider - End of Graph */}
            <HorizontalDivider text="Explore Concepts Below" gradient={true} />

            {/* Node Exploration Stack - appears below graph */}
            <NodeExplorationStack
                onNodeClick={(exploreFunc) => {
                    exploreNodeRef.current = exploreFunc;
                }}
            />
        </div>
    );
};

export default OrganicTreeGraph;
