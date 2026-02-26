import React from "react";
import { motion } from "framer-motion";
import { Brain, Sun, Moon, RotateCcw } from "lucide-react";

function Navbar({ mode, setMode, backendStatus, resetGraph, theme, setTheme }) {
  return (
    <nav className="navbar" data-testid="navbar">
      <div 
        className="navbar-left" 
        onClick={() => setMode(null)} 
        style={{cursor: 'pointer'}}
        title="Return to Dashboard"
      >
        <Brain className="logo-icon" size={32} />
        <h1 className="logo-text" data-testid="app-title">KNOWLEDGE GRAPH AI</h1>
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

export default React.memo(Navbar);
