import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Play, Image as ImageIcon } from 'lucide-react';
import './NodeDetailSection.css';

const NodeDetailSection = ({ node, onExploreMore }) => {
    if (!node) return null;

    const { title, explanation, media = [], externalLinks = [] } = node;

    return (
        <motion.div
            className="node-detail-section"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            {/* Header */}
            <div className="detail-header">
                <div className="detail-icon">
                    <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="url(#iconGradient)" />
                        <defs>
                            <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <h2 className="detail-title">{title || node.label}</h2>
            </div>

            {/* Explanation Content */}
            <div className="detail-content">
                {explanation?.overview && (
                    <div className="detail-overview">
                        <h3>Overview</h3>
                        <p>{explanation.overview}</p>
                    </div>
                )}

                {explanation?.details && explanation.details.length > 0 && (
                    <div className="detail-explanation">
                        <h3>Detailed Explanation</h3>
                        {explanation.details.map((detail, index) => (
                            <p key={index}>{detail}</p>
                        ))}
                    </div>
                )}

                {explanation?.keyPoints && explanation.keyPoints.length > 0 && (
                    <div className="detail-key-points">
                        <h3>Key Points</h3>
                        <ul>
                            {explanation.keyPoints.map((point, index) => (
                                <li key={index}>{point}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Media Gallery */}
            {media && media.length > 0 && (
                <div className="detail-media">
                    <h3>Visual Resources</h3>
                    <div className="media-grid">
                        {media.map((item, index) => (
                            <motion.div
                                key={index}
                                className="media-item"
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 0.2 }}
                            >
                                {item.type === 'image' ? (
                                    <div className="media-image">
                                        <ImageIcon size={24} />
                                        <span>{item.caption || 'Image'}</span>
                                    </div>
                                ) : item.type === 'video' ? (
                                    <div className="media-video">
                                        <Play size={24} />
                                        <span>{item.title || 'Video'}</span>
                                    </div>
                                ) : null}
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* External Links */}
            {externalLinks && externalLinks.length > 0 && (
                <div className="detail-links">
                    <h3>External Resources</h3>
                    <div className="links-grid">
                        {externalLinks.map((link, index) => (
                            <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="external-link"
                            >
                                <ExternalLink size={18} />
                                <span>{link.title}</span>
                                {link.source && <span className="link-source">({link.source})</span>}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Explore More Button */}
            <motion.button
                className="explore-more-btn"
                onClick={() => onExploreMore && onExploreMore(node)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                Explore More {'>'}{'>'}{'>'}
            </motion.button>
        </motion.div>
    );
};

export default NodeDetailSection;
