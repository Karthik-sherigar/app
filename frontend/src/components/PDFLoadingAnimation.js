import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import './PDFLoadingAnimation.css';

const STEPS = [
  "Validating Document Structure",
  "Extracting Semantic Text",
  "Identifying Core Concepts",
  "Mapping Knowledge Relationships",
  "Generating Final Graph"
];

const PDFLoadingAnimation = () => {
  const [currentStep, setCurrentStep] = useState(0);

  // We want to simulate progress through the steps over the duration of the loading process.
  // We'll advance the step every 2 seconds. The real process takes variable time, but
  // standard skeleton loaders often just loop or stall at the last step.
  useEffect(() => {
    // Increased interval to 8 seconds per step. Slow networks / large documents often take 35-40 seconds.
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        // We can either freeze on the last step or loop. Let's stall at the last step (index 4).
        if (prev < STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 8500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pdf-loader-container">
      <h2 className="pdf-loader-title">Getting ready, please wait...</h2>
      
      <div className="pdf-loader-stepper">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isPending = index > currentStep;

          return (
            <div 
              key={index} 
              className={`pdf-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div className="pdf-step-indicator">
                {isCompleted ? (
                  <div className="pdf-static-circle completed-circle">
                    <Check size={14} className="pdf-check-icon" strokeWidth={3} />
                  </div>
                ) : isActive ? (
                  <div className="pdf-spinner-circle"></div>
                ) : (
                  <div className="pdf-static-circle"></div>
                )}
                {/* Connecting Line (except on the last item) */}
                {index < STEPS.length - 1 && (
                  <div className="pdf-step-line"></div>
                )}
              </div>
              <div className="pdf-step-text">
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PDFLoadingAnimation;
