import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TypingText from './TypingText';
import SkeletonLoader from './SkeletonLoader';
import '../App.css';
import './NodeExplanation.css';

const WikipediaImage = ({ query, fallbackSeed, onClickView, onClickSource }) => {
    const [imgUrl, setImgUrl] = useState(null);
    const [sourceUrl, setSourceUrl] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const fetchWiki = async () => {
            try {
                // Simplify query to grab the most prominent entity
                const cleanQuery = query.split(' - ')[0].split(' — ')[0].trim();
                const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`);
                if (!res.ok) throw new Error("Wiki search failed");
                const data = await res.json();

                if (data.thumbnail && data.thumbnail.source) {
                    // Wiki uses smaller thumbnails by default. We can request a larger size by tweaking URL format if needed, but the provided source is usually decent.
                    setImgUrl(data.thumbnail.source);
                    setSourceUrl(data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanQuery)}`);
                } else {
                    setFailed(true);
                }
            } catch (err) {
                setFailed(true);
            }
        };
        fetchWiki();
    }, [query]);

    // Fallback visually pleasing internet placeholder if Wiki entity has no hero image
    const finalUrl = failed ? `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/300` : imgUrl;
    const finalSource = failed ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}` : sourceUrl;

    return (
        <div className="node-explore-image-preview">
            {!finalUrl ? (
                <div className="node-explore-image-fallback" style={{ fontSize: '18px' }}>Loading...</div>
            ) : (
                <>
                    <img
                        src={finalUrl}
                        alt={query}
                        loading="lazy"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                    <div className="node-explore-image-fallback" style={{ display: 'none' }}>🔍</div>
                    <div className="node-explore-image-hover-overlay">
                        <button className="img-hover-btn" onClick={() => onClickView(finalUrl)}>View</button>
                        <a href={finalSource} target="_blank" rel="noopener noreferrer" className="img-hover-btn outline">Open Source</a>
                    </div>
                </>
            )}
        </div>
    );
};

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NodeExplorationItem = ({ data, onUpdate }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(data.activeTab || 'text');
    const [selectedImageDialog, setSelectedImageDialog] = useState(null);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        if (onUpdate) onUpdate({ ...data, activeTab: tabId });
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
                {[
                    { id: 'text', label: 'Text Response' },
                    { id: 'refs', label: 'External References' },
                    { id: 'images', label: 'Images' },
                    { id: 'videos', label: 'Videos' },
                ].map(tab => (
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
                                    <div key={i} className="node-explore-image-item">
                                        <WikipediaImage
                                            query={`${data.nodeLabel} ${img.title}`}
                                            fallbackSeed={data.nodeLabel + img.title}
                                            onClickView={setSelectedImageDialog}
                                            onClickSource={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(data.nodeLabel + ' ' + img.title)}`)}
                                        />
                                        <div className="node-explore-image-info">
                                            <span className="node-explore-image-title">{img.title}</span>
                                            {img.description && <p className="node-explore-image-desc">{img.description}</p>}
                                        </div>
                                    </div>
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
