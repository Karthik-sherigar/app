import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import { motion, AnimatePresence } from "framer-motion";
import "./GraphCanvas.css";
import { Brain, ZoomIn, ZoomOut, Maximize, RefreshCw } from "lucide-react";
import GraphLoadingAnimation from "./GraphLoadingAnimation";

// Register plugins
cytoscape.use(cytoscapeDagre);

function GraphCanvas({ graphData, onNodeClick, selectedNode, externalSelectedNode, mode, loading }) {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const layoutRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleZoomIn = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(cyInstance.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(cyInstance.current.zoom() * 0.8);
    }
  };

  const handleFit = () => {
    if (cyInstance.current) {
      cyInstance.current.fit();
      cyInstance.current.center();
    }
  };

  // Init and Update in a single effect to handle Strict Mode correctness
  useEffect(() => {
    // Only init if we have nodes and the container is ready
    if (!cyRef.current || graphData.nodes.length === 0) return;

    // Initialize Cytoscape
    cyInstance.current = cytoscape({
      container: cyRef.current,
      // Enable adaptive refresh rate - no FPS cap
      pixelRatio: 'auto',
      motionBlur: false, // Disable for high refresh rates
      textureOnViewport: true, // GPU texture rendering
      hideEdgesOnViewport: false, // Keep edges visible for smoothness
      hideLabelsOnViewport: false,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'font-size': '12px',
            'color': '#f9fafb',
            'text-outline-color': '#0b1220',
            'text-outline-width': 2,
            'shape': 'round-rectangle',
            'background-color': 'rgba(17, 24, 39, 0.9)',
            'padding': '10px',
            'width': (ele) => {
              const importance = ele.data('importance');
              return importance === 'high' ? 180 : importance === 'medium' ? 150 : 120;
            },
            'height': 'label',
            'border-width': (ele) => {
              const importance = ele.data('importance');
              return importance === 'high' ? 4 : importance === 'medium' ? 3 : 2;
            },
            'border-color': '#6366f1',
            'border-opacity': 0.5,
            'opacity': (ele) => {
              const importance = ele.data('importance');
              return importance === 'low' ? 0.7 : 1;
            }
          }
        },
        { selector: 'node[type="Concept"]', style: { 'border-color': '#3b82f6' } },
        { selector: 'node[type="Prerequisite"]', style: { 'border-color': '#f59e0b' } },
        { selector: 'node[type="CodeBlock"]', style: { 'border-color': '#22c55e' } },
        { selector: 'node[type="DocumentSection"]', style: { 'border-color': '#a855f7' } },
        { selector: 'node[type="Component"], node[type="Application"]', style: { 'border-color': '#06b6d4', 'shape': 'hexagon' } },
        { selector: 'node[type="Decision"]', style: { 'border-color': '#ef4444', 'shape': 'diamond', 'background-color': 'rgba(239, 68, 68, 0.1)' } },
        { selector: 'node[type="LogicPhase"]', style: { 'border-color': '#22c55e', 'shape': 'round-rectangle', 'border-width': 3 } },
        { selector: 'node[type="DataStore"]', style: { 'border-color': '#f59e0b', 'shape': 'barrel' } },
        {
          selector: 'node:selected',
          style: {
            'border-width': 5,
            'border-color': '#6366f1',
            'box-shadow': '0 0 20px #6366f1'
          }
        },
        {
          selector: 'node.focused',
          style: {
            'border-width': 5,
            'border-color': '#6366f1',
            'box-shadow': '0 0 30px #6366f1'
          }
        },
        {
          selector: 'node.faded',
          style: {
            'opacity': 0.2
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#adb5bd',
            'target-arrow-color': '#adb5bd',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            'curve-style': (ele) => {
              // Use bezier for query mode, taxi for programming mode
              return mode === 'query' ? 'bezier' : 'taxi';
            },
            'taxi-direction': 'vertical',
            'opacity': mode === 'query' ? 0.6 : 0.8,
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#f9fafb',
            'text-background-color': mode === 'query' ? 'rgba(17, 24, 39, 0.95)' : '#0b1220',
            'text-background-opacity': 1,
            'text-background-padding': mode === 'query' ? '5px 8px' : '3px',
            'text-border-width': mode === 'query' ? 1 : 0,
            'text-border-color': mode === 'query' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
            'text-border-opacity': 1,
            'min-zoomed-font-size': 8,
            'text-outline-color': '#0b1220',
            'text-outline-width': 1,
            'z-index': 1
          }
        },
        {
          selector: 'edge.faded',
          style: {
            'opacity': 0.1
          }
        },
        { selector: 'edge[label="DEPENDS_ON"]', style: { 'line-style': 'dashed' } },
        { selector: 'edge[label="RELATED_TO"]', style: { 'width': 1, 'line-style': 'dotted' } },
        { selector: 'edge[label="FLOWS_TO"]', style: { 'width': 4, 'line-color': '#6366f1', 'target-arrow-color': '#6366f1', 'arrow-scale': 1.6 } },
        { selector: 'edge[label="CALLS"]', style: { 'line-style': 'dashed', 'line-color': '#10b981', 'target-arrow-color': '#10b981' } },
        { selector: 'edge[label="CONTAINS"]', style: { 'line-style': 'dotted', 'line-color': '#94a3b8', 'target-arrow-shape': 'none', 'width': 1 } }
      ],
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.15,
      userZoomingEnabled: mode === 'programming' ? false : true // Only handle manually in Programming Mode
    });

    const cy = cyInstance.current;

    // Handle manual wheel events for Panning vs Zooming (Isolated to Programming Mode)
    const handleWheel = (e) => {
      if (mode !== 'programming') return;

      e.preventDefault();
      if (!cy || cy.destroyed()) return;

      if (e.ctrlKey) {
        // Zooming (Pinch-to-zoom or Ctrl+Scroll)
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const currentZoom = cy.zoom();
        const newZoom = currentZoom * zoomFactor;

        if (newZoom >= cy.minZoom() && newZoom <= cy.maxZoom()) {
          const pointer = { x: e.offsetX, y: e.offsetY };
          cy.zoom({
            level: newZoom,
            renderedPosition: pointer
          });
        }
      } else {
        // Panning (Two-finger scroll)
        const viewportWidth = cy.width();
        const viewportHeight = cy.height();

        const limitX = viewportWidth * 1.5;
        const limitY = viewportHeight * 1.5;

        const currentPan = cy.pan();
        let nextX = currentPan.x - e.deltaX;
        let nextY = currentPan.y - e.deltaY;

        nextX = Math.max(-limitX, Math.min(limitX, nextX));
        nextY = Math.max(-limitY, Math.min(limitY, nextY));

        cy.pan({
          x: nextX,
          y: nextY
        });
      }
    };

    const container = cyRef.current;
    if (container && mode === 'programming') {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Add elements
    const elements = [
      ...graphData.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          description: node.description,
          importance: node.importance
        }
      })),
      ...graphData.edges.map(edge => ({
        data: {
          source: edge.source,
          target: edge.target,
          label: edge.relation
        }
      }))
    ];

    cy.add(elements);

    // Hover Tooltip System - Simplified
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const description = node.data('description') || 'No description available';

      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'knowledge-tooltip';
      tooltip.innerHTML = `
        <h4>${node.data('label')}</h4>
        <p>${description}</p>
        <span class="tooltip-hint">Click to explore</span>
      `;
      tooltip.style.position = 'fixed';
      tooltip.style.zIndex = '10000';
      tooltip.style.pointerEvents = 'none';
      document.body.appendChild(tooltip);

      // Position tooltip near node
      const updatePosition = () => {
        if (!node || node.removed()) return;
        const renderedPosition = node.renderedPosition();
        const zoom = cy.zoom();
        const pan = cy.pan();

        tooltip.style.left = `${renderedPosition.x + 20}px`;
        tooltip.style.top = `${renderedPosition.y - 10}px`;
      };

      updatePosition();

      // Store tooltip reference
      node.data('tooltip', tooltip);
      node.data('tooltipUpdate', updatePosition);

      // Update position on pan/zoom
      cy.on('pan zoom', updatePosition);

      // Hover visual feedback
      node.style({
        'border-width': (ele) => {
          const importance = ele.data('importance');
          const base = importance === 'high' ? 4 : importance === 'medium' ? 3 : 2;
          return base + 2;
        }
      });
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      const tooltip = node.data('tooltip');
      const tooltipUpdate = node.data('tooltipUpdate');

      if (tooltip) {
        tooltip.remove();
        node.removeData('tooltip');
      }

      if (tooltipUpdate) {
        cy.off('pan zoom', tooltipUpdate);
        node.removeData('tooltipUpdate');
      }

      // Reset border width
      node.style({
        'border-width': (ele) => {
          const importance = ele.data('importance');
          return importance === 'high' ? 4 : importance === 'medium' ? 3 : 2;
        }
      });
    });

    // Cleanup tooltips on node removal (prevent memory leak)
    cy.on('remove', 'node', (evt) => {
      const tip = evt.target.data('tippy');
      if (tip) tip.destroy();
    });

    // Focus Exploration Mode
    cy.on('tap', 'node', (evt) => {
      const clickedNode = evt.target;

      // Center on clicked node
      cy.animate({
        center: { eles: clickedNode },
        zoom: 1.5
      }, {
        duration: 500
      });

      // Highlight clicked node
      cy.nodes().removeClass('focused');
      clickedNode.addClass('focused');

      // Fade unrelated nodes
      const connectedNodes = clickedNode.neighborhood().add(clickedNode);
      cy.nodes().not(connectedNodes).addClass('faded');
      cy.edges().not(clickedNode.connectedEdges()).addClass('faded');

      // Call original handler
      onNodeClick(clickedNode.data());
    });

    // Background click to reset focus mode
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.nodes().removeClass('faded focused');
        cy.edges().removeClass('faded');
        cy.animate({ zoom: 1, center: undefined }, { duration: 300 });
      }
    });

    // Run Layout in RAF to avoid race conditions with cleanup
    const runLayout = requestAnimationFrame(() => {
      if (!cy || cy.destroyed()) return;

      // Performance guard: disable animation for large graphs
      const shouldAnimate = cy.nodes().length < 80;

      const layoutOptions = mode === 'programming' ? {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 150, // Increased spacing
        rankSep: 250, // Increased spacing
        padding: 50,
        fit: true,
        animate: shouldAnimate,
        animationDuration: 500
      } : mode === 'query' ? {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.8, // Increased spacing
        padding: 50,
        animate: shouldAnimate,
        animationDuration: 800,
        fit: true,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true
      } : {
        name: 'cose',
        randomize: false,
        animate: shouldAnimate,
        animationDuration: 1000,
        padding: 50,
        nodeOverlap: 20,
        componentSpacing: 100,
        refresh: 20,
        fit: true
      };

      layoutOptions.stop = () => {
        if (!cy || cy.destroyed()) return;

        // 1. Initial fit
        cy.fit(cy.elements(), 80);

        // 2. Prevent "Too Small" syndrome: If zoom is tiny, bump it up and re-center
        const currentZoom = cy.zoom();
        if (currentZoom < 0.5) {
          cy.animate({
            zoom: 0.7,
            center: { eles: cy.elements() }
          }, {
            duration: 800,
            easing: 'ease-out-cubic'
          });
        } else {
          cy.center();
        }

        setZoomLevel(cy.zoom());
      };

      layoutRef.current = cy.layout(layoutOptions);
      layoutRef.current.run();
    });

    // Cleanup
    return () => {
      cancelAnimationFrame(runLayout);

      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }

      // Preserve reference for final cleanup phase
      const cyToDestroy = cyInstance.current;
      
      if (cyToDestroy && !cyToDestroy.destroyed()) {
        try {
          // 1. Destroy all tooltips from DOM and listeners
          cyToDestroy.nodes().forEach(node => {
            const tooltip = node.data('tooltip');
            if (tooltip && tooltip.parentNode) {
              tooltip.remove();
            }
            const updater = node.data('tooltipUpdate');
            if (updater) cyToDestroy.off('pan zoom', updater);
          });

          // 2. Stop any active layout
          if (layoutRef.current) {
            layoutRef.current.stop();
            layoutRef.current = null;
          }

          // 3. Final teardown
          cyToDestroy.stop(true, true);
          cyToDestroy.elements().remove();
          cyToDestroy.removeAllListeners();
          cyToDestroy.destroy();
        } catch (e) {
          console.warn("Cytoscape hard-cleanup warning:", e);
        }
      }
      cyInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, mode]);

  // Handle selected node
  useEffect(() => {
    if (!cyInstance.current || cyInstance.current.destroyed()) return;

    if (selectedNode) {
      cyInstance.current.nodes().unselect();
      const node = cyInstance.current.getElementById(selectedNode.id);
      if (node && node.length > 0) {
        node.select();
        cyInstance.current.stop();
        cyInstance.current.animate({
          center: { eles: node },
          zoom: 1.5
        }, {
          duration: 300
        });
      }
    }
  }, [selectedNode]);

  // Handle external node selection from TextResponsePanel
  useEffect(() => {
    if (!cyInstance.current || cyInstance.current.destroyed()) return;

    if (externalSelectedNode) {
      cyInstance.current.nodes().unselect();
      const node = cyInstance.current.getElementById(externalSelectedNode);
      if (node && node.length > 0) {
        node.select();
        cyInstance.current.stop();
        cyInstance.current.animate({
          center: { eles: node },
          zoom: 1.8
        }, {
          duration: 400,
          easing: 'ease-in-out'
        });

        const originalBorderColor = node.style('border-color');
        node.style('border-color', '#6366f1');

        setTimeout(() => {
          if (cyInstance.current && !cyInstance.current.destroyed()) {
            const currentNode = cyInstance.current.getElementById(externalSelectedNode);
            if (currentNode && currentNode.length > 0) {
              currentNode.style('border-color', originalBorderColor);
            }
          }
        }, 800);
      }
    }
  }, [externalSelectedNode]);

  return (
    <div className="graph-canvas" data-testid="graph-canvas">
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100 }}
          >
            <GraphLoadingAnimation mode={mode} />
          </motion.div>
        )}
      </AnimatePresence>

      {mode === 'programming' && (
        <div className="graph-zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button className="zoom-btn" onClick={handleFit} title="Fit Content">
            <Maximize size={18} />
          </button>
        </div>
      )}

      {!loading && graphData.nodes.length === 0 ? (
        <div className="empty-graph" data-testid="empty-graph-state">
          <Brain size={64} className="empty-icon" />
          <h2>No Graph Yet</h2>
          <p>Enter a query, upload a PDF, or paste code to generate a knowledge graph</p>
        </div>
      ) : (
        <motion.div
          key="cy-container-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: loading ? 0 : 1 }}
          transition={{ duration: 0.5 }}
          ref={cyRef}
          className="cy-container"
          data-testid="cytoscape-container"
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
}

export default React.memo(GraphCanvas);
