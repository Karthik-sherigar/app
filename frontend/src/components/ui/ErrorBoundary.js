import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-overlay">
                    <div className="error-content">
                        <AlertTriangle size={48} className="error-icon" />
                        <h2>Something went wrong</h2>
                        <p>The expedition encountered an unexpected glitch.</p>
                        <pre>{this.state.error?.message}</pre>
                        <button
                            className="btn-primary"
                            onClick={() => window.location.reload()}
                        >
                            <RotateCcw size={16} />
                            Restart Application
                        </button>
                    </div>
                    <style>{`
            .error-boundary-overlay {
              position: fixed;
              inset: 0;
              background: #0b1220;
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 9999;
              color: #f9fafb;
              font-family: 'Inter', sans-serif;
            }
            .error-content {
              max-width: 400px;
              text-align: center;
              padding: 2rem;
              background: rgba(17, 24, 39, 0.8);
              backdrop-filter: blur(12px);
              border: 1px solid rgba(239, 68, 68, 0.3);
              border-radius: 16px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .error-icon {
              color: #ef4444;
              margin-bottom: 1.5rem;
            }
            .error-content h2 {
              margin-bottom: 0.5rem;
              font-size: 1.5rem;
            }
            .error-content p {
              color: #94a3b8;
              margin-bottom: 1.5rem;
            }
            .error-content pre {
              background: rgba(0,0,0,0.3);
              padding: 1rem;
              border-radius: 8px;
              font-size: 12px;
              margin-bottom: 1.5rem;
              overflow-x: auto;
              text-align: left;
              color: #ef4444;
            }
          `}</style>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
