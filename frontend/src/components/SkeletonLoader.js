import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = () => {
    return (
        <div className="skeleton-wrapper">
            <div className="skeleton-header"></div>
            <div className="skeleton-tabs">
                <div className="skeleton-tab"></div>
                <div className="skeleton-tab"></div>
                <div className="skeleton-tab"></div>
                <div className="skeleton-tab"></div>
            </div>
            <div className="skeleton-content">
                <div className="skeleton-line long"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line short"></div>
            </div>
        </div>
    );
};

export default SkeletonLoader;
