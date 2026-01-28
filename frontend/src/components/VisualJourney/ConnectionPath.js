import React from 'react';
import { motion } from 'framer-motion';

const ConnectionPath = ({ edge, sourceNode, targetNode }) => {
    if (!sourceNode || !targetNode) return null;

    // Vertical spacing between depths (should match CSS as much as possible)
    const sourceDepth = sourceNode.position?.depth || 0;
    const targetDepth = targetNode.position?.depth || 0;
    const depthSpacing = 450;
    const headerOffset = 300;
    const nodeHeight = 180;

    const x1 = 600; // Center X for 1200px container
    const y1 = headerOffset + sourceDepth * depthSpacing + nodeHeight;
    const x2 = 600;
    const y2 = headerOffset + targetDepth * depthSpacing;

    // Create curved path (with horizontal offset for multiple nodes if needed)
    // For single column, we can add a subtle curve to avoid overlapping the timeline line exactly
    const curveOffset = edge.relation === 'RELATED_TO' ? 60 : 30;
    const midY = (y1 + y2) / 2;
    const pathD = `M ${x1} ${y1} C ${x1 + curveOffset} ${midY}, ${x2 + curveOffset} ${midY}, ${x2} ${y2}`;

    // Get color based on relationship type
    const getStrokeColor = (relation) => {
        const colors = {
            'DEPENDS_ON': '#f59e0b',
            'EXPLAINS': '#6366f1',
            'LEADS_TO': '#22c55e',
            'RELATED_TO': '#a855f7'
        };
        return colors[relation] || '#6366f1';
    };

    const strokeColor = getStrokeColor(edge.relation);

    return (
        <g className="connection-path">
            {/* Road Background (Outer Glow/Margin) */}
            <motion.path
                d={pathD}
                stroke={strokeColor}
                strokeWidth="20"
                fill="none"
                opacity="0.05"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Pavement Layer (Main Road) */}
            <motion.path
                d={pathD}
                stroke="rgba(31, 41, 55, 0.8)" /* Dark pavement color */
                strokeWidth="12"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Center Line (Dashed) */}
            <motion.path
                d={pathD}
                stroke={strokeColor}
                strokeWidth="2"
                fill="none"
                strokeDasharray="8,8"
                opacity="0.6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Animated particle (moving along the "road") */}
            <motion.circle
                r="3"
                fill="#fff"
                initial={{ offsetDistance: "0%", opacity: 0 }}
                animate={{
                    offsetDistance: "100%",
                    opacity: [0, 1, 1, 0]
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                }}
                style={{
                    offsetPath: `path('${pathD}')`,
                    offsetRotate: '0deg',
                    boxShadow: `0 0 10px ${strokeColor}`
                }}
            />

            {/* Relationship label with pill background */}
            <g transform={`translate(${(x1 + x2) / 2 + (edge.relation === 'RELATED_TO' ? 45 : 25)}, ${(y1 + y2) / 2})`}>
                <rect
                    x="-40"
                    y="-10"
                    width="80"
                    height="20"
                    rx="10"
                    fill="rgba(17, 24, 39, 0.9)"
                    stroke={strokeColor}
                    strokeWidth="1"
                    style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
                />
                <text
                    fill={strokeColor}
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="connection-label"
                >
                    {edge.relation}
                </text>
            </g>
        </g>
    );
};

export default ConnectionPath;
