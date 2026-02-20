import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send } from 'lucide-react';
import TypingText from './TypingText';
import '../App.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NodeExplorationItem = ({ data }) => {
    const [activeTab, setActiveTab] = useState('text');
    const [question, setQuestion] = useState('');
    const [chatHistory, setChatHistory] = useState([]); // Array of { role: 'user'|'ai', content: string, typing?: boolean } // Modified
    const [asking, setAsking] = useState(false);
    const chatEndRef = useRef(null); // Added ref

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, asking]); // Added useEffect

    const handleAsk = async () => {
        if (!question.trim()) return;

        const currentQuestion = question;
        setQuestion(''); // Clear input immediately
        setAsking(true);

        // Add user message to history
        setChatHistory(prev => [...prev, { role: 'user', content: currentQuestion }]);

        try {
            // Include previous history in context? For now, we just send node context.
            // Feature improvement: Append chat history to context for multi-turn.
            const res = await axios.post(`${API}/ask-node`, { // Changed API_BASE_URL to API, and node to data
                nodeLabel: data.nodeLabel || data.title, // Changed node.label || node.id to data.nodeLabel || data.title
                context: JSON.stringify(data.textResponse || data.explanation || {}), // Changed node.explanation to data.textResponse || data.explanation
                question: currentQuestion
            });

            // Add AI message with typing effect
            setChatHistory(prev => [...prev, {
                role: 'ai',
                content: res.data.answer,
                typing: true
            }]);
        } catch (e) {
            console.error(e);
            const errorMsg = e.response?.data?.detail || "Failed to get an answer. Please try again."; // Added error handling
            setChatHistory(prev => [...prev, { role: 'ai', content: errorMsg, typing: true }]); // Added typing to error message
        } finally {
            setAsking(false);
        }
    };

    const handleTypingComplete = (index) => { // Added new function
        setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory[index]) {
                newHistory[index] = { ...newHistory[index], typing: false };
            }
            return newHistory;
        });
    };

    if (!data) return null;

    return (
        <div id={`explanation-${data.nodeId}`} className="node-explore-section">
            <div className="node-explore-divider" />

            {/* Centered node title */}
            <div className="node-explore-header">
                <h2 className="node-explore-title">{data.title || data.nodeLabel}</h2>
            </div>

            {/* Tab bar */}
            <div className="node-explore-tabs">
                <button
                    className={`node-explore-tab-btn${activeTab === 'ask' ? ' active' : ''}`}
                    onClick={() => setActiveTab('ask')}
                >
                    Ask
                </button>
                {[
                    { id: 'text', label: 'Text Response' },
                    { id: 'refs', label: 'External References' },
                    { id: 'images', label: 'Images' },
                    { id: 'videos', label: 'Videos' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`node-explore-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}

                {/* Explore More Button (Last) */}
                <button
                    className="node-explore-tab-btn explore-more-btn"
                    onClick={() => window.open(`/explore/${data.nodeId}`, '_blank')}
                    style={{ marginLeft: 'auto', backgroundColor: 'rgba(50, 150, 255, 0.2)', color: '#4da6ff' }}
                >
                    Explore More ↗
                </button>
            </div>

            {/* Tab content */}
            <div className="node-explore-content">

                {/* ASK TAB */}
                {activeTab === 'ask' && (
                    <div className="node-explore-ask">
                        <div className="ask-input-wrapper">
                            <input
                                type="text"
                                className="ask-input"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder={`Ask about ${data.nodeLabel}...`}
                                onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                            />
                            <button
                                className="ask-send-btn"
                                onClick={handleAsk}
                                disabled={asking || !question.trim()}
                            >
                                <Send size={18} />
                            </button>
                        </div>

                        <div className="ask-chat-history">
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`ask-message ${msg.role}`}>
                                    <div className="ask-message-label">
                                        {msg.role === 'user' ? 'You' : 'AI Assistant'}
                                    </div>
                                    <div className="ask-message-content">
                                        {msg.role === 'ai' && msg.typing ? (
                                            <TypingText
                                                text={msg.content}
                                                speed={20}
                                                onComplete={() => handleTypingComplete(idx)}
                                            />
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            ))}

                            {asking && (
                                <div className="ask-message ai">
                                    <div className="ask-message-label">AI Assistant</div>
                                    <div className="ask-thinking">
                                        Thinking<span className="dots">.</span>
                                    </div>
                                </div>
                            )}

                            {chatHistory.length === 0 && !asking && (
                                <div className="node-explore-empty">
                                    Has a specific question about this node? Ask above.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TEXT RESPONSE */}
                {activeTab === 'text' && (
                    <div className="node-explore-text">
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
                    </div>
                )}

                {/* EXTERNAL REFERENCES */}
                {activeTab === 'refs' && (
                    <div className="node-explore-refs">
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
                    </div>
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
                        <div className="node-explore-images" >
                            {
                                imgs.map((img, i) => (
                                    <a key={i} href={img.googleSearchUrl} target="_blank" rel="noopener noreferrer" className="node-explore-image-item">
                                        <div className="node-explore-image-preview">
                                            <img
                                                src={`https://image.pollinations.ai/prompt/${encodeURIComponent(data.nodeLabel + " " + img.title)}?width=400&height=300&nologo=true`}
                                                alt={img.title}
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex'; // Show fallback
                                                }}
                                            />
                                            <div className="node-explore-image-fallback" style={{ display: 'none' }}>🔍</div>
                                        </div>
                                        <div className="node-explore-image-info">
                                            <span className="node-explore-image-title">{img.title}</span>
                                            {img.description && <p className="node-explore-image-desc">{img.description}</p>}
                                            <span className="node-explore-image-cta">View on Google Images →</span>
                                        </div>
                                    </a>
                                ))
                            }
                            {imgs.length === 0 && (
                                <p className="node-explore-empty">No images available.</p>
                            )
                            }
                        </div>
                    );
                })()}

                {/* VIDEOS */}
                {activeTab === 'videos' && (
                    <div className="node-explore-videos">
                        {(data.videos || []).map((vid, i) => (
                            <div key={i} className="node-explore-video-item">
                                <div className="node-explore-video-embed">
                                    <iframe
                                        src={vid.embedUrl}
                                        title={vid.title}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                                <h4 className="node-explore-video-title">{vid.title}</h4>
                                {vid.description && <p className="node-explore-video-desc">{vid.description}</p>}
                            </div>
                        ))}
                        {(!data.videos || data.videos.length === 0) && (
                            <p className="node-explore-empty">No videos available.</p>
                        )}
                    </div>
                )}

            </div>
        </div >
    );
};

export default NodeExplorationItem;
