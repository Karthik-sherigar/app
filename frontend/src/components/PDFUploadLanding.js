import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileUp, Sparkles, Brain, Cpu, Database, ChevronRight } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import './PDFUploadLanding.css';

const PDFUploadLanding = ({ onUpload, loading }) => {
    const [isHovered, setIsHovered] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
        },
        maxFiles: 1,
        onDrop: (files) => {
            if (files.length > 0) {
                onUpload(files[0]);
            }
        },
        disabled: loading
    });

    const features = [
        { icon: <Cpu size={14} />, title: "Semantic Parsing", desc: "Extract meaning, not just text." },
        { icon: <Database size={14} />, title: "Knowledge Graphs", desc: "Auto-generate linked entities." },
        { icon: <Brain size={14} />, title: "AI Study Partner", desc: "Chat instantly with your document." }
    ];

    return (
        <div className="pdf-landing-container">
            {/* Animated Background Elements */}
            <div className="pdf-bg-blur pdf-bg-blur-1"></div>
            <div className="pdf-bg-blur pdf-bg-blur-2"></div>
            <div className="pdf-grid-bg"></div>

            <motion.div 
                className="pdf-landing-content"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <div className="pdf-header-badge">
                    <Sparkles size={12} className="badge-icon" />
                    <span>NEXT-GEN DOCUMENT ANALYSIS</span>
                </div>

                <h1 className="pdf-landing-title">
                    Transform Documents into <br/>
                    <span className="text-gradient">Interactive Knowledge</span>
                </h1>
                
                <p className="pdf-landing-subtitle">
                    Upload your syllabus, research paper, presentation, or doc. Our AI will instantly map its concepts, generate a learning path, and become your personal tutor.
                </p>

                <div 
                    {...getRootProps()} 
                    className={`pdf-dropzone ${isDragActive ? 'drag-active' : ''} ${loading ? 'disabled' : ''}`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <input {...getInputProps()} />
                    
                    {/* Glowing animated border */}
                    <div className="dropzone-border-glow"></div>

                    <div className="dropzone-inner">
                        <motion.div 
                            className="dropzone-icon-container"
                            animate={{ 
                                y: isDragActive ? -10 : 0,
                                scale: isDragActive ? 1.05 : 1
                            }}
                        >
                            <div className="icon-pulse-ring"></div>
                            {isDragActive ? (
                                <FileUp size={36} className="text-indigo-400 z-10 relative" />
                            ) : (
                                <FileText size={36} className="text-indigo-500 z-10 relative" />
                            )}
                        </motion.div>

                        <div className="dropzone-typography">
                            <AnimatePresence mode="wait">
                                {isDragActive ? (
                                    <motion.h3 
                                        key="release"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="gradient-text-active"
                                    >
                                        Drop to Analyze Now
                                    </motion.h3>
                                ) : (
                                    <motion.h3 
                                        key="upload"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        Drop your PDF, DOCX, or PPTX here
                                    </motion.h3>
                                )}
                            </AnimatePresence>
                            
                            <div className="dropzone-action-row">
                                <span className="action-text">or click to browse your files</span>
                                <motion.div 
                                    className="action-arrow"
                                    animate={{ x: isHovered ? 5 : 0 }}
                                >
                                    <ChevronRight size={14} />
                                </motion.div>
                            </div>
                        </div>

                        <div className="file-constraints">
                            <span className="constraint-pill">PDF, DOCX, PPTX</span>
                            <span className="constraint-pill">UP TO 20MB</span>
                        </div>
                    </div>
                </div>

                {/* Feature highlights */}
                <div className="pdf-features-grid">
                    {features.map((ft, idx) => (
                        <motion.div 
                            key={idx}
                            className="feature-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + (idx * 0.1) }}
                        >
                            <div className="feature-icon-wrapper">
                                {ft.icon}
                            </div>
                            <div className="feature-text">
                                <h4>{ft.title}</h4>
                                <p>{ft.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default PDFUploadLanding;
