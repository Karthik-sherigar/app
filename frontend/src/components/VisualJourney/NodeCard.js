import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getIconForType } from './utils/iconMapper';
import './NodeCard.css';

const NodeCard = ({ node, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);
    const Icon = getIconForType(node.type);

    // SMARTER IMAGING (V5 - AI PROMPT DRIVEN):
    // Use the image_prompt from the backend if available, fallback to label.
    const cleanLabel = (node.label || node.id).replace(/[^a-zA-Z0-9]/g, '');
    const imageQuery = node.image_prompt || node.label || 'technology';
    const seed = node.id.split('-').shift() || '0';

    // Deterministic tech-keyword image using node-specific AI prompt
    const cardImage = `https://loremflickr.com/600/400/${encodeURIComponent(imageQuery.split(' ').slice(0, 2).join(','))},tech?lock=${seed.length * 99}`;

    const typeThemes = {
        concept: '#6366f1',
        prerequisite: '#f59e0b',
        application: '#22c55e',
        component: '#0ea5e9',
        codeblock: '#ec4899',
        documentsection: '#d946ef'
    };
    const themeColor = typeThemes[node.type?.toLowerCase()] || '#6366f1';

    // Sub-concepts for the hover bubbles (extracted from description)
    const subConcepts = node.description ?
        node.description.split(' ').filter(w => w.length > 3).slice(0, 3).map(w => w.replace(/[^a-zA-Z]/g, '')) :
        ['Logic', 'Core', 'Flow'];

    return (
        <motion.div
            className={`node-card-v4 node-${node.type?.toLowerCase() || 'concept'}`}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -15, scale: 1.05 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={() => onClick && onClick(node)}
        >
            {/* Hover Discovery Bubbles */}
            <AnimatePresence>
                {isHovered && subConcepts.map((skill, i) => (
                    <motion.div
                        key={i}
                        className="discovery-bubble"
                        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            x: Math.cos(i * (Math.PI * 2 / subConcepts.length)) * 140,
                            y: Math.sin(i * (Math.PI * 2 / subConcepts.length)) * 140
                        }}
                        exit={{ opacity: 0, scale: 0 }}
                        style={{ border: `1px solid ${themeColor}aa` }}
                    >
                        {skill}
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Visual Header */}
            <div className="card-visual-header">
                {!imageError ? (
                    <div
                        className="card-image-v4"
                        style={{
                            backgroundImage: `url(${cardImage})`,
                            filter: isHovered ? 'grayscale(0%) brightness(120%)' : 'grayscale(100%) brightness(50%) blur(1px)'
                        }}
                    >
                        <img
                            src={cardImage}
                            alt=""
                            style={{ display: 'none' }}
                            onError={() => setImageError(true)}
                        />
                    </div>
                ) : (
                    <div className="card-image-v4 fallback-pattern" style={{
                        background: `radial-gradient(circle at center, ${themeColor}44, #0b1220)`
                    }} />
                )}

                <div className="card-image-mask" />

                <div className="node-type-badge" style={{ backgroundColor: `${themeColor}22`, color: themeColor, borderColor: `${themeColor}44` }}>
                    <Icon size={14} />
                    <span>{node.type || 'Concept'}</span>
                </div>
            </div>

            {/* Expanded Content Area */}
            <div className="card-content-v4">
                <div className="importance-bar">
                    <div className={`importance-fill ${node.importance?.toLowerCase() || 'medium'}`} />
                </div>

                <h3 className="card-title-v4">{node.label}</h3>

                <p className="card-description-v4">
                    {node.description || `Learning about ${node.label} reveals critical insights into the structure and behavior of this domain.`}
                    {" This discovery station provides the foundational logic required to bridge advanced theory and practical implementation."}
                </p>

                <div className="card-footer-v4">
                    <div className="action-label" style={{ color: themeColor }}>
                        DISCOVER STATION
                        <motion.span animate={{ x: isHovered ? 5 : 0 }}>→</motion.span>
                    </div>
                </div>
            </div>

            {/* Dynamic Glow Overlay */}
            <div className="card-inner-glow" style={{ background: `radial-gradient(circle at 50% 120%, ${themeColor}33, transparent 70%)` }} />
        </motion.div>
    );
};

export default NodeCard;
