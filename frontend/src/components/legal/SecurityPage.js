import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Cpu, Activity, Brain } from 'lucide-react';
import './LegalPages.css';

const SecurityPage = () => {
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
                    <h1>Security & AI Safety</h1>
                </header>

                <div className="legal-body">
                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><ShieldCheck size={24} /></span>
                            1. Security Infrastructure
                        </h2>
                        <p>
                            KnowledgeGraph AI is built on a robust, multi-layered security infrastructure. We use 
                            military-grade encryption (AES-256) for data at rest and TLS 1.3 for data in transit. 
                            Our servers are hosted in SOC 2 Type II compliant data centers.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Lock size={24} /></span>
                            2. Data Isolation
                        </h2>
                        <p>
                            We employ strict data isolation protocols. Each user's data (including uploaded PDFs and 
                            generated graphs) is stored in separate logical containers within our vector databases, 
                            ensuring no cross-contamination.
                        </p>
                    </section>

                    <div className="highlight-card">
                        <h4>AI Safety Protocols</h4>
                        <p>
                            Our AI models are integrated with content filtering layers to prevent the 
                            generation of harmful or biased content. We use state-of-the-art guardrails 
                            to ensure factual consistency in graph generation.
                        </p>
                    </div>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Cpu size={24} /></span>
                            3. AI Model Governance
                        </h2>
                        <p>
                            We utilize highly controlled AI pipelines. Your data is processed through 
                            enterprise-grade LLMs with strict data processing agreements. We do not use 
                            your private knowledge graphs to train foundation models without explicit consent.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>
                            <span className="section-icon-wrap"><Activity size={24} /></span>
                            4. Continuous Monitoring
                        </h2>
                        <p>
                            Our security team monitors the platform 24/7 for suspicious activities. We 
                            perform regular automated vulnerability scans and annual third-party 
                            penetration tests to maintain the highest security standards.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SecurityPage;
