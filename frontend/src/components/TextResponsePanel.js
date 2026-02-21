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
                <h3>System Overview & Relationships</h3>
                <p className="overview-text">{graphData.sections?.overview}</p>

                {graphData.answer && (
                    <div className="detailed-graph-explanation" style={{ marginTop: '24px' }}>
                        <h3>Comprehensive Graph Explanation</h3>
                        <div className="answer-text" style={{ lineHeight: '1.8', fontSize: '15px' }}>
                            {graphData.answer.split('\n').map((line, i) => (
                                <p key={i} style={{ marginBottom: line.trim() === '' ? '0' : '16px' }}>{line}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSummary = () => {
        const summary = graphData?.sections?.summary;

        return (
            <div className="content-section summary-section">
                <h3>Executive Summary</h3>
                {summary ? (
                    <div className="summary-text" style={{ fontSize: '16px', lineHeight: '1.8', padding: '20px', background: 'rgba(99, 102, 241, 0.05)', borderLeft: '4px solid #6366f1', borderRadius: '0 8px 8px 0' }}>
                        {summary.split('\n').map((line, i) => (
                            <p key={i} style={{ marginBottom: line.trim() === '' ? '0' : '12px' }}>{line}</p>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted">No summary available</p>
                )}
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
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
