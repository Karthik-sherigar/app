import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getIconForType } from './utils/iconMapper';
import './ShapeNode.css';

const ShapeNode = ({ node, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const Icon = getIconForType(node.type);

    const typeThemes = {
        concept: '#6366f1',
        prerequisite: '#f59e0b',
        application: '#22c55e',
        component: '#0ea5e9',
        codeblock: '#ec4899',
        documentsection: '#d946ef',
        decision: '#ef4444',
        logicphase: '#10b981',
        datastore: '#f97316'
    };
    const themeColor = typeThemes[node.type?.toLowerCase()] || '#6366f1';

    // Smaller sizes for dialog mode mini-graph
    const sizeMap = {
        high: 100,
        medium: 80,
        low: 60
    };
    const size = sizeMap[node.importance?.toLowerCase()] || 80;

    // Shape rendering function
    const renderShape = () => {
        const nodeType = node.type?.toLowerCase() || 'concept';
        const center = size / 2;

        switch (nodeType) {
            case 'concept':
                // Circle
                return (
                    <circle
                        cx={center}
                        cy={center}
                        r={center - 4}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'prerequisite':
                // Triangle (pointing up)
                const trianglePoints = `${center},8 ${size - 8},${size - 8} 8,${size - 8}`;
                return (
                    <polygon
                        points={trianglePoints}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'application':
                // Hexagon
                const hexPoints = [
                    [center, 8],
                    [size - 15, center - 25],
                    [size - 15, center + 25],
                    [center, size - 8],
                    [15, center + 25],
                    [15, center - 25]
                ].map(p => p.join(',')).join(' ');
                return (
                    <polygon
                        points={hexPoints}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'component':
                // Square
                return (
                    <rect
                        x="8"
                        y="8"
                        width={size - 16}
                        height={size - 16}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'codeblock':
                // Diamond (rotated square)
                return (
                    <rect
                        x={center - (size - 20) / 2}
                        y={center - (size - 20) / 2}
                        width={size - 20}
                        height={size - 20}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        transform={`rotate(45 ${center} ${center})`}
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'documentsection':
                // Pentagon
                const pentPoints = [
                    [center, 8],
                    [size - 12, center - 15],
                    [size - 25, size - 8],
                    [25, size - 8],
                    [12, center - 15]
                ].map(p => p.join(',')).join(' ');
                return (
                    <polygon
                        points={pentPoints}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'decision':
                // Octagon (stop sign)
                const octPoints = [
                    [center - 25, 12],
                    [center + 25, 12],
                    [size - 12, center - 25],
                    [size - 12, center + 25],
                    [center + 25, size - 12],
                    [center - 25, size - 12],
                    [12, center + 25],
                    [12, center - 25]
                ].map(p => p.join(',')).join(' ');
                return (
                    <polygon
                        points={octPoints}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            case 'logicphase':
                // Rounded Rectangle
                return (
                    <rect
                        x="8"
                        y="8"
                        width={size - 16}
                        height={size - 16}
                        rx="20"
                        ry="20"
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );

            default:
                // Default to circle
                return (
                    <circle
                        cx={center}
                        cy={center}
                        r={center - 4}
                        fill={`url(#gradient-${node.id})`}
                        stroke={themeColor}
                        strokeWidth="3"
                        filter={isHovered ? `url(#glow-${node.id})` : 'none'}
                    />
                );
        }
    };

    return (
        <motion.div
            className="shape-node-container"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.15 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={() => onClick && onClick(node)}
            style={{ width: size, height: size }}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="shape-svg"
            >
                {/* Gradient Definition */}
                <defs>
                    <linearGradient id={`gradient-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={themeColor} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={themeColor} stopOpacity="0.3" />
                    </linearGradient>

                    {/* Glow Filter */}
                    <filter id={`glow-${node.id}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Render the shape */}
                {renderShape()}
            </svg>

            {/* Node Label */}
            <div className="shape-label" style={{ color: themeColor }}>
                {node.label}
            </div>

            {/* Type Badge */}
            <div className="shape-type-badge" style={{
                backgroundColor: `${themeColor}22`,
                color: themeColor,
                borderColor: `${themeColor}44`
            }}>
                <Icon size={12} />
                <span>{node.type || 'Concept'}</span>
            </div>

            {/* Pulse animation for selected/important nodes */}
            {node.importance === 'high' && (
                <motion.div
                    className="shape-pulse"
                    style={{ borderColor: themeColor }}
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0, 0.5]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            )}
        </motion.div>
    );
};

export default ShapeNode;
