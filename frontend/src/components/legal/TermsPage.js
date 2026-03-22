import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale, FileText, Gavel, Brain } from 'lucide-react';
import './LegalPages.css';

const TermsPage = () => {
    const navigate = useNavigate();

    return (
        <div className="legal-page-container">
            <nav className="legal-nav">
                <button onClick={() => navigate('/login')} className="btn-back">
                    <ArrowLeft size={18} />
                    <span>Back to Login</span>
                </button>
                <div className="brand-mini">
                    <div className="logo-box">
                        <Brain size={18} color="white" />
                    </div>
                    <span>KnowledgeGraph AI</span>
                </div>
            </nav>

            <div className="legal-content-wrapper">
                <header className="legal-header">
                    <div className="last-updated">Last Updated: March 22, 2026</div>
                    <h1>Terms of Service</h1>
                </header>

                <div className="legal-body">
                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Gavel size={24} /></span>
                            1. Acceptance of Terms
                        </h2>
                        <p>
                            By accessing or using KnowledgeGraph AI, you agree to be bound by these Terms of 
                            Service. If you do not agree with any part of these terms, you must not use our platform.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><FileText size={24} /></span>
                            2. Description of Service
                        </h2>
                        <p>
                            KnowledgeGraph AI is a platform that uses artificial intelligence to generate and visualize 
                            knowledge graphs from unstructured data (text, documents, code). The service includes 
                            features for semantic search, node exploration, and graph analytics.
                        </p>
                    </section>

                    <div className="highlight-card">
                        <h4>Usage Limits</h4>
                        <p>
                            Free and premium tiers carry different daily usage limits for AI processing and 
                            image generation. Please refer to your plan details for specific quotas.
                        </p>
                    </div>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Scale size={24} /></span>
                            3. User Responsibilities
                        </h2>
                        <p>
                            Users are responsible for the content they upload. You must ensure that you have 
                            the necessary rights to process the data via our AI engine. Prohibited content 
                            includes illegal material, malware, or highly sensitive personally identifiable information.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>4. Limitation of Liability</h2>
                        <p>
                            KnowledgeGraph AI is provided "as is". While we strive for accuracy, the AI-generated 
                            insights should be verified for critical decision-making. We are not liable for 
                            any indirect or consequential damages arising from your use of the platform.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TermsPage;
