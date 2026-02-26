import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Compass, Network, Lightbulb } from 'lucide-react';
import './QueryLanding.css';

const QueryLanding = () => {
    const features = [
        { icon: <Compass size={14} />, title: "Explore Topics", desc: "Discover deep relations in any subject." },
        { icon: <Network size={14} />, title: "Visualize Maps", desc: "See complex architectures visually." },
        { icon: <Lightbulb size={14} />, title: "AI Analysis", desc: "Get intelligent insights and explanations." }
    ];

    return (
        <div className="query-landing-container">
            {/* Animated Background Elements */}
            <div className="query-bg-blur query-bg-blur-1"></div>
            <div className="query-bg-blur query-bg-blur-2"></div>
            <div className="query-grid-bg"></div>

            <motion.div 
                className="query-landing-content"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <div className="query-header-badge">
                    <Sparkles size={12} className="badge-icon" />
                    <span>NATURAL LANGUAGE EXPLORATION</span>
                </div>

                <h1 className="query-landing-title">
                    Uncover Intelligent <br/>
                    <span className="text-gradient">Knowledge Structures</span>
                </h1>
                
                <p className="query-landing-subtitle">
                    Type any topic, concept, or question below. Our AI engine will dynamically generate an interactive knowledge graph to help you map related entities and grasp complex ideas instantly.
                </p>

                {/* Feature highlights */}
                <div className="query-features-grid">
                    {features.map((ft, idx) => (
                        <motion.div 
                            key={idx}
                            className="feature-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + (idx * 0.1) }}
                        >
                            <div className="feature-icon-wrapper">
                                {ft.icon}
                            </div>
                            <div className="feature-text">
                                <h4>{ft.title}</h4>
                                <p>{ft.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default QueryLanding;
