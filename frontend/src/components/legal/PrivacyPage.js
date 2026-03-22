import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Globe, Brain } from 'lucide-react';
import './LegalPages.css';

const PrivacyPage = () => {
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
                    <h1>Privacy Policy</h1>
                </header>

                <div className="legal-body">
                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Globe size={24} /></span>
                            1. Introduction
                        </h2>
                        <p>
                            Welcome to KnowledgeGraph AI. We value your privacy and are committed to protecting 
                            your personal data. This Privacy Policy explains how we collect, use, and safeguard 
                            your information when you use our platform to visualize and explore structured data.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><ShieldCheck size={24} /></span>
                            2. Information We Collect
                        </h2>
                        <p>
                            We collect information that you provide directly to us when you create an account, upload 
                            documents, or interact with our AI models:
                        </p>
                        <ul>
                            <li><strong>Account Data:</strong> Email address, full name, and profile information.</li>
                            <li><strong>User Content:</strong> Text, documents, and data you upload for graph generation.</li>
                            <li><strong>Usage Data:</strong> How you interact with the graph, search queries, and session history.</li>
                        </ul>
                    </section>

                    <div className="highlight-card">
                        <h4>Data Isolation</h4>
                        <p>
                            All uploaded content is isolated at the database level. Your knowledge graphs are private 
                            to your account and are never shared with other users.
                        </p>
                    </div>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Lock size={24} /></span>
                            3. How We Use Data
                        </h2>
                        <p>
                            We use the collected data to provide and improve our services, including:
                        </p>
                        <ul>
                            <li>Generating accurate and relevant Knowledge Graphs.</li>
                            <li>Providing AI-driven insights and deep-dive analysis.</li>
                            <li>Personalizing your experience and session history.</li>
                            <li>Ensuring the security and integrity of our platform.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>4. Contact Us</h2>
                        <p>
                            If you have any questions about this Privacy Policy, please contact our data 
                            protection team at privacy@knowledgegraph.ai.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
