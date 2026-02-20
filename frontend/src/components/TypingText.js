import React, { useState, useEffect, useRef } from 'react';

const TypingText = ({ text, speed = 25, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const indexRef = useRef(0);

    useEffect(() => {
        // Reset if text changes completely (new message)
        // But we need to handle if 'text' is just the final string.
        setDisplayedText('');
        indexRef.current = 0;
    }, [text]);

    useEffect(() => {
        if (indexRef.current >= text.length) {
            if (onComplete) onComplete();
            return;
        }

        const intervalId = setInterval(() => {
            if (indexRef.current < text.length) {
                setDisplayedText((prev) => prev + text.charAt(indexRef.current));
                indexRef.current += 1;
            } else {
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, speed);

        return () => clearInterval(intervalId);
    }, [text, speed, onComplete]);

    return (
        <span className="typing-text">
            {displayedText}
            {indexRef.current < text.length && <span className="typing-cursor">|</span>}
        </span>
    );
};

export default TypingText;
