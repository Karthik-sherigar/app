import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getIconForType } from './utils/iconMapper';
import './NodeCard.css';

const NodeCard = ({ node, onClick, style }) => {
    const [isHovered, setIsHovered] = useState(false);
    const Icon = getIconForType(node.type);

    // Dynamic Contextual Imagery from LoremFlickr (Unsplash Source is deprecated)
    // Using keywords: label, type, and learning to get relevant educational visuals
    const cleanLabel = node.label.replace(/[^a-zA-Z0-9 ]/g, ''); // Clean for better URL matching
    const cardImage = `https://loremflickr.com/600/400/${encodeURIComponent(cleanLabel)},concept,education/all`;

    // Type-based fallback colors (used in CSS via style mapping if image fails)
    const typeThemes = {
        concept: '#6366f1',
        prerequisite: '#f59e0b',
        application: '#22c55e',
        component: '#0ea5e9',
        codeblock: '#ec4899',
        documentsection: '#d946ef'
    };
    const themeColor = typeThemes[node.type.toLowerCase()] || '#6366f1';

    return (
        <motion.div
            className={`node-card node-${node.type.toLowerCase()}`}
            style={style}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ y: -10, rotateX: -2, rotateY: 2 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={() => onClick && onClick(node)}
        >
            {/* Main Visual Image Container */}
            <div className="card-image-container">
                <img
                    src={cardImage}
                    alt={node.label}
                    className="card-image"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                    }}
                />
                <div className="card-image-fallback" style={{ background: `linear-gradient(135deg, ${themeColor}44, ${themeColor}11)` }} />
                <div className="card-image-overlay" />

                {/* Dynamic Icon Floating in Image area */}
                <div className="card-icon-floating" style={{ borderColor: `${themeColor}44` }}>
                    <Icon size={24} strokeWidth={2} style={{ color: themeColor }} />
                </div>
            </div>

            {/* Immersive Glassmorphism Content */}
            <div className="card-content-immersive">
                <div className="card-header-row">
                    <span className="card-type-label">{node.type}</span>
                    {node.importance && (
                        <div className={`importance-tag ${node.importance.toLowerCase()}`}>
                            {node.importance}
                        </div>
                    )}
                </div>

                <h3 className="card-title-immersive">{node.label}</h3>

                <p className="card-description-immersive">
                    {node.description || `Learning about ${node.label} is a key step in this knowledge journey.`}
                </p>

                <div className="card-footer-action">
                    <span>Discover Concept</span>
                    <motion.span
                        animate={{ x: isHovered ? 5 : 0 }}
                        className="arrow-icon"
                    >
                        →
                    </motion.span>
                </div>
            </div>

            {/* Subtle premium glow border */}
            <div className="card-border-glow" />
        </motion.div>
    );
};

export default NodeCard;
