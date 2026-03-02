import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { 
    ChevronLeft, 
    Layers, 
    Lightbulb, 
    History, 
    Gamepad2, 
    HelpCircle, 
    ArrowRightCircle,
    Zap,
    Network,
    Send,
    Bot,
    Share2,
    Globe,
    ExternalLink,
    Cpu,
    Code,
    Scroll,
    Stethoscope,
    Scale,
    FlaskConical,
    Activity,
    Dna,
    Database,
    Brain,
    Sparkles,
    Maximize2,
    Minimize2
} from 'lucide-react';
import './ExplorationPage.css';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const getCategoryConfig = (category) => {
    const configs = {
        'TECH': { icon: Cpu, color: '#4da6ff', label: 'Tech & Architecture' },
        'COMP_SCI': { icon: Cpu, color: '#4da6ff', label: 'Tech & Architecture' },
        'HISTORY': { icon: Scroll, color: '#f59e0b', label: 'Historical Context' },
        'HUMANITIES': { icon: Scroll, color: '#f59e0b', label: 'Historical Context' },
        'MEDICAL': { icon: Stethoscope, color: '#ef4444', label: 'Medical & Bio' },
        'PHILOSOPHY': { icon: Scale, color: '#8b5cf6', label: 'Philosophical Inquiry' },
        'SCIENCE': { icon: FlaskConical, color: '#10b981', label: 'Scientific Framework' },
        'GENERAL': { icon: Sparkles, color: '#6366f1', label: 'Knowledge Synapse' }
    };
    return configs[category] || configs['GENERAL'];
};

const SkeletonDeepDive = () => (
    <div className="exploration-page skeleton">
        <div className="exploration-nav" style={{ opacity: 0.5 }}>
            <div className="skeleton-line" style={{ width: '150px' }}></div>
        </div>
        <main className="exploration-main">
            <div className="deep-dive-header" style={{ marginBottom: '60px' }}>
                <div className="skeleton-rect" style={{ width: '300px', height: '60px', margin: '0 auto 20px' }}></div>
                <div className="skeleton-line" style={{ width: '200px', margin: '0 auto' }}></div>
            </div>
            <div className="content-grid-v2">
                <div className="primary-content-stack">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="module-card v2 skeleton-card" style={{ padding: '24px' }}>
                            <div className="skeleton-line" style={{ width: '40%', marginBottom: '24px' }}></div>
                            <div className="skeleton-rect" style={{ width: '100%', height: '120px' }}></div>
                            <div className="skeleton-rect" style={{ width: '100%', height: '80px', marginTop: '16px' }}></div>
                        </div>
                    ))}
                </div>
                <div className="interaction-column">
                    <div className="module-card ai-tutor-v4 skeleton-card" style={{ height: '300px' }}>
                        <div className="skeleton-line" style={{ width: '50%', marginBottom: '24px' }}></div>
                        <div className="skeleton-rect" style={{ width: '100%', height: '60px', marginBottom: '16px', borderRadius: '12px' }}></div>
                        <div className="skeleton-rect" style={{ width: '80%', height: '60px', borderRadius: '12px', alignSelf: 'flex-end', marginLeft: 'auto' }}></div>
                    </div>
                     <div className="module-card challenge-v4 skeleton-card" style={{ height: '250px' }}>
                        <div className="skeleton-line" style={{ width: '40%', marginBottom: '24px' }}></div>
                        <div className="skeleton-line" style={{ width: '100%', marginBottom: '16px' }}></div>
                        <div className="skeleton-rect" style={{ width: '100%', height: '40px', marginBottom: '12px', borderRadius: '8px' }}></div>
                        <div className="skeleton-rect" style={{ width: '100%', height: '40px', borderRadius: '8px' }}></div>
                    </div>
                </div>
            </div>
        </main>
    </div>
);

