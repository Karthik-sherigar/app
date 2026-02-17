import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Youtube, Image as ImageIcon, ChevronRight } from 'lucide-react';
import './NodeExplanation.css';

const NodeExplanation = ({ nodeData, onExploreFurther }) => {
    const [selectedImage, setSelectedImage] = useState(null);

    const { label, explanation, media, videos, externalLinks } = nodeData;

    return (
        <motion.div
            className="node-explanation-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            {/* Header */}
            <div className="explanation-header">
                <h2 className="explanation-title">{label}</h2>
            </div>

            {/* Overview Section */}
            {explanation?.overview && (
                <div className="explanation-section">
                    <h3 className="section-title">Overview</h3>
                    <p className="section-content">{explanation.overview}</p>
                </div>
            )}

            {/* Detailed Content */}
            {explanation?.details && explanation.details.length > 0 && (
                <div className="explanation-section">
                    <h3 className="section-title">Detailed Explanation</h3>
                    {explanation.details.map((detail, index) => (
                        <p key={index} className="section-content detail-paragraph">
                            {detail}
                        </p>
                    ))}
                </div>
            )}

            {/* Key Points */}
            {explanation?.keyPoints && explanation.keyPoints.length > 0 && (
                <div className="explanation-section">
                    <h3 className="section-title">Key Points</h3>
                    <ul className="key-points-list">
                        {explanation.keyPoints.map((point, index) => (
                            <motion.li
                                key={index}
                                className="key-point-item"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <span className="bullet">•</span>
                                <span>{point}</span>
                            </motion.li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Image Gallery */}
            {media && media.length > 0 && (
                <div className="explanation-section">
                    <h3 className="section-title">
                        <ImageIcon size={20} />
                        Visual Content
                    </h3>
                    <div className="media-gallery">
                        {media.map((img, index) => (
                            <motion.div
                                key={index}
                                className="media-item"
                                whileHover={{ scale: 1.05 }}
                                onClick={() => setSelectedImage(img)}
                            >
                                <img src={img.url} alt={img.caption || `Visual ${index + 1}`} />
                                {img.caption && <p className="media-caption">{img.caption}</p>}
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Video Section */}
            {videos && videos.length > 0 && (
                <div className="explanation-section">
                    <h3 className="section-title">
                        <Youtube size={20} />
                        Educational Videos
                    </h3>
                    <div className="video-grid">
                        {videos.map((video, index) => (
                            <div key={index} className="video-item">
                                <div className="video-embed">
                                    <iframe
                                        src={video.embedUrl}
                                        title={video.title}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                                <p className="video-title">{video.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* External Links */}
            {externalLinks && externalLinks.length > 0 && (
                <div className="explanation-section">
                    <h3 className="section-title">
                        <ExternalLink size={20} />
                        External Resources
                    </h3>
                    <div className="external-links-grid">
                        {externalLinks.map((link, index) => (
                            <motion.a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="external-link-card"
                                whileHover={{ scale: 1.02, y: -2 }}
                            >
                                <div className="link-icon">
                                    <ExternalLink size={16} />
                                </div>
                                <div className="link-content">
                                    <h4 className="link-title">{link.title}</h4>
                                    <p className="link-description">{link.description}</p>
                                </div>
                            </motion.a>
                        ))}
                    </div>
                </div>
            )}

            {/* Explore Further Button */}
            <div className="explore-further-section">
                <motion.button
                    className="explore-further-btn"
                    onClick={onExploreFurther}
                    whileHover={{ scale: 1.05, x: 5 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <span>Explore Further</span>
                    <ChevronRight size={20} />
                </motion.button>
            </div>

            {/* Image Lightbox */}
            {selectedImage && (
                <motion.div
                    className="image-lightbox"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setSelectedImage(null)}
                >
                    <img src={selectedImage.url} alt={selectedImage.caption} />
                </motion.div>
            )}
        </motion.div>
    );
};

export default NodeExplanation;
