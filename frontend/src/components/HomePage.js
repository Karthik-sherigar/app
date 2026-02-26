import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Code2, LogOut, Camera, History, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './HomePage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

const HomePage = ({ setMode, history, onLogout }) => {
    const fileInputRef = useRef(null);
    const [userName, setUserName] = useState(localStorage.getItem('userName') || 'Explorer');
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');
    const [profilePic, setProfilePic] = useState(localStorage.getItem('profilePic') || null);
    const [joinDate, setJoinDate] = useState(localStorage.getItem('joinDate') || new Date().toISOString());

    // Filter history logic (Optional: grab top 10 recent searches)
    const recentActivity = history ? history.slice(0, 8) : [];

    // Fallback initials generator
    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                toast.error("Image must be smaller than 2MB");
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result;
                setProfilePic(base64String);
                localStorage.setItem('profilePic', base64String);
                
                try {
                    await axios.put(`${API}/auth/profile-picture`, {
                        email: userEmail,
                        profile_picture: base64String
                    });
                    toast.success("Profile picture updated!");
                } catch (err) {
                    toast.error("Failed to sync profile picture to server.");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const formatHistoryTime = (timestampStr) => {
        if (!timestampStr) return "Unknown";
        // Attempt to parse 'YYYY-MM-DDTHH:MM:SS.mmmmmm' format from Python sqlite backend
        const parsed = new Date(timestampStr + 'Z'); // Add Z to fix missing timezone forcing GMT
        if (isNaN(parsed.getTime())) return "Recent";
        return parsed.toLocaleDateString() + ' ' + parsed.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
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
                
                {/* Profile Section (Right Side on Tablet/desktop, Top on Mobile) */}
                <motion.div 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="profile-section card-glass"
                >
                    <div className="profile-card">
                        <div className="avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
                            {profilePic ? (
                                <img src={profilePic} alt="Profile" className="profile-image" />
                            ) : (
                                <div className="profile-avatar-fallback">
                                    {getInitials(userName)}
                                </div>
                            )}
                            <div className="avatar-overlay">
                                <Camera size={18} />
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                        
                        <div className="profile-info">
                            <h2>{userName}</h2>
                            <p className="email-text">{userEmail}</p>
                            <span className="join-date">Joined {formatDate(joinDate)}</span>
                        </div>

                        <button className="logout-btn" onClick={onLogout}>
                            <LogOut size={16} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </motion.div>

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
                    
                    <div className="activity-list">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((item, idx) => (
                                <div key={item.id || idx} className="activity-item">
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
                                        onClick={() => setMode(item.mode || 'query')} 
                                        title="Jump to Module"
                                    >
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="activity-empty">
                                <p>No expeditions found. Start mapping your knowledge!</p>
                            </div>
                        )}
                    </div>
                </motion.div>

            </div>
        </div>
    );
};

export default HomePage;
