import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, BookOpen, Sparkles, FileText, 
    Zap, Target, Send, Bot, User, Brain, 
    Sigma, ListTree, HelpCircle, Loader2,
    Code, History, Maximize2, Minimize2, X, MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './PDFExplorationPage.css';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const PDFExplorationPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    
    const nodeId = queryParams.get('nodeId');
    const label = queryParams.get('label') || 'Module Content';
    const historyId = queryParams.get('historyId');
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chatMessages, setChatMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        const fetchDeepDive = async () => {
            try {
                const res = await axios.post(`${API}/pdf/deep-dive`, {
                    nodeId,
                    nodeLabel: label,
                    historyId: parseInt(historyId)
                });
                setData(res.data);
            } catch (err) {
                console.error("Deep dive fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        if (nodeId && historyId) {
            fetchDeepDive();
        }
    }, [nodeId, label, historyId]);

    const chatContainerRef = useRef(null);

    // Use direct scrollTop assignment to prevent scrollIntoView from elevating the whole page
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages, isTyping]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const newMessage = { role: 'user', content: userInput };
        setChatMessages(prev => [...prev, newMessage]);
        setUserInput('');
        setIsTyping(true);

        try {
            const res = await axios.post(`${API}/pdf/chat`, {
                nodeId,
                nodeLabel: label,
                historyId: parseInt(historyId),
                message: userInput,
                history: chatMessages.slice(-5)
            });
            setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
        } catch (err) {
            console.error("Chat error:", err);
            setChatMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const getSectionIcon = (type) => {
        switch (type) {
            case 'text': return <BookOpen size={20} />;
            case 'technical': return <Zap size={20} />;
            case 'expressions': return <Sigma size={20} />;
            case 'evolution': return <History size={20} />;
            case 'problems': return <HelpCircle size={20} />;
            case 'visual_ref': return <Brain size={20} />;
            case 'code': return <Code size={20} />;
            case 'subconcepts': return <ListTree size={20} />;
            default: return <FileText size={20} />;
        }
    };

    // Convert inline bullet characters to proper markdown list syntax and prevent accidental code-blocks
    const preprocessContent = (text) => {
        if (!text) return text;
        
        // Remove 4-space indents at the start of lines to prevent Markdown from treating them as literal <pre> code blocks.
        // This is what causes **bold** stars to show up instead of rendering bold text.
        let processedText = text.replace(/^[ \t]{2,}-/gm, '-');
        processedText = processedText.replace(/^[ \t]{4}/gm, '');

        // Quick check — if no bullet characters, return as-is
        if (!/[•●·]/.test(processedText)) return processedText;

        // Split text by bullet characters
        const segments = processedText.split(/\s*[•●·]\s*/);
        if (segments.length <= 1) return text;

        const intro = segments[0].trim();
        const items = segments.slice(1).map(s => s.trim()).filter(Boolean);

        if (items.length === 0) return text;

        // Rebuild: intro paragraph + markdown list
        const listMarkdown = items.map(item => `- ${item}`).join('\n');
        return intro ? `${intro}\n\n${listMarkdown}` : listMarkdown;
    };

    // Clean AI-generated titles to strip out raw markdown formatting (like ** or #)
    const cleanTitle = (t) => {
        if (!t) return '';
        return t.replace(/[*#_]/g, '').trim();
    };

    if (loading) {
        return (
            <div className="pdf-explore-container loader-screen">
                <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
                <p>Synthesizing Document Intelligence...</p>
            </div>
        );
    }

    return (
        <div className="pdf-explore-app">
            <nav className="explore-nav">
                <button onClick={() => {
                    if (historyId) {
                        // Directly force a fresh reload of the main App initialized to target restoration under the correct /path
                        window.location.href = `/pdf?restoreMode=pdf&historyId=${historyId}`;
                    } else {
                        navigate('/pdf');
                    }
                }} className="back-btn">
                    <ChevronLeft size={20} />
                    <span>Back to Journey</span>
                </button>
                <div className="nav-topic">
                    <Brain size={18} />
                    <span>Document Intelligence</span>
                </div>
            </nav>

            <div className="explore-workspace">
                <main className="main-content-area">
                    <header className="exploration-header">
                        <div className="topic-badge">
                            <Sparkles size={14} />
                            FORMAL STUDY MODULE
                        </div>
                        <h1>{cleanTitle(data?.title || label)}</h1>
                        <div className="source-citation">Strict context analysis for: {nodeId}</div>
                    </header>

                    <div className="content-grid">
                        <div className="grid-main">
                            {data?.sections?.map((section, index) => (
                                <section key={index} className={`academic-section ${section.type}`}>
                                    <div className="section-label">
                                        {getSectionIcon(section.type)}
                                        <h2>{cleanTitle(section.title)}</h2>
                                    </div>
                                    <div className="prose">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {preprocessContent(section.content)}
                                        </ReactMarkdown>
                                    </div>
                                </section>
                            ))}
                            
                            {(!data?.sections || data.sections.length === 0) && (
                                <div className="empty-state">
                                    <HelpCircle size={48} />
                                    <h3>No specific modules found in the selected range.</h3>
                                    <p>Try asking the AI Partner for specific details about this topic.</p>
                                </div>
                            )}
                        </div>

                        <aside className="grid-sidebar">
                            <div className="sidebar-card takeaways">
                                <h3><Target size={16} /> Context Summary</h3>
                                <div className="sidebar-summary">
                                    {data?.sections?.[0]?.content?.substring(0, 300)}...
                                </div>
                            </div>
                            
                            <div className="sidebar-card visual-viz">
                                <h3><Brain size={16} /> Document Reference</h3>
                                <div className="viz-placeholder">
                                    <div className="viz-pulse"></div>
                                    <span>Mapping extracted data...</span>
                                </div>
                            </div>
                        </aside>
                    </div>
                </main>

                <aside className={`ai-study-partner ${isExpanded ? ' expanded' : ''} ${isMobileChatOpen ? 'mobile-open' : ''}`}>
                    
                    {/* Mobile Only Header Close Button */}
                    <button 
                        className="mobile-close-chat-btn"
                        onClick={() => setIsMobileChatOpen(false)}
                    >
                        <X size={20} />
                    </button>
                    <div className="partner-header">
                        <Bot size={20} />
                        <h3>AI Study Partner</h3>
                        <button
                            className="expand-btn"
                            onClick={() => setIsExpanded(v => !v)}
                            title={isExpanded ? 'Minimize' : 'Maximize'}
                        >
                            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    </div>

                    <div className="chat-container">
                        {/* TERNARY: only one child is alive at a time — no blank space from competing flex:1 siblings */}
                        {chatMessages.length === 0 ? (
                            <div className="chat-empty-state">
                                <div className="chat-bot-icon">
                                    <Bot size={32} />
                                </div>
                                <p className="chat-empty-title">Ask me anything about <strong>{label}</strong></p>
                                <p className="chat-empty-sub">I'll answer using only your PDF content.</p>
                                <div className="suggestion-chips">
                                    {[
                                        `Summarize ${label}`,
                                        `What are the key components?`,
                                        `Explain the main algorithm`,
                                        `What problems does this solve?`,
                                        `Give me an example`
                                    ].map((chip, i) => (
                                        <button
                                            key={i}
                                            className="suggestion-chip"
                                            onClick={() => setUserInput(chip)}
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="messages-list" ref={chatContainerRef}>
                                <div className="messages-inner">
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`message ${msg.role}`}>
                                            <div className="msg-icon">
                                                {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                                            </div>
                                            <div className="msg-content">
                                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                    {preprocessContent(msg.content)}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    ))}
                                    {isTyping && (
                                        <div className="message assistant">
                                            <div className="msg-icon"><Bot size={14} /></div>
                                            <div className="msg-content typing-indicator">
                                                <span /><span /><span />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} style={{height: 4}} />
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSendMessage} className="chat-input-form">
                        <input
                            type="text"
                            placeholder="Query the document..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                        />
                        <button type="submit" disabled={isTyping}>
                            {isTyping ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                        </button>
                    </form>
                </aside>
                
                {/* Mobile Floating Chat Toggle Button */}
                <button 
                    className={`mobile-chat-fab ${isMobileChatOpen ? 'hidden' : ''}`}
                    onClick={() => setIsMobileChatOpen(true)}
                >
                    <MessageSquare size={24} />
                </button>
            </div>
        </div>
    );
};

export default PDFExplorationPage;
