import React from 'react';
import { useParams } from 'react-router-dom';
import '../App.css'; // Reuse global styles

const ExplorationPage = () => {
    const { nodeId } = useParams();

    return (
        <div className="exploration-page" style={{ padding: '40px', color: '#fff', textAlign: 'center' }}>
            <h1>Deep Dive Exploration</h1>
            <p>Node ID: {nodeId}</p>
            <div style={{ marginTop: '40px', padding: '20px', border: '1px dashed #666', borderRadius: '8px' }}>
                <h2>Coming Soon</h2>
                <p>This page will contain a dedicated, full-screen exploration environment for this concept.</p>
            </div>
        </div>
    );
};

export default ExplorationPage;
