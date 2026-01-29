import React from 'react';
import { motion } from 'framer-motion';

const ConnectionPath = ({ startPylon, endPylon, color = '#6366f1' }) => {
    if (!startPylon || !endPylon) return null;

    // Relative coordinates between the two pylons
    // startPylon: { x, y } - relative to the whole journey container or row
    // In our case, pylons are centered in rows, so we know their y spacing
    const x1 = startPylon.x;
    const y1 = startPylon.y;
    const x2 = endPylon.x;
    const y2 = endPylon.y;

    const dy = y2 - y1;
    const dx = x2 - x1;

    // Calculate a smooth S-curve (Bezier)
    // Even if x1 === x2, a slight curve adds "track" flavor
    const cp1y = y1 + dy * 0.4;
    const cp2y = y1 + dy * 0.6;

    // Main path definition
    const pathD = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;

    // Sleepers (the wood/metal ties between rails)
    // We sample points along the path to place them
    const sleeperCount = Math.floor(dy / 40); // One sleeper Every 40px
    const sleepers = [];

    // Note: In real SVG we'd use getPointAtLength, but for React we can approximate 
    // or just use a dashed stroke for the sleepers look.
    // However, to make it look like a REAL train track, we'll use a specific stroke pattern.

    return (
        <g className="railroad-track">
            {/* 1. Track Bed (The dark gravel/ballast underneath) */}
            <motion.path
                d={pathD}
                stroke="rgba(17, 24, 39, 0.6)"
                strokeWidth="32"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* 2. Sleepers / Ties (Wooden/Concrete bars) */}
            {/* We use a thick dashed line to simulate sleepers */}
            <motion.path
                d={pathD}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="24"
                fill="none"
                strokeDasharray="4, 36" /* 4px thick, 36px gap */
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
            />

            {/* 3. The Rails (Double lines) */}
            <motion.path
                d={pathD}
                stroke={color}
                strokeWidth="2"
                fill="none"
                opacity="0.3"
                style={{ transform: 'translateX(-6px)' }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
            />
            <motion.path
                d={pathD}
                stroke={color}
                strokeWidth="2"
                fill="none"
                opacity="0.3"
                style={{ transform: 'translateX(6px)' }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
            />

            {/* 4. The Glowing Core (Energy Flow) */}
            <motion.path
                d={pathD}
                stroke={color}
                strokeWidth="1"
                fill="none"
                opacity="0.8"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
            />

            {/* 5. Moving Engine / Particle */}
            <motion.circle
                r="4"
                fill="#fff"
                initial={{ offsetDistance: "0%", opacity: 0 }}
                animate={{
                    offsetDistance: "100%",
                    opacity: [0, 1, 1, 0]
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    delay: 1,
                    ease: "linear"
                }}
                style={{
                    offsetPath: `path('${pathD}')`,
                    boxShadow: `0 0 15px ${color}`
                }}
            />
        </g>
    );
};

export default ConnectionPath;
