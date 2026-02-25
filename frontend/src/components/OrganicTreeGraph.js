import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize } from 'lucide-react';
import TreeNodeCard from './TreeNodeCard';
import GraphLoadingAnimation from './GraphLoadingAnimation';
import './OrganicTreeGraph.css';

const OrganicTreeGraph = ({ graphData, onNodeClick, onExploreNode, selectedNode, mode, loading, activeQuery }) => {
    const [treeLayout, setTreeLayout] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
    const containerRef = useRef(null);
    const scrollWrapperRef = useRef(null);

    // Zoom State
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Zoom Handlers
    const handleZoomIn = () => setZoomLevel(z => Math.min(2, z + 0.15));
    const handleZoomOut = () => setZoomLevel(z => Math.max(0.2, z - 0.15));

    const handleFit = () => {
        setZoomLevel(1);
        if (scrollWrapperRef.current) {
            scrollWrapperRef.current.style.scrollBehavior = 'smooth';
            scrollWrapperRef.current.scrollTo({
                top: 0,
                left: 0
            });
            setTimeout(() => {
                if (scrollWrapperRef.current) scrollWrapperRef.current.style.scrollBehavior = 'auto';
            }, 300);
        }
    };

    // Scroll state for hiding zoom controls
    const [isPageScrolled, setIsPageScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = (e) => {
            // Calculate a dynamic threshold based on the container height (typically 75vh). 
            // We subtract a buffer (e.g. 150px) so it hides slightly before the graph is completely gone.
            const scrollThreshold = containerRef.current ? containerRef.current.offsetHeight - 150 : window.innerHeight * 0.5;

            // Because inner div scroll events don't bubble, we intercept all scrolls in the capture phase.
            // Check if the scrolled element is our main workspace or a child within it
            if (e.target && e.target.classList && e.target.classList.contains('workspace')) {
                setIsPageScrolled(e.target.scrollTop > scrollThreshold);
            } else if (e.target === document || e.target === document.documentElement) {
                // Fallback if the whole window scrolls somehow
                setIsPageScrolled(window.scrollY > scrollThreshold);
            }
        };

        // '{ capture: true }' is absolutely required to catch div scroll events from window
        window.addEventListener('scroll', handleScroll, true);

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        const handleExport = () => {
            const target = document.querySelector('.zoom-pan-container');
            if (!target) return;
            import('html-to-image').then(htmlToImage => {
                htmlToImage.toPng(target, {
                    backgroundColor: '#0f172a',
                    pixelRatio: window.devicePixelRatio || 2,
                    style: {
                        transform: 'scale(1)',
                        transformOrigin: 'top left',
                    }
                }).then(dataUrl => {
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = 'Knowledge-Graph-Export.png';
                    a.click();
                }).catch(err => {
                    console.error("Export failed:", err);
                });
            });
        };

        window.addEventListener('export-organic-graph', handleExport);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('export-organic-graph', handleExport);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    };

    // Drag to pan state
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const scrollPos = useRef({ left: 0, top: 0 });

    const handleMouseDown = (e) => {
        isDragging.current = true;
        startPos.current = { x: e.pageX, y: e.pageY };
        scrollPos.current = {
            left: scrollWrapperRef.current.scrollLeft,
            top: scrollWrapperRef.current.scrollTop
        };
        scrollWrapperRef.current.style.cursor = 'grabbing';
        scrollWrapperRef.current.style.userSelect = 'none';

        // Minor optimization, removing smoothing during manual panning
        scrollWrapperRef.current.style.scrollBehavior = 'auto';
    };

    const handleMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollWrapperRef.current) {
            scrollWrapperRef.current.style.cursor = 'grab';
            scrollWrapperRef.current.style.removeProperty('user-select');
            scrollWrapperRef.current.style.scrollBehavior = 'smooth';
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const walkX = (e.pageX - startPos.current.x) * 1.5; // Drag speed multiplier
        const walkY = (e.pageY - startPos.current.y) * 1.5;
        scrollWrapperRef.current.scrollLeft = scrollPos.current.left - walkX;
        scrollWrapperRef.current.scrollTop = scrollPos.current.top - walkY;
    };

    // Build tree hierarchy from graph data
    const buildTreeHierarchy = (nodes, edges) => {
        if (!nodes || nodes.length === 0) return null;
        const safeEdges = edges || [];

        // Find root node (node with no incoming edges)
        const incomingEdges = new Set(safeEdges.map(e => e.target));
        const mainRoot = nodes.find(n => !incomingEdges.has(n.id)) || nodes[0];

        // Build adjacency list
        const childrenMap = {};
        safeEdges.forEach(edge => {
            if (!childrenMap[edge.source]) {
                childrenMap[edge.source] = [];
            }
            childrenMap[edge.source].push(edge.target);
        });

        const visited = new Set();

        // Build tree structure recursively
        const buildNode = (nodeId, level = 0) => {
            if (visited.has(nodeId)) return null; // Prevent duplicates in DAG
            visited.add(nodeId);

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

        const rootTree = buildNode(mainRoot.id);

        // Ensure detached components / multi-roots are handled
        nodes.forEach(n => {
            if (!visited.has(n.id)) {
                const subTree = buildNode(n.id, 0);
                if (subTree && rootTree && rootTree.children) {
                    rootTree.children.push(subTree);
                }
            }
        });

        return rootTree;
    };

    // Calculate positions for horizontal top-down organic tree layout
    const calculateTreeLayout = (tree, containerWidth) => {
        if (!tree) return [];

        const positions = [];
        const VERTICAL_SPACING = 360; // Balanced for depth
        const HORIZONTAL_SPACING = 480; // Compact but clear
        const NODE_WIDTH = 340;

        let leafCount = 0;

        // Recursive Pass: Calculate X based on subtree breadth (leaves)
        const layoutPass = (node, depth = 0) => {
            if (!node) return;

            if (!node.children || node.children.length === 0) {
                // Leaf Node: Assign sequential X position
                node.x = leafCount * HORIZONTAL_SPACING;
                leafCount++;
            } else {
                // Parent Node: Center it over its children
                node.children.forEach(child => layoutPass(child, depth + 1));
                
                const firstX = node.children[0].x;
                const lastX = node.children[node.children.length - 1].x;
                node.x = (firstX + lastX) / 2;
            }

            node.y = 100 + (depth * VERTICAL_SPACING);
            node.level = depth;
        };

        // Initialize recursion
        layoutPass(tree);

        // Collect all processed nodes for bounds calculation
        const nodesList = [];
        const collect = (node) => {
            if (!node) return;
            nodesList.push(node);
            node.children?.forEach(collect);
        };
        collect(tree);

        // Find bounding box
        const nodeXPositions = nodesList.map(n => n.x);
        const minX = Math.min(...nodeXPositions);
        const maxX = Math.max(...nodeXPositions);
        const treeWidth = maxX - minX;

        // Final Mapping: Center the root node specifically
        const rootX = tree.x;
        const centerOffset = (containerWidth / 2) - rootX;

        // Ensure we don't push nodes off the left edge (keep minimum 100px padding)
        // Find the absolute min X if we were to apply centerOffset
        const absoluteMinX = minX + centerOffset;
        const finalOffset = absoluteMinX < 100 ? (centerOffset + (100 - absoluteMinX)) : centerOffset;

        nodesList.forEach(node => {
            positions.push({
                ...node,
                x: node.x + finalOffset,
                y: node.y,
                level: node.level
            });
        });

        return positions;
    };

    // Generate sweeping curved SVG path between parent and child
    const generateCurvePath = (parent, child) => {
        // Parent bottom center (approximate for horizontal glass capsule height)
        const startX = parent.x;
        const startY = parent.y + 75;

        // Child top center
        const endX = child.x;
        const endY = child.y;

        // Fix missing completely vertical paths: SVG filters clip bounding boxes with 0 width!
        const adjustedEndX = (startX === endX) ? endX + 0.1 : endX;

        // Calculate control points for a smooth sweeping elegant S-curve
        const distanceY = endY - startY;
        const flexPoint = distanceY * 0.5;

        // Push horizontal control points out wider if they are siblings
        const isLeftChild = adjustedEndX < startX;
        const swingMultiplier = Math.abs(adjustedEndX - startX) > 50 ? 0.3 : 0;
        const horizontalSwing = isLeftChild ? -(Math.abs(adjustedEndX - startX) * swingMultiplier) : (Math.abs(adjustedEndX - startX) * swingMultiplier);

        // Smooth cubic Bézier curve
        return `M ${startX} ${startY} 
                C ${startX + horizontalSwing} ${startY + flexPoint}, 
                  ${adjustedEndX - horizontalSwing} ${endY - flexPoint}, 
                  ${adjustedEndX} ${endY}`;
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
                <GraphLoadingAnimation mode="query" />
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
    const maxX = Math.max(...treeLayout.map(n => n.x)) + 200;
    const minX = Math.min(...treeLayout.map(n => n.x)) - 200;

    // Ensure the SVG canvas is wide enough to contain all nodes without clipping
    const computedWidth = Math.max(dimensions.width, maxX);

    return (
        <div className="organic-tree-container" ref={containerRef}>

            {/* Zoom Controls */}
            <AnimatePresence>
                {!isPageScrolled && (
                    <motion.div
                        className="graph-zoom-controls"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                    >
                        <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">
                            <ZoomIn size={18} />
                        </button>
                        <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out">
                            <ZoomOut size={18} />
                        </button>
                        <button className="zoom-btn" onClick={handleFit} title="Reset Zoom">
                            <RotateCcw size={18} />
                        </button>
                        <button className="zoom-btn" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className="tree-scroll-wrapper"
                ref={scrollWrapperRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeaveOrUp}
                onMouseUp={handleMouseLeaveOrUp}
                onMouseMove={handleMouseMove}
                style={{ cursor: 'grab' }}
            >
                {/* Dynamic User Query Header */}
                {activeQuery && (
                    <div className="organic-graph-header">
                        <h2>{activeQuery}</h2>
                    </div>
                )}

                {/* Center align the canvas if it scales down smaller than viewport */}
                <div style={{
                    display: computedWidth * zoomLevel < dimensions.width ? 'flex' : 'block',
                    justifyContent: 'center',
                    minHeight: '100%',
                    width: '100%'
                }}>
                    <div className="zoom-pan-container" style={{
                        width: computedWidth * zoomLevel,
                        height: maxY * zoomLevel,
                        position: 'relative'
                    }}>
                        <div style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: '0 0',
                            width: computedWidth,
                            height: maxY,
                            position: 'absolute',
                            top: 0,
                            left: 0
                        }}>
                            <svg
                                className="tree-svg-layer"
                                style={{
                                    width: computedWidth,
                                    height: maxY
                                }}
                            >
                                <defs>
                                    {/* Vibrant glowing gradients for connections */}
                                    <linearGradient id="gradient-left" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="rgba(6, 182, 212, 0.8)" />   {/* Cyan */}
                                        <stop offset="100%" stopColor="rgba(59, 130, 246, 0.2)" /> {/* Blue fade */}
                                    </linearGradient>
                                    <linearGradient id="gradient-center" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="rgba(139, 92, 246, 0.8)" />   {/* Violet */}
                                        <stop offset="100%" stopColor="rgba(79, 70, 229, 0.2)" />  {/* Indigo fade */}
                                    </linearGradient>
                                    <linearGradient id="gradient-right" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="rgba(249, 115, 22, 0.8)" />   {/* Orange */}
                                        <stop offset="100%" stopColor="rgba(239, 68, 68, 0.2)" />  {/* Red fade */}
                                    </linearGradient>

                                    <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="6" result="blur" />
                                        <feMerge>
                                            <feMergeNode in="blur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                </defs>

                                {/* Render connections */}
                                <AnimatePresence>
                                    {connections.map((conn, index) => {
                                        // Assign a gradient based on the horizontal position of the target node
                                        const centerX = dimensions.width / 2;
                                        let strokeUrl = "url(#gradient-center)";
                                        if (conn.child.x < centerX - 100) strokeUrl = "url(#gradient-left)";
                                        else if (conn.child.x > centerX + 100) strokeUrl = "url(#gradient-right)";

                                        return (
                                            <g key={conn.id}>
                                                {/* Ambient glow path behind the main path */}
                                                <path
                                                    d={conn.path}
                                                    fill="none"
                                                    stroke={strokeUrl}
                                                    strokeWidth="8"
                                                    filter="url(#glow-heavy)"
                                                    opacity="0.3"
                                                />
                                                {/* Main crisp connection path */}
                                                <motion.path
                                                    d={conn.path}
                                                    fill="none"
                                                    stroke={strokeUrl}
                                                    strokeWidth="2.5"
                                                    initial={{ pathLength: 0, opacity: 0 }}
                                                    animate={{ pathLength: 1, opacity: 1 }}
                                                    transition={{
                                                        duration: 1.2,
                                                        delay: index * 0.15,
                                                        ease: "easeInOut"
                                                    }}
                                                />
                                            </g>
                                        );
                                    })}
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
                                                if (onExploreNode) {
                                                    // Exploration mode: only fetch explanation, don't trigger graph regeneration
                                                    onExploreNode(clickedNode);
                                                } else if (onNodeClick) {
                                                    onNodeClick(clickedNode);
                                                }
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganicTreeGraph;
