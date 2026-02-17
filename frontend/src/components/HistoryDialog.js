import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Calendar, MessageSquare, Trash2, Clock } from 'lucide-react';
import './HistoryDialog.css';

const HistoryDialog = ({
    isOpen,
    onClose,
    history,
    onRestore,
    onDelete,
    mode,
    isLoading
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredHistory = (history || [])
        .filter(item => item?.mode === mode)
        .filter(item => {
            const queryMatch = (item?.query || "").toLowerCase().includes(searchTerm.toLowerCase());
            const previewMatch = (item?.preview || "").toLowerCase().includes(searchTerm.toLowerCase());
            return queryMatch || previewMatch;
        });

    if (!isOpen) return null;

    return (
        <div className="history-dialog-overlay" onClick={onClose}>
            <motion.div
                className="history-dialog-content"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="history-dialog-header">
                    <div className="header-title">
                        <Clock size={20} className="header-icon" />
                        <h2>Journey Archive</h2>
                        <span className="mode-badge">{mode}</span>
                    </div>
                    <button className="close-dialog-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="history-dialog-search">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search your knowledge expeditions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="history-dialog-body">
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                className="history-loading-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="loading-spinner">
                                    <div className="spinner-ring"></div>
                                    <Clock size={32} className="spinner-icon" />
                                </div>
                                <p>Expanding your knowledge timeline...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {filteredHistory.length > 0 ? (
                        <div className="history-grid">
                            {filteredHistory.map((item) => (
                                <div key={item.id} className="history-card" onClick={() => { onRestore(item); onClose(); }}>
                                    <div className="card-header">
                                        <div className="card-type">
                                            <MessageSquare size={14} />
                                            <span>Query</span>
                                        </div>
                                        <button
                                            className="card-delete-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(item.id);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="card-body">
                                        <p className="card-preview">{item.query}</p>
                                    </div>
                                    <div className="card-footer">
                                        <div className="meta-item">
                                            <Calendar size={12} />
                                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="meta-item">
                                            <Clock size={12} />
                                            <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="history-empty-state">
                            <div className="empty-icon-box">
                                <Search size={40} />
                            </div>
                            <h3>No matches found</h3>
                            <p>Try a different keyword or explore other modes.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default React.memo(HistoryDialog);
