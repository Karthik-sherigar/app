import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, MessageSquare, Maximize2, Layers } from 'lucide-react';
import VisualJourney from './VisualJourney';
import TextResponsePanel from '../TextResponsePanel';
import './ConceptExplorationDialog.css';

const ConceptExplorationDialog = ({
    concept,
    data,
    subgraph,
    onClose,
    onBack,
    onNext,
    onPrev,
    canGoBack,
    canGoNext,
    onDeepDive,
    index,
    total
}) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showChat, setShowChat] = useState(false);

    // Initial animation for the depth layering effect
    const zIndex = 2000 + index;
    const depthScale = 1 - (total - 1 - index) * 0.04;
    const yOffset = (total - 1 - index) * -15;

    return (
        <motion.div
            className="concept-dialog-overlay"
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{
                opacity: 1,
                scale: depthScale,
                y: yOffset,
                filter: index < total - 1 ? 'brightness(0.3) blur(4px)' : 'none'
            }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            style={{ zIndex }}
        >
            <div className="concept-dialog-container">
                {/* Expedition Header */}
                <header className="dialog-header-premium">
                    <div className="header-left">
                        <div className="station-meta">
                            <Layers size={12} />
                            <span>LEVEL {total} ARCHITECTURE</span>
                        </div>
                        <h2 className="dialog-concept-title">{concept.label}</h2>
                    </div>

                    <div className="header-actions">
                        <div className="nav-group-premium">
                            <button
                                className={`nav-ring-btn ${!canGoBack && index === 0 ? 'disabled' : ''}`}
                                onClick={index > 0 ? onBack : onPrev}
                                title="Previous Station"
                            >
                                <ArrowLeft size={18} />
                                <span>{index > 0 ? 'Up' : 'Prev'}</span>
                            </button>
                            <button
                                className={`nav-ring-btn ${!canGoNext ? 'disabled' : ''}`}
                                onClick={onNext}
                                title="Next Station"
                            >
                                <span>Next</span>
                                <ArrowRight size={18} />
                            </button>
                        </div>
                        <div className="divider-v" />
                        <button className="close-portal-btn" onClick={onClose} title="Exit Expedition">
                            <X size={20} />
                        </button>
                    </div>
                </header>

                {/* Main Content Area - Technical Split */}
                <main className="dialog-body-split">
                    {/* Left: Tactical Graph Blueprint */}
                    <section className="dialog-canvas-section">
                        <div className="canvas-header">
                            <div className="blueprint-tag">TECHNICAL BLUEPRINT</div>
                            <div className="indicator-live">LIVE ANALYTICS</div>
                        </div>
                        <div className="mini-graph-container">
                            <VisualJourney
                                graphData={subgraph}
                                onNodeClick={(node) => onDeepDive(node)}
                                isDialogMode={true}
                            />
                        </div>
                    </section>

                    {/* Right: Technical Explanation Layer */}
                    <section className="dialog-info-section">
                        <div className="info-header-v4">
                            <h3>STATION DATA</h3>
                        </div>
                        <div className="info-scroll-container">
                            <TextResponsePanel
                                graphData={data}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                                isDialogMode={true}
                            />
                        </div>
                    </section>
                </main>

                {/* Footer Controls */}
                <footer className="dialog-footer-v4">
                    <div className="footer-left">
                        <p>Navigating the specialized architecture of <strong>{concept.label}</strong></p>
                    </div>
                    <motion.button
                        className={`tech-discuss-btn ${showChat ? 'active' : ''}`}
                        onClick={() => setShowChat(!showChat)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <MessageSquare size={18} />
                        <span>CONSULT AI ANALYST</span>
                    </motion.button>
                </footer>

                {/* Sub-Concept Conversation Overlay */}
                <AnimatePresence>
                    {showChat && (
                        <motion.div
                            className="inner-station-chat"
                            initial={{ x: "100%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 25 }}
                        >
                            <div className="station-chat-header">
                                <h3>STATION COMMS: {concept.label}</h3>
                                <button onClick={() => setShowChat(false)}><X size={16} /></button>
                            </div>
                            <div className="station-chat-body">
                                <div className="ai-message-bubble">
                                    I've analyzed the sub-structures of {concept.label}. What specific implementation details would you like to explore?
                                </div>
                                <div className="station-chat-input-row">
                                    <input type="text" placeholder="Inquire about logic flow..." />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default ConceptExplorationDialog;
