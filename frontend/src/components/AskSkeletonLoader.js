import React from 'react';
import '../App.css';

const AskSkeletonLoader = () => {
    return (
        <div className="ask-skeleton">
            <div className="ask-skeleton-line short"></div>
            <div className="ask-skeleton-line long"></div>
            <div className="ask-skeleton-line medium"></div>
        </div>
    );
};

export default AskSkeletonLoader;
