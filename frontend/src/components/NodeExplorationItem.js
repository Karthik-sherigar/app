import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Network, BarChart, Globe, Box, ListChecks, Component, Search, Menu, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TypingText from './TypingText';
import SkeletonLoader from './SkeletonLoader';
import '../App.css';
import './NodeExplanation.css';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const AnimatedTiltCard = ({ query, onClickSource }) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const cardRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePosition({ x, y });
    };

    const handleMouseLeave = () => {
        setMousePosition({ x: 0, y: 0 }); // Center back to origin
    };

    const getIcon = () => {
        const lowerQuery = (query || "").toLowerCase();
        if (lowerQuery.includes('architecture')) return <Network size={64} strokeWidth={1.2} style={{ stroke: 'url(#gradient-wireframe)' }} className="tilt-wireframe-svg" />;
        if (lowerQuery.includes('infographic') || lowerQuery.includes('chart')) return <BarChart size={64} strokeWidth={1.2} style={{ stroke: 'url(#gradient-wireframe)' }} className="tilt-wireframe-svg" />;
        if (lowerQuery.includes('real-world') || lowerQuery.includes('example')) return <Globe size={64} strokeWidth={1.2} style={{ stroke: 'url(#gradient-wireframe)' }} className="tilt-wireframe-svg" />;
        if (lowerQuery.includes('process') || lowerQuery.includes('step')) return <ListChecks size={64} strokeWidth={1.2} style={{ stroke: 'url(#gradient-wireframe)' }} className="tilt-wireframe-svg" />;
        if (lowerQuery.includes('component')) return <Component size={64} strokeWidth={1.2} style={{ stroke: 'url(#gradient-wireframe)' }} className="tilt-wireframe-svg" />;
        return <Box size={64} strokeWidth={1.2} style={{ stroke: 'url(#gradient-wireframe)' }} className="tilt-wireframe-svg" />;
    };

    return (
        <motion.div 
            ref={cardRef}
            className="tilt-interactive-card"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.5 }}
            onClick={onClickSource}
        >
            <div className="tilt-glow" style={{
                background: `radial-gradient(circle at ${mousePosition.x || 150}px ${mousePosition.y || 100}px, rgba(99, 102, 241, 0.25) 0%, transparent 50%)`
            }} />
            <div className="tilt-icon-container">
                <svg width="0" height="0">
                    <defs>
                        <linearGradient id="gradient-wireframe" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                    </defs>
                </svg>
                {getIcon()}
            </div>
            <div className="tilt-content">
                <div className="tilt-action-btn-wrapper">
                    <button className="tilt-action-btn">
                        Open Knowledge Source ↗
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const NodeExplorationItem = ({ data, onUpdate }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(data.activeTab || 'text');
    const [selectedImageDialog, setSelectedImageDialog] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setIsMobileMenuOpen(false);
        if (onUpdate) onUpdate({ ...data, activeTab: tabId });
    };

    const tabsList = [
        { id: 'text', label: 'Text Response' },
        { id: 'refs', label: 'External References' },
        { id: 'images', label: 'Images' },
        { id: 'videos', label: 'Videos' },
    ];
    
    const currentTabLabel = tabsList.find(t => t.id === activeTab)?.label || 'Menu';

    if (!data) return null;

    return (
        <div id={`explanation-${data.nodeId}`} className="node-explore-section">
            <div className="node-explore-divider" />

            {/* Centered node title */}
            <div className="node-explore-header">
                <h2 className="node-explore-title">{data.title || data.nodeLabel}</h2>
            </div>

            {/* Tab bar */}
            <div className="node-explore-tabs-container">
                {/* Mobile Tab Toggler */}
                <button 
                    className="node-explore-mobile-tab-toggle" 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <Menu size={18} />
                    <span>{currentTabLabel}</span>
                    <ChevronDown size={18} className={`node-explore-mobile-chevron ${isMobileMenuOpen ? 'open' : ''}`} />
                </button>

                <div className={`node-explore-tabs ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                    {tabsList.map(tab => (
                        <button
                            key={tab.id}
                            className={`node-explore-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}

                    {/* Explore More Button (Last) */}
                    <button
                        className="node-explore-tab-btn explore-more-btn"
                        onClick={() => navigate(`/explore/${data.nodeId}${data.rootQuery ? `?topic=${encodeURIComponent(data.rootQuery)}` : ''}`)}
                        style={{ marginLeft: 'auto', backgroundColor: 'rgba(50, 150, 255, 0.2)', color: '#4da6ff' }}
                    >
                        Explore More ↗
                    </button>
                </div>
            </div>

            {/* Tab content */}
            <div className="node-explore-content">
                <AnimatePresence mode="wait">

                    {/* TEXT RESPONSE */}
                    {activeTab === 'text' && (
                        <motion.div key="text" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="node-explore-text">
                            {data.textResponse?.overview && (
                                <p className="node-explore-overview">{data.textResponse.overview}</p>
                            )}
                            {/* Fallback: old explanation.overview */}
                            {!data.textResponse?.overview && data.explanation?.overview && (
                                <p className="node-explore-overview">{data.explanation.overview}</p>
                            )}

                            {data.textResponse?.sections?.map((section, i) => (
                                <div key={i} className="node-explore-section-block">
                                    {section.heading && <h3 className="node-explore-section-heading">{section.heading}</h3>}
                                    {section.content && <p className="node-explore-section-body">{section.content}</p>}
                                    {section.bullets?.length > 0 && (
                                        <ul className="node-explore-bullets">
                                            {section.bullets.map((b, j) => (
                                                <li key={j}>
                                                    <span className="node-explore-bullet">▸</span>
                                                    {b}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}

                            {/* Fallback: old keyPoints */}
                            {!data.textResponse && data.explanation?.keyPoints?.length > 0 && (
                                <div className="node-explore-section-block">
                                    <h3 className="node-explore-section-heading">Key Points</h3>
                                    <ul className="node-explore-bullets">
                                        {data.explanation.keyPoints.map((pt, i) => (
                                            <li key={i}><span className="node-explore-bullet">▸</span>{pt}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* EXTERNAL REFERENCES */}
                    {activeTab === 'refs' && (
                        <motion.div key="refs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="node-explore-refs">
                            {(data.externalLinks || []).map((link, i) => (
                                <div key={i} className="node-explore-ref-item">
                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="node-explore-ref-title">
                                        {link.title}
                                    </a>
                                    <span className="node-explore-ref-url">{link.url}</span>
                                    {link.description && <p className="node-explore-ref-desc">{link.description}</p>}
                                </div>
                            ))}
                            {(!data.externalLinks || data.externalLinks.length === 0) && (
                                <p className="node-explore-empty">No external references available.</p>
                            )}
                        </motion.div>
                    )}

                    {/* IMAGES */}
                    {activeTab === 'images' && (() => {
                        // Support both new 'images' field and old 'media' field (Groq fallback)
                        const imgs = data.images?.length > 0
                            ? data.images
                            : (data.media || []).map(m => ({
                                title: m.caption || 'Image',
                                googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(data.title || data.nodeLabel)}+${encodeURIComponent(m.caption || '')}`,
                                description: m.caption || ''
                            }));
                        return (
                            <motion.div key="images" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="node-explore-images" >
                                {imgs.map((img, i) => (
                                    <motion.a 
                                        key={i} 
                                        href={img.url || img.googleSearchUrl || `https://www.google.com/search?tbm=isch&q=${encodeURIComponent((data.nodeLabel || '') + ' ' + img.title)}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="modern-image-card"
                                        whileHover={{ y: -4 }}
                                    >
                                        <div className="modern-image-thumb">
                                            {img.url && !img.url.includes('google.com') ? (
                                                <img src={img.url} alt={img.title} className="modern-image-real" />
                                            ) : (
                                                <div className="modern-image-placeholder">
                                                    <div className="mip-icon-ring"><Search size={24} /></div>
                                                    <div className="mip-text">
                                                        <span>Search Gallery</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="modern-image-info">
                                            <span className="modern-image-title">{img.title || "Graphic Example"}</span>
                                            {img.description && <p className="modern-image-desc">{img.description}</p>}
                                        </div>
                                    </motion.a>
                                ))}
                                {imgs.length === 0 && (
                                    <p className="node-explore-empty">No images available.</p>
                                )}
                            </motion.div>
                        );
                    })()}

                    {/* VIDEOS */}
                    {activeTab === 'videos' && (
                        <motion.div key="videos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="node-explore-videos">
                            {(data.videos || []).map((vid, i) => (
                                <div key={i} className="node-explore-video-list-item">
                                    <h4 className="node-explore-video-title">{vid.title}</h4>
                                    <a href={vid.embedUrl || vid.url} target="_blank" rel="noopener noreferrer" className="node-explore-video-link">
                                        {vid.embedUrl || vid.url}
                                    </a>
                                    {vid.description && <p className="node-explore-video-desc">{vid.description}</p>}
                                </div>
                            ))}
                            {(!data.videos || data.videos.length === 0) && (
                                <p className="node-explore-empty">No videos available.</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* FULLSCREEN IMAGE DIALOG */}
            <AnimatePresence>
                {selectedImageDialog && (
                    <motion.div
                        className="image-viewer-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImageDialog(null)}
                    >
                        <motion.div
                            className="image-viewer-content"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img src={selectedImageDialog} alt="Fullscreen View" />
                            <button className="image-viewer-close" onClick={() => setSelectedImageDialog(null)}>✕</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default NodeExplorationItem;
