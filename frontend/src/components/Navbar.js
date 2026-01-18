import React from "react";
import { motion } from "framer-motion";
import { Brain, Sun, Moon, RotateCcw } from "lucide-react";

export default function Navbar({ mode, setMode, backendStatus, resetGraph, theme, setTheme }) {
  const modes = [
    { id: "query", label: "Query Mode" },
    { id: "pdf", label: "PDF Mode" },
    { id: "programming", label: "Programming Mode" }
  ];

  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-left">
        <Brain className="logo-icon" size={32} />
        <h1 className="logo-text" data-testid="app-title">KNOWLEDGE GRAPH AI</h1>
      </div>

      <div className="navbar-center" data-testid="mode-switcher">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`mode-tab ${mode === m.id ? "active" : ""}`}
            data-testid={`mode-${m.id}-btn`}
          >
            {m.label}
            {mode === m.id && (
              <motion.div 
                className="mode-underline"
                layoutId="underline"
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="navbar-right">
        <div 
          className={`status-indicator ${backendStatus}`}
          data-testid="backend-status"
          title={backendStatus}
        >
          <span className="status-dot"></span>
        </div>
        
        <button 
          className="icon-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          data-testid="theme-toggle-btn"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <button 
          className="icon-btn"
          onClick={resetGraph}
          data-testid="reset-workspace-btn"
        >
          <RotateCcw size={20} />
        </button>
      </div>
    </nav>
  );
}
