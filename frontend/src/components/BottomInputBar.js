import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import "./BottomInputBar.css";

export default function BottomInputBar({ onSubmit, loading, disabled }) {
    const [query, setQuery] = useState("");
    const textareaRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [query]);

    const handleSubmit = () => {
        if (query.trim() && !loading && !disabled) {
            onSubmit(query);
            setQuery("");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="bottom-input-bar" data-testid="bottom-input-bar">
            <div className="input-container">
                <textarea
                    ref={textareaRef}
                    className="query-input"
                    placeholder="Ask anything... Example: Explain Blockchain"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading || disabled}
                    rows={1}
                    data-testid="bottom-query-input"
                />
                <div className="button-group">
                    <button
                        className={`btn-submit ${!query.trim() || loading ? "disabled" : ""}`}
                        onClick={handleSubmit}
                        disabled={!query.trim() || loading || disabled}
                        title="Generate Graph"
                        data-testid="bottom-submit-btn"
                    >
                        {loading ? (
                            <div className="spinner-small" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
