import React, { useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText } from 'lucide-react';
import './PDFLearningPath.css';

const PDFLearningPath = ({ data, pdfFilename, onNodeClick }) => {
    // Ensure nodes are sorted by their ID suffix or depth to maintain path sequence
    const sortedNodes = useMemo(() => {
        const nodes = data?.nodes || data?.graph?.nodes || [];
        return [...nodes].sort((a, b) => {
            const numA = parseInt(a.id.match(/\d+/) || 0);
            const numB = parseInt(b.id.match(/\d+/) || 0);
            return numA - numB;
        });
    }, [data]);

    const title = data?.title || "Learning Path";

    useEffect(() => {
        const handleExport = () => {
            const pathContainer = document.querySelector('.pdf-path-container');
            if (!pathContainer) return;
            
            // Add a temporary export class to style specifically for the download (e.g. remove scrollbars, fix heights)
            pathContainer.classList.add('exporting-png');
            
            html2canvas(pathContainer, {
                backgroundColor: '#0a0a0f', // Match the dark theme background
                scale: 2, // High resolution
                logging: false,
                useCORS: true
            }).then((canvas) => {
                pathContainer.classList.remove('exporting-png');
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${pdfFilename.replace(/\.[^/.]+$/, "")}_learning_path.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }).catch(err => {
                console.error("Failed to export PDF graph to PNG:", err);
                pathContainer.classList.remove('exporting-png');
            });
        };

        window.addEventListener('export-graph-snapshot', handleExport);
        return () => window.removeEventListener('export-graph-snapshot', handleExport);
    }, [pdfFilename]);

    return (
        <div className="pdf-path-container">
            <header className="pdf-path-header">
                <div className="path-badge">CURRENT JOURNEY</div>
                <h1 className="path-title">{title}</h1>
                <p className="path-subtitle">
                    Synthesized from your document: <span className="filename">{pdfFilename}</span>
                </p>
            </header>

            <div className="path-timeline">
                {sortedNodes.map((node, index) => {
                    const isEven = index % 2 === 0;
                    return (
                        <div key={node.id} className={`path-step ${isEven ? 'left' : 'right'}`}>
                            <motion.div 
                                className="step-node-container"
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div 
                                    className="node-circle"
                                    onClick={() => onNodeClick && onNodeClick(node)}
                                >
                                    <span className="node-number">{index + 1}</span>
                                </div>
                            </motion.div>

                            <motion.div 
                                className="step-content-card"
                                initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 + 0.2 }}
                            >
                                <h3 className="step-title">{node.label}</h3>
                                <p className="step-description">{node.description}</p>
                            </motion.div>

                            {index < sortedNodes.length - 1 && (
                                <svg className="path-connector" viewBox="0 0 100 140" preserveAspectRatio="none">
                                    <motion.path
                                        d={isEven 
                                            ? "M 50 0 C 70 40, 70 100, 50 140" 
                                            : "M 50 0 C 30 40, 30 100, 50 140"}
                                        fill="none"
                                        stroke="var(--accent-primary)"
                                        strokeWidth="2"
                                        strokeDasharray="8,8"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        whileInView={{ pathLength: 1, opacity: 0.3 }}
                                        viewport={{ once: true, margin: "-50px" }}
                                        transition={{ duration: 1.2, ease: "easeInOut" }}
                                    />
                                </svg>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="path-footer">
                <div className="footer-icon">
                    <FileText size={24} />
                </div>
                <p>End of Roadmap</p>
            </div>
        </div>
    );
};

export default PDFLearningPath;
