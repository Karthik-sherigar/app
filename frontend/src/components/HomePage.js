import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Code2, LogOut, Camera, History, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './HomePage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

const HomePage = ({ setMode, history, onLogout, onRestore }) => {
    const [userName, setUserName] = useState(localStorage.getItem('userName') || 'Explorer');
    
    // Tab state for history
    const [activityTab, setActivityTab] = useState('query');

    // Filter history logic based on tabs
    const filteredHistory = history ? history.filter(item => item.mode === activityTab).slice(0, 6) : [];

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const formatHistoryTime = (timestampStr) => {
        if (!timestampStr) return "Unknown";
        
        // Standardize Python SQLAlchemy SQLite format ("YYYY-MM-DD HH:MM:SS") to standard JS ISO 8601
        let safeStr = timestampStr;
        if (safeStr.includes(' ') && !safeStr.includes('T')) {
            safeStr = safeStr.replace(' ', 'T');
        }
        if (!safeStr.endsWith('Z')) {
            safeStr += 'Z'; // Force UTC conversion
        }

        const parsed = new Date(safeStr);
        if (isNaN(parsed.getTime())) {
            return timestampStr.split('.')[0] || "Recent";
        }
        
        const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };
        const timeOpts = { hour: '2-digit', minute:'2-digit' };
        return `${parsed.toLocaleDateString(undefined, dateOpts)} — ${parsed.toLocaleTimeString(undefined, timeOpts)}`;
    };

    return (
        <div className="home-dashboard">
            {/* Top Greeting */}
            <header className="home-header">
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="greeting-block"
                >
                    <h1>Welcome back, <span className="highlight-gradient">{userName}</span></h1>
                    <p>Where would you like to direct your expedition today?</p>
                </motion.div>
            </header>

            <div className="home-content-grid">
                


                {/* Modes Dashboard */}
                <div className="modes-section">
                    <h2 className="section-title">Select Intelligence Mode</h2>
                    <div className="modes-grid">
                        
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mode-card query-mode"
                            onClick={() => setMode('query')}
                        >
                            <div className="mode-icon-wrapper"><Search size={28} /></div>
                            <h3>Query Mode</h3>
                            <p>Generate vast interconnected knowledge graphs from natural language questions.</p>
                            <div className="mode-arrow"><ArrowRight size={20} /></div>
                        </motion.div>

                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mode-card pdf-mode"
                            onClick={() => setMode('pdf')}
                        >
                            <div className="mode-icon-wrapper"><FileText size={28} /></div>
                            <h3>Document Mode</h3>
                            <p>Upload dense PDFs and books to automatically map architectures and relationships.</p>
                            <div className="mode-arrow"><ArrowRight size={20} /></div>
                        </motion.div>

                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mode-card code-mode"
                            onClick={() => setMode('programming')}
                        >
                            <div className="mode-icon-wrapper"><Code2 size={28} /></div>
                            <h3>Developer Mode</h3>
                            <p>Paste codebases and architectural scripts to visualize technical software flows.</p>
                            <div className="mode-arrow"><ArrowRight size={20} /></div>
                        </motion.div>

                    </div>
                </div>

                {/* Key Features Section / Platform Capabilities */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="home-features-section"
                >
                    <h2 className="section-title">Platform Capabilities</h2>
                    <div className="features-grid">
                        <motion.div className="feature-card card-glass" whileHover={{ y: -4 }}>
                            <div className="feature-icon"><Search size={22} /></div>
                            <h4>Web Intelligence</h4>
                            <p>Perform deep real-time web searches to construct interactive, organic knowledge graphs on any topic.</p>
                        </motion.div>
                        <motion.div className="feature-card card-glass" whileHover={{ y: -4 }}>
                            <div className="feature-icon"><FileText size={22} /></div>
                            <h4>Document Synthesis</h4>
                            <p>Extract core concepts and map timeline-based learning journeys directly from dense PDF files.</p>
                        </motion.div>
                        <motion.div className="feature-card card-glass" whileHover={{ y: -4 }}>
                            <div className="feature-icon"><Code2 size={22} /></div>
                            <h4>Codebase Mapping</h4>
                            <p>Reverse-engineer complex programming logic to generate interactive software dependency trees.</p>
                        </motion.div>
                        <motion.div className="feature-card card-glass" whileHover={{ y: -4 }}>
                            <div className="feature-icon"><History size={22} /></div>
                            <h4>Persistent Discovery</h4>
                            <p>Automatically save, resume, and organically expand your expedition journeys over time.</p>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Activity History Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="activity-section card-glass"
                >
                    <div className="activity-header">
                        <History size={20} />
                        <h2>Recent Expeditions</h2>
                    </div>

                    <div className="activity-tabs">
                        <button className={`activity-tab ${activityTab === 'query' ? 'active' : ''}`} onClick={() => setActivityTab('query')}>Query Mode</button>
                        <button className={`activity-tab ${activityTab === 'pdf' ? 'active' : ''}`} onClick={() => setActivityTab('pdf')}>Document Mode</button>
                        <button className={`activity-tab ${activityTab === 'programming' ? 'active' : ''}`} onClick={() => setActivityTab('programming')}>Developer Mode</button>
                    </div>
                    
                    <div className="activity-grid">
                        {filteredHistory.length > 0 ? (
                            filteredHistory.map((item, idx) => (
                                <div key={item.id || idx} className="activity-card" onClick={() => onRestore ? onRestore(item) : setMode(item.mode || 'query')}>
                                    <div className={`activity-mode-tag ${item.mode}`}>
                                        {item.mode === 'query' ? <Search size={14}/> : item.mode === 'pdf' ? <FileText size={14} /> : <Code2 size={14}/>}
                                        <span>{item.mode?.toUpperCase() || 'QUERY'}</span>
                                    </div>
                                    <div className="activity-content">
                                        <h4>{item.query || "Extracted Document"}</h4>
                                        <span className="activity-time">{formatHistoryTime(item.timestamp)}</span>
                                    </div>
                                    <button 
                                        className="activity-resume" 
                                        onClick={() => onRestore ? onRestore(item) : setMode(item.mode || 'query')} 
                                        title="Jump to Module"
                                    >
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="activity-empty">
                                <p>No expeditions found for {activityTab} mode. Start mapping your knowledge!</p>
                            </div>
                        )}
                    </div>
                </motion.div>

            </div>

            {/* Premium SaaS Footer */}
            <footer className="home-footer">
                <div className="footer-divider"></div>
                <div className="footer-content">
                    <div className="footer-logo">
                        <span className="highlight-gradient" style={{ fontWeight: 'bold', fontSize: '18px' }}>Knowledge Synthesizer</span>
                    </div>
                    <p className="footer-tagline">Advanced Agentic Knowledge Synthesis & Graph Exploration.</p>
                    <p className="footer-copyright">© {new Date().getFullYear()} Knowledge Intelligence. All rights reserved.</p>
                </div>
            </footer>

        </div>
    );
};

export default HomePage;
