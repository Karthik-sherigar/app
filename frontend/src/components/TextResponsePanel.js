import React, { useState, useEffect, useRef } from 'react';
import './TextResponsePanel.css';

const TextResponsePanel = ({
    graphData,
    selectedNode,
    onNodeClick,
    onExpandConcept,
    activeTab = 'overview',
    onTabChange
}) => {
    const [highlightedNodeId, setHighlightedNodeId] = useState(null);
    const contentRef = useRef(null);

    useEffect(() => {
        if (selectedNode) {
            setHighlightedNodeId(selectedNode);
            // Scroll to the corresponding text section
            scrollToNode(selectedNode);
        }
    }, [selectedNode]);

    const scrollToNode = (nodeId) => {
        const element = document.getElementById(`text-node-${nodeId}`);
        if (element && contentRef.current) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight briefly
            element.classList.add('highlight-flash');
            setTimeout(() => element.classList.remove('highlight-flash'), 2000);
        }
    };

    const handleTextNodeClick = (nodeId) => {
        setHighlightedNodeId(nodeId);
        onNodeClick(nodeId);
    };

    const handleExpandClick = (nodeId) => {
        onExpandConcept(nodeId);
    };

    const renderOverview = () => {
        if (!graphData?.answer && !graphData?.sections?.overview) {
            return <p className="text-muted">No overview available</p>;
        }

        return (
            <div className="content-section">
                <h3>Overview</h3>
                <p className="overview-text">{graphData.sections?.overview || graphData.answer?.substring(0, 300) + '...'}</p>

                {graphData.answer && (
                    <>
                        <h3>Detailed Explanation</h3>
                        <div className="answer-text">{graphData.answer}</div>
                    </>
                )}
            </div>
        );
    };

    const renderConcepts = () => {
        const concepts = graphData?.sections?.concepts || [];
        const nodes = graphData?.nodes || [];

        // Group nodes by importance/depth
        const coreNodes = nodes.filter(n => n.importance === 3 || n.depth === 0);
        const relatedNodes = nodes.filter(n => n.importance === 2 || n.depth === 1);
        const secondaryNodes = nodes.filter(n => n.importance === 1 || n.depth >= 2);

        return (
            <div className="content-section concepts-section">
                {concepts.length > 0 ? (
                    concepts.map((concept, idx) => (
                        <div
                            key={idx}
                            id={`text-node-${concept.id}`}
                            className={`concept-card ${highlightedNodeId === concept.id ? 'highlighted' : ''}`}
                            onClick={() => handleTextNodeClick(concept.id)}
                        >
                            <h4 className="concept-name">{concept.name}</h4>
                            <p className="concept-explanation">{concept.explanation}</p>
                            <button
                                className="btn-explain-more"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExpandClick(concept.id);
                                }}
                            >
                                Explain More
                            </button>
                        </div>
                    ))
                ) : (
                    <>
                        {coreNodes.length > 0 && (
                            <div className="node-group">
                                <h3>Core Concepts</h3>
                                {coreNodes.map(node => (
                                    <div
                                        key={node.id}
                                        id={`text-node-${node.id}`}
                                        className={`concept-card ${highlightedNodeId === node.id ? 'highlighted' : ''}`}
                                        onClick={() => handleTextNodeClick(node.id)}
                                    >
                                        <h4 className="concept-name">{node.label}</h4>
                                        <p className="concept-explanation">{node.description}</p>
                                        <button
                                            className="btn-explain-more"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleExpandClick(node.id);
                                            }}
                                        >
                                            Explain More
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {relatedNodes.length > 0 && (
                            <div className="node-group">
                                <h3>Related Concepts</h3>
                                {relatedNodes.map(node => (
                                    <div
                                        key={node.id}
                                        id={`text-node-${node.id}`}
                                        className={`concept-card ${highlightedNodeId === node.id ? 'highlighted' : ''}`}
                                        onClick={() => handleTextNodeClick(node.id)}
                                    >
                                        <h4 className="concept-name">{node.label}</h4>
                                        <p className="concept-explanation">{node.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {secondaryNodes.length > 0 && (
                            <div className="node-group">
                                <h3>Supporting Concepts</h3>
                                {secondaryNodes.map(node => (
                                    <div
                                        key={node.id}
                                        id={`text-node-${node.id}`}
                                        className={`concept-card ${highlightedNodeId === node.id ? 'highlighted' : ''}`}
                                        onClick={() => handleTextNodeClick(node.id)}
                                    >
                                        <h4 className="concept-name">{node.label}</h4>
                                        <p className="concept-explanation">{node.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    const renderDependencies = () => {
        const prerequisites = graphData?.sections?.dependencies || graphData?.sections?.prerequisites || [];
        const edges = graphData?.edges || [];
        const nodes = graphData?.nodes || [];

        // Find prerequisite relationships
        const prereqEdges = edges.filter(e => e.relation === 'DEPENDS_ON' || e.relation === 'REQUIRES');

        return (
            <div className="content-section dependencies-section">
                <h3>Prerequisites</h3>
                {prerequisites.length > 0 ? (
                    <ul className="prerequisites-list">
                        {prerequisites.map((prereq, idx) => (
                            <li key={idx}>
                                <strong>{prereq.concept}</strong>: {prereq.why}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted">No specific prerequisites defined</p>
                )}

                <h3>Concept Dependencies</h3>
                {prereqEdges.length > 0 ? (
                    <div className="dependency-graph">
                        {prereqEdges.map((edge, idx) => {
                            const sourceNode = nodes.find(n => n.id === edge.source);
                            const targetNode = nodes.find(n => n.id === edge.target);
                            return (
                                <div key={idx} className="dependency-item">
                                    <span
                                        className="dep-source clickable"
                                        onClick={() => handleTextNodeClick(edge.source)}
                                    >
                                        {sourceNode?.label || edge.source}
                                    </span>
                                    <span className="dep-arrow">→</span>
                                    <span
                                        className="dep-target clickable"
                                        onClick={() => handleTextNodeClick(edge.target)}
                                    >
                                        {targetNode?.label || edge.target}
                                    </span>
                                    <span className="dep-relation">({edge.relation})</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-muted">No dependencies mapped</p>
                )}
            </div>
        );
    };

    const renderSummary = () => {
        const summary = graphData?.sections?.summary;
        const nodes = graphData?.nodes || [];

        return (
            <div className="content-section summary-section">
                <h3>Key Takeaways</h3>
                {summary ? (
                    <p className="summary-text">{summary}</p>
                ) : (
                    <p className="text-muted">No summary available</p>
                )}

                <h3>Concept Map</h3>
                <div className="concept-map">
                    {nodes.slice(0, 10).map(node => (
                        <div
                            key={node.id}
                            className="concept-tag"
                            onClick={() => handleTextNodeClick(node.id)}
                        >
                            {node.label}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
            case 'concepts':
                return renderConcepts();
            case 'dependencies':
                return renderDependencies();
            case 'summary':
                return renderSummary();
            default:
                return renderOverview();
        }
    };

    if (!graphData) {
        return null;
    }

    return (
        <div className="text-response-panel">
            <div className="panel-header">
                <h2>Knowledge Explanation</h2>
            </div>

            <div className="panel-tabs">
                <button
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => onTabChange('overview')}
                >
                    Overview
                </button>
                <button
                    className={`tab-button ${activeTab === 'concepts' ? 'active' : ''}`}
                    onClick={() => onTabChange('concepts')}
                >
                    Concepts
                </button>
                <button
                    className={`tab-button ${activeTab === 'dependencies' ? 'active' : ''}`}
                    onClick={() => onTabChange('dependencies')}
                >
                    Dependencies
                </button>
                <button
                    className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => onTabChange('summary')}
                >
                    Summary
                </button>
            </div>

            <div className="panel-content" ref={contentRef}>
                {renderContent()}
            </div>
        </div>
    );
};

export default TextResponsePanel;
