import React, { useState, useRef, useEffect, useCallback } from 'react';
import NodeExplanation from './NodeExplanation';
import HorizontalDivider from './HorizontalDivider';
import './NodeExplorationStack.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8015";

const NodeExplorationStack = ({ onNodeClick }) => {
    const [exploredNodes, setExploredNodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const stackEndRef = useRef(null);

    // Function to handle node exploration
    const exploreNode = useCallback(async (nodeData) => {
        // Check if already explored
        const alreadyExplored = exploredNodes.some(n => n.id === nodeData.id);
        if (alreadyExplored) {
            // Scroll to existing section
            const element = document.getElementById(`node-detail-${nodeData.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        setLoading(true);

        try {
            // Fetch detailed explanation from backend
            const response = await fetch(`${BACKEND_URL}/api/explain-node`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeId: nodeData.id,
                    nodeLabel: nodeData.label,
                    context: nodeData.description || ''
                })
            });

            if (!response.ok) throw new Error('Failed to fetch node details');

            const detailData = await response.json();

            // Add to explored nodes
            const newNode = {
                id: nodeData.id,
                label: nodeData.label,
                title: detailData.title || nodeData.label,
                explanation: detailData.explanation,
                media: detailData.media || [],
                videos: detailData.videos || [],
                externalLinks: detailData.externalLinks || []
            };

            setExploredNodes(prev => [...prev, newNode]);
            setLoading(false);

            // Scroll to new section after a short delay
            setTimeout(() => {
                stackEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

        } catch (error) {
            console.error('Error fetching node details:', error);
            setLoading(false);

            // Fallback: show basic info
            const fallbackNode = {
                id: nodeData.id,
                label: nodeData.label,
                title: nodeData.label,
                explanation: {
                    overview: nodeData.description || 'No detailed information available yet.',
                    details: [],
                    keyPoints: []
                },
                media: [],
                videos: [],
                externalLinks: []
            };
            setExploredNodes(prev => [...prev, fallbackNode]);

            setTimeout(() => {
                stackEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [exploredNodes, setLoading, setExploredNodes, stackEndRef]);

    // Expose exploreNode function to parent
    useEffect(() => {
        if (onNodeClick) {
            onNodeClick(exploreNode);
        }
    }, [onNodeClick, exploreNode]);

    const handleExploreFurther = (node) => {
        // TODO: Navigate to deep-dive page (will be implemented later)
        console.log('Explore further:', node);
        alert(`Deep-dive page for "${node.title}" will be implemented soon!`);
    };

    return (
        <div className="node-exploration-stack">
            {exploredNodes.map((node, index) => (
                <div key={node.id}>
                    <div
                        id={`node-detail-${node.id}`}
                        className="exploration-item"
                    >
                        <NodeExplanation
                            nodeData={node}
                            onExploreFurther={() => handleExploreFurther(node)}
                        />
                    </div>

                    {/* Divider after each explanation */}
                    <HorizontalDivider gradient={true} />
                </div>
            ))}

            {loading && (
                <div className="exploration-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading detailed explanation...</p>
                </div>
            )}

            <div ref={stackEndRef} />
        </div>
    );
};

export default NodeExplorationStack;
