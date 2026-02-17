import React from 'react';
import { motion } from 'framer-motion';
import './HorizontalDivider.css';

const HorizontalDivider = ({ text, gradient = true }) => {
    return (
        <motion.div
            className="horizontal-divider-container"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
        >
            <div className="divider-line-wrapper">
                {gradient ? (
                    <div className="divider-gradient-line" />
                ) : (
                    <div className="divider-solid-line" />
                )}
            </div>
            {text && (
                <div className="divider-text">
                    <span>{text}</span>
                </div>
            )}
        </motion.div>
    );
};

export default HorizontalDivider;
