import React from 'react';
import { motion } from 'framer-motion';
import './GraphLoadingAnimation.css';

const GraphLoadingAnimation = () => {
    return (
        <div className="graph-loading-container">
            <div className="graph-loading-content">
                {/* Animated Neural Network */}
                <svg className="neural-network-svg" viewBox="0 0 400 400">
                    {/* Nodes */}
                    {[...Array(12)].map((_, i) => {
                        const angle = (i / 12) * Math.PI * 2;
                        const radius = 120;
                        const cx = 200 + Math.cos(angle) * radius;
                        const cy = 200 + Math.sin(angle) * radius;

                        return (
                            <motion.circle
                                key={`node-${i}`}
                                cx={cx}
                                cy={cy}
                                r="8"
                                fill="url(#nodeGradient)"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                    scale: [0, 1.2, 1],
                                    opacity: [0, 1, 0.8]
                                }}
                                transition={{
                                    duration: 1.5,
                                    delay: i * 0.1,
                                    repeat: Infinity,
                                    repeatDelay: 2
                                }}
                            />
                        );
                    })}

                    {/* Connecting Lines */}
                    {[...Array(12)].map((_, i) => {
                        const angle1 = (i / 12) * Math.PI * 2;
                        const angle2 = ((i + 1) / 12) * Math.PI * 2;
                        const radius = 120;
                        const x1 = 200 + Math.cos(angle1) * radius;
                        const y1 = 200 + Math.sin(angle1) * radius;
                        const x2 = 200 + Math.cos(angle2) * radius;
                        const y2 = 200 + Math.sin(angle2) * radius;

                        return (
                            <motion.line
                                key={`line-${i}`}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="url(#lineGradient)"
                                strokeWidth="2"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{
                                    pathLength: [0, 1],
                                    opacity: [0, 0.6, 0.3]
                                }}
                                transition={{
                                    duration: 2,
                                    delay: i * 0.15,
                                    repeat: Infinity,
                                    repeatDelay: 1.5
                                }}
                            />
                        );
                    })}

                    {/* Center Pulse */}
                    <motion.circle
                        cx="200"
                        cy="200"
                        r="20"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="3"
                        animate={{
                            r: [20, 80, 20],
                            opacity: [1, 0, 1]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />

                    {/* Gradients */}
                    <defs>
                        <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
                            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Loading Text */}
                <motion.div
                    className="loading-text-container"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3 className="loading-title">Constructing Knowledge Graph</h3>
                    <motion.p
                        className="loading-subtitle"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        Analyzing concepts and relationships...
                    </motion.p>
                </motion.div>

                {/* Floating Particles */}
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={`particle-${i}`}
                        className="floating-particle"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                            y: [0, -30, 0],
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0]
                        }}
                        transition={{
                            duration: 3 + Math.random() * 2,
                            delay: Math.random() * 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default GraphLoadingAnimation;
