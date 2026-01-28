import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscape_popper from "cytoscape-popper";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import "./GraphCanvas.css";
import { Brain } from "lucide-react";

// Register plugins
cytoscape.use(cytoscapeDagre);
cytoscape.use(cytoscape_popper);

export default function GraphCanvas({ graphData, onNodeClick, selectedNode, externalSelectedNode }) {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const layoutRef = useRef(null);

  // Init and Update in a single effect to handle Strict Mode correctness
  useEffect(() => {
    if (!cyRef.current) return;

    // Initialize Cytoscape
    cyInstance.current = cytoscape({
      container: cyRef.current,
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
            'border-opacity': 0.5
          }
        },
        { selector: 'node[type="Concept"]', style: { 'border-color': '#3b82f6' } },
        { selector: 'node[type="Prerequisite"]', style: { 'border-color': '#f59e0b' } },
        { selector: 'node[type="CodeBlock"]', style: { 'border-color': '#22c55e' } },
        { selector: 'node[type="DocumentSection"]', style: { 'border-color': '#a855f7' } },
        { selector: 'node[type="Component"], node[type="Application"]', style: { 'border-color': '#06b6d4' } },
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
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            'curve-style': 'unbundled-bezier',
            'opacity': 0.6,
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#9ca3af',
            'text-background-color': '#1f2937',
            'text-background-opacity': 1,
            'text-background-padding': '4px',
            'text-border-radius': '8px',
            'text-border-width': 1,
            'text-border-color': '#374151',
            'text-outline-color': '#0b1220',
            'text-outline-width': 1
          }
        },
        {
          selector: 'edge.faded',
          style: {
            'opacity': 0.1
          }
        },
        { selector: 'edge[label="DEPENDS_ON"]', style: { 'line-style': 'dashed' } },
        { selector: 'edge[label="RELATED_TO"]', style: { 'width': 1, 'line-style': 'dotted' } }
      ],
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    const cy = cyInstance.current;

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

    // Hover Tooltip System
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const description = node.data('description') || 'No description available';

      const popperInstance = node.popper({
        content: () => {
          const div = document.createElement('div');
          div.className = 'knowledge-tooltip';
          div.innerHTML = `
            <h4>${node.data('label')}</h4>
            <p>${description}</p>
            <span class="tooltip-hint">Click to explore</span>
          `;
          document.body.appendChild(div);
          return div;
        },
        popper: {
          placement: 'auto',
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport'
              }
            }
          ]
        }
      });

      const tip = tippy(popperInstance.popper, {
        trigger: 'manual',
        arrow: true,
        placement: 'auto',
        theme: 'knowledge-map',
        getReferenceClientRect: popperInstance.state.elements.reference.getBoundingClientRect
      });

      tip.show();
      node.data('tippy', tip);
      node.data('popperInstance', popperInstance);

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
      const tip = node.data('tippy');
      const popperInstance = node.data('popperInstance');

      if (tip) {
        tip.destroy();
        node.removeData('tippy');
      }

      if (popperInstance && popperInstance.state && popperInstance.state.elements.popper) {
        popperInstance.state.elements.popper.remove();
        node.removeData('popperInstance');
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

      layoutRef.current = cy.layout({
        name: 'dagre',
        rankDir: 'LR', // Left to Right flow
        nodeSep: 80,
        rankSep: 150,
        padding: 40,
        fit: true,
        animate: shouldAnimate,
        animationDuration: 500
      });
      layoutRef.current.run();
    });

    // Cleanup
    return () => {
      cancelAnimationFrame(runLayout);

      // Destroy all tooltips
      if (cy && !cy.destroyed()) {
        cy.nodes().forEach(node => {
          const tip = node.data('tippy');
          if (tip) tip.destroy();
        });
      }

      if (layoutRef.current) {
        try { layoutRef.current.stop(); } catch (e) { }
        layoutRef.current = null;
      }

      if (cyInstance.current) {
        try {
          if (!cyInstance.current.destroyed()) {
            cyInstance.current.stop(true, true);
            cyInstance.current.elements().remove();
            cyInstance.current.removeAllListeners();
            cyInstance.current.destroy();
          }
        } catch (e) {
          console.warn("Cleanup error:", e);
        }
        cyInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  // Bind Events (Separate effect)
  useEffect(() => {
    if (!cyInstance.current || cyInstance.current.destroyed()) return;

    const cy = cyInstance.current;
    // Events are now bound in the main effect above

  }, [onNodeClick]);

  // Handle selected node
  useEffect(() => {
    if (!cyInstance.current || cyInstance.current.destroyed()) return;

    if (selectedNode) {
      cyInstance.current.nodes().unselect();
      const node = cyInstance.current.getElementById(selectedNode.id);
      if (node && node.length > 0) {
        node.select();
        cyInstance.current.stop(); // Stop potential previous animations
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
        // Zoom to node with animation
        cyInstance.current.stop();
        cyInstance.current.animate({
          center: { eles: node },
          zoom: 1.8
        }, {
          duration: 400,
          easing: 'ease-in-out'
        });

        // Flash highlight effect
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
      {graphData.nodes.length === 0 ? (
        <div className="empty-graph" data-testid="empty-graph-state">
          <Brain size={64} className="empty-icon" />
          <h2>No Graph Yet</h2>
          <p>Enter a query, upload a PDF, or paste code to generate a knowledge graph</p>
        </div>
      ) : (
        <div ref={cyRef} className="cy-container" data-testid="cytoscape-container" />
      )}
    </div>
  );
}