const AtomicGraph = ({ concepts, onSelect }) => {
    // A simple interactive SVG graph for atomic concepts
    return (
        <div className="atomic-graph-container">
            <svg width="100%" height="300" viewBox="0 0 400 300">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Center Node */}
                <circle cx="200" cy="150" r="30" fill="rgba(99, 102, 241, 0.2)" stroke="var(--accent-primary)" strokeWidth="2" filter="url(#glow)" />
                <text x="200" y="155" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">ROOT</text>

                {concepts?.map((c, i) => {
                    const angle = (i / concepts.length) * 2 * Math.PI;
                    const x = 200 + Math.cos(angle) * 100;
                    const y = 150 + Math.sin(angle) * 100;
                    return (
                        <g key={i} className="graph-node-group" onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
                            <line x1="200" y1="150" x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                            <motion.circle 
                                cx={x} cy={y} r="20" 
                                fill="rgba(255,255,255,0.05)" 
                                stroke="var(--accent-primary)" 
                                whileHover={{ scale: 1.2, fill: "rgba(99, 102, 241, 0.3)" }}
                            />
                            <text x={x} y={y + 35} textAnchor="middle" fill="var(--text-muted)" fontSize="8">{c.label}</text>
                        </g>
                    );
                })}
            </svg>
            {/* Floating Selection Tooltip */}
            <AnimatePresence>
                {showAskTooltip && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{
                            position: 'absolute',
                            left: selectionPos.x,
                            top: selectionPos.y,
                            transform: 'translateX(-50%)',
                            zIndex: 1000,
                            pointerEvents: 'auto'
                        }}
                    >
                        <button 
                            className="ask-selection-btn"
                            onClick={handleAskSelected}
                        >
                            <Bot size={14} /> Ask AI
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ExplorationPage = () => {
    const { nodeId: paramNodeId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const rootTopic = queryParams.get('topic') || '';
    
    // Fallback: Manually extract nodeId from URL if not using standard Routes
    const nodeId = paramNodeId || window.location.pathname.split('/').pop();
    
    const [loading, setLoading] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [data, setData] = useState(null);
    const [selectedAtomic, setSelectedAtomic] = useState(null);
    const [chatQuestion, setChatQuestion] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isAsking, setIsAsking] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState({});
    const [error, setError] = useState(null);
    const [selectedLang, setSelectedLang] = useState('Python');
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [selectionText, setSelectionText] = useState('');
    const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 });
    const [showAskTooltip, setShowAskTooltip] = useState(false);
    const [isAiMaximized, setIsAiMaximized] = useState(false);
    const chatEndRef = useRef(null);
    const chatInputRef = useRef(null);

    useEffect(() => {
        let skeletonTimer;
        const fetchDeepDive = async () => {
            console.log("Deep Dive: Starting fetch for", nodeId);
            setLoading(true);
            setError(null);
            
            // Only show skeleton if loading takes more than 200ms
            skeletonTimer = setTimeout(() => setShowSkeleton(true), 200);
            
            setData(null);
            setQuizAnswers({});
            setSelectedAtomic(null);
            setChatHistory([]);
            try {
                const endpoint = `${API}/deep-dive`;
                console.log("Deep Dive: Calling endpoint", endpoint);
                const res = await axios.post(endpoint, {
                    nodeId: nodeId,
                    nodeLabel: nodeId.replace(/_/g, ' '),
                    context: rootTopic ? `In the context of the study of ${rootTopic}` : ''
                }, { timeout: 100000 }); // High timeout for LLM
                
                console.log("Deep Dive: Received data", res.data);
                setData(res.data);
            } catch (err) {
                console.error("Deep Dive: Fetch failed", err);
                setError(err.message || "Failed to establish pedagogical connection.");
                if (err.response) {
                    console.error("Deep Dive: Error status", err.response.status);
                    console.error("Deep Dive: Error data", err.response.data);
                    setError(`Server Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
                }
            } finally {
                clearTimeout(skeletonTimer);
                setLoading(false);
                setShowSkeleton(false);
            }
        };
        if (nodeId) fetchDeepDive();
        else console.warn("Deep Dive: No nodeId provided in URL");
        return () => clearTimeout(skeletonTimer);
    }, [nodeId, rootTopic]);

    const handleAskAI = async (directQuestion = null) => {
        // If directQuestion is a React event (e.g. from onClick={handleAskAI}), ignore it
        const q = typeof directQuestion === 'string' ? directQuestion : chatQuestion;
        
        if (!q || !q.trim() || typeof q.trim !== 'function') return;
        
        setChatQuestion('');
        setChatHistory(prev => [...prev, { role: 'user', content: q }]);
        setIsAsking(true);
        try {
            const res = await axios.post(`${API}/ask-node`, {
                nodeLabel: data.title,
                context: data.aiTutorContext || data.overview,
                question: q
            });
            setChatHistory(prev => [...prev, { role: 'ai', content: res.data.answer }]);
        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error." }]);
        } finally {
            setIsAsking(false);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [chatHistory, isAsking]);

    const handleTextSelection = (e) => {
        if (e.target.closest('.ask-selection-btn')) return;
        
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text && text.length > 3) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            console.log("Selection detected:", text);
            setSelectionText(text);
            setSelectionPos({
                x: rect.left + rect.width / 2,
                y: rect.top - 45 
            });
            setShowAskTooltip(true);
        } else {
            setShowAskTooltip(false);
        }
    };

    const handleAskSelected = () => {
        if (!selectionText) return;
        
        const question = `Regarding the selected text: "${selectionText}", could you explain this further in the context of ${data.title}?`;
        setShowAskTooltip(false);
        
        // Scroll to chat
        const chatElement = document.getElementById('ai-expert-chat');
        if (chatElement) {
            chatElement.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
                handleAskAI(question);
            }, 600);
        } else {
            handleAskAI(question);
        }
    };

    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection);
        return () => document.removeEventListener('mouseup', handleTextSelection);
    }, [data]);


    // Generate image via Freepik Mystic API whenever new data is loaded
    useEffect(() => {
        if (!data?.imagePrompt) {
            console.log("Image Gen: No imagePrompt in data", data);
            return;
        }
        let cancelled = false;
        const generateImage = async () => {
            console.log("Image Gen: Starting for prompt:", data.imagePrompt);
            setImageUrl(null);
            setImageLoading(true);
            try {
                const res = await axios.post(`${API}/generate-image`, {
                    prompt: data.imagePrompt,
                    nodeId: data.nodeId || nodeId, // Using the id from data or the URL param
                    context: rootTopic ? `In the context of the study of ${rootTopic}` : ''
                }, { timeout: 120000 });
                
                console.log("Image Gen: Response received", res.data);
                
                if (!cancelled && res.data?.image_url) {
                    setImageUrl(res.data.image_url);
                }
            } catch (err) {
                console.error('Image generation failed:', err);
            } finally {
                if (!cancelled) {
                    setImageLoading(false);
                    console.log("Image Gen: Finished loading state");
                }
            }
        };
        generateImage();
        return () => { cancelled = true; };
    }, [data, nodeId, rootTopic]);

    if (loading && showSkeleton) return <SkeletonDeepDive />;
    if (loading && !showSkeleton) return null; // Wait for the transition window

    if (error) {
        return (
            <div className="exploration-page gray">
                <div className="exploration-main error-view">
                    <History size={48} className="error-icon" />
                    <h2>Knowledge Synapse Interrupted</h2>
                    <p className="error-detail">{error}</p>
                    <div className="error-actions">
                        <button onClick={() => window.location.reload()} className="btn-primary">Retry Connection</button>
                        <button onClick={() => navigate(-1)} className="btn-outline">Return to Map</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="exploration-page gray">
                <div className="exploration-main">
                    <h2>Pedagogical Bridge Unavailable</h2>
                    <button onClick={() => navigate(-1)} className="btn-primary">Return to Map</button>
                </div>
            </div>
        );
    }

    const catConfig = getCategoryConfig(data.category);
    const CatIcon = catConfig.icon;

    return (
        <motion.div 
            className={`exploration-page dynamic-mode cat-${data?.category?.toLowerCase() || 'general'}`} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            style={{ "--cat-accent": catConfig.color }}
        >
            <nav className="exploration-nav">
                <button className="back-btn" onClick={() => {
                    if (window.history.length > 1) {
                        navigate(-1);
                    } else {
                        navigate('/');
                    }
                }}>
                    <ChevronLeft size={20} /> Back
                </button>
                <div className="category-pill" style={{ borderColor: catConfig.color, color: catConfig.color }}>
                    <CatIcon size={14} /> {data?.category || 'Checking...'}
                </div>
            </nav>

            <main className="exploration-main dynamic-container">
                {!data ? (
                    <div className="node-explore-loading">
                        <div className="node-explore-spinner"></div>
                        <span>Synchronizing Pedagogical Data...</span>
                    </div>
                ) : (
                    <>
                        <header className="dynamic-header">
                            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y:0, opacity:1 }}>
                                <h1 className="dynamic-title">{data.title}</h1>
                                <div className="textbook-divider"></div>
                            </motion.div>
                    
                    {data.imagePrompt && (
                        <motion.div 
                            className="concept-visualization"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={`Scientific Visualization: ${data.title}`}
                                    className="viz-image"
                                    style={{
                                        width: '100%',
                                        borderRadius: '12px',
                                        display: 'block',
                                        maxHeight: '440px',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <div className="viz-placeholder">
                                    <Activity size={48} className="animate-pulse" style={{ color: catConfig.color }} />
                                    <p>{imageLoading ? 'Generating visualization...' : `Scientific Visualization: ${data.title}`}</p>
                                    <span style={{ fontSize: '12px', opacity: 0.5 }}>{data.imagePrompt}</span>
                                </div>
                            )}
                        </motion.div>
                    )}

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity:1 }} transition={{ delay: 0.4 }} className="dynamic-overview">
                        {typeof data.overview === 'string'
                            ? data.overview.split('\n').filter(p => p.trim()).map((para, i) => (
                                <p key={i}>{para}</p>
                            ))
                            : <p>{String(data.overview || '')}</p>
                        }
                    </motion.div>
                </header>

                <section className="graph-strip">
                    <h3 className="module-tag">CONCEPTUAL RELATIONS</h3>
                    <div className="relation-bubbles">
                        {data.conceptGraph?.map((c, i) => (
                            <motion.div 
                                key={i} 
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}
                                className="relation-bubble"
                                onClick={() => navigate(`/explore/${c.label?.replace(/\s+/g, '_').toLowerCase()}`)}
                                whileHover={{ scale: 1.05 }}
                            >
                                <span className="rel-text">{c.label}</span>
                                <span className="rel-type">{c.relation}</span>
                            </motion.div>
                        ))}
                    </div>
                </section>

                <div className="content-grid-v2">
                    <div className="primary-content-stack">
                        {data.dynamicModules?.map((mod, i) => (
                            <motion.div key={i} className="module-card v2" initial={{ x: -20, opacity: 0 }} animate={{ x:0, opacity: 1 }} transition={{ delay: 0.3 + i*0.1 }}>
                                <h2 className="module-title-dynamic">{mod.title}</h2>
                                {mod.type === 'code' ? (
                                    <div className="code-environment">
                                        <div className="code-tabs">
                                            {Object.keys(mod.options || {}).map(lang => (
                                                <button 
                                                    key={lang} 
                                                    className={`code-tab ${selectedLang === lang ? 'active' : ''}`}
                                                    onClick={() => setSelectedLang(lang)}
                                                >
                                                    {lang}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="code-window">
                                            <pre className="code-block-v2">
                                                <code>{mod.options?.[selectedLang] || mod.content}</code>
                                            </pre>
                                        </div>
                                    </div>
                                ) : mod.type === 'steps' || mod.type === 'derivation' ? (
                                    <div className="algorithm-steps">
                                        {typeof mod.content === 'string'
                                            ? mod.content.split('\n').filter(l => l.trim()).map((line, idx) => (
                                                <div key={idx} className="step-row derivation-step">
                                                    <span className="step-idx">{idx + 1}</span>
                                                    <p className="step-content-text">{line.replace(/^\d+\.\s*/, '')}</p>
                                                </div>
                                            ))
                                            : <p>{String(mod.content || '')}</p>
                                        }
                                    </div>
                                ) : (
                                    <div className="standard-module-content">
                                        {typeof mod.content === 'string'
                                            ? mod.content.split('\n').filter(l => l.trim()).map((line, idx) => (
                                                <p key={idx}>{line.replace(/^\d+\.\s*/, '')}</p>
                                            ))
                                            : <p>{String(mod.content || '')}</p>
                                        }
                                    </div>
                                )}
                            </motion.div>
                        ))}

                        <section className="tips-section">
                            <h3 className="module-tag">MASTER TIPS & GOTCHAS</h3>
                            <div className="tips-grid">
                                {data.quickTips?.map((tip, i) => (
                                    <div key={i} className="tip-card"><Sparkles size={16} /> {tip}</div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="interaction-column">
                        <section className={`module-card ai-tutor-v4 ${isAiMaximized ? 'maximized' : ''}`} id="ai-expert-chat">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 className="module-title-dynamic"><Bot size={18} /> AI EXPERT</h2>
                                <button
                                    onClick={() => setIsAiMaximized(!isAiMaximized)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                >
                                    {isAiMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                            </div>
                            <div className="chat-v4">
                                <div className="messages-v4">
                                    {chatHistory.length === 0 && <p className="chat-welcome-v4">Need clarification on the {data.category} logic? Ask away!</p>}
                                    {chatHistory.map((m, i) => (
                                        <div key={i} className={`bubble-v4 ${m.role}`}>
                                            {m.role === 'ai' ? (
                                                <div className="ai-markdown-content">
                                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                                </div>
                                            ) : (
                                                m.content
                                            )}
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="input-v4">
                                    <input 
                                        ref={chatInputRef}
                                        value={chatQuestion} 
                                        onChange={e => setChatQuestion(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && handleAskAI()} 
                                        placeholder="Query logic..." 
                                    />
                                    <button onClick={() => handleAskAI()}><Send size={14} /></button>
                                </div>
                            </div>
                        </section>

                        <section className="module-card challenge-v4">
                            <h2 className="module-title-dynamic"><Zap size={18} /> VALIDATE</h2>
                            <div className="quiz-v4">
                                {data.knowledgeChallenge?.slice(0, 1).map((q, i) => (
                                    <div key={i}>
                                        <p className="q-v4">{q.question}</p>
                                        <div className="ops-v4">
                                            {q.options?.map((o, oi) => (
                                                <button 
                                                    key={oi} 
                                                    className={`op-btn-v4 ${quizAnswers[0] === oi ? (oi === q.answerIndex ? 'correct' : 'wrong') : ''}`}
                                                    onClick={() => setQuizAnswers({0: oi})}
                                                >
                                                    {o}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="further-queries-v2">
                            <h3 className="module-tag">PROACTIVE PATHS</h3>
                            <div className="path-tags">
                                {data.proactivePaths?.map((p, i) => (
                                    <button key={i} className="path-btn" onClick={() => navigate(`/explore/${typeof p === 'string' ? p.replace(/[?]/g, '').trim().replace(/\s+/g, '_').toLowerCase() : i}`)}>
                                        {String(p)} ↗
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </>
                )}
            </main>
            {/* Floating Selection Tooltip */}
            <AnimatePresence>
                {showAskTooltip && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{
                            position: 'fixed',
                            left: selectionPos.x,
                            top: selectionPos.y,
                            transform: 'translateX(-50%)',
                            zIndex: 100000,
                            pointerEvents: 'auto'
                        }}
                    >
                        <button 
                            className="ask-selection-btn"
                            style={{ border: '2px solid white' }} // Extra visibility 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAskSelected();
                            }}
                        >
                            <Bot size={14} /> Ask AI
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ExplorationPage;
