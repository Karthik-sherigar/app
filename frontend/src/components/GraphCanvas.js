import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

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
            'font-size': '12px',
            'color': '#f9fafb',
            'text-outline-color': '#0b1220',
            'text-outline-width': 2,
            'width': (ele) => 40 + (ele.data('importance') || 1) * 10,
            'height': (ele) => 40 + (ele.data('importance') || 1) * 10,
          }
        },
        { selector: 'node[type="Concept"]', style: { 'background-color': '#3b82f6', 'shape': 'ellipse' } },
        { selector: 'node[type="Prerequisite"]', style: { 'background-color': '#f59e0b', 'shape': 'ellipse' } },
        { selector: 'node[type="CodeBlock"]', style: { 'background-color': '#22c55e', 'shape': 'rectangle' } },
        { selector: 'node[type="DocumentSection"]', style: { 'background-color': '#a855f7', 'shape': 'round-rectangle' } },
        { selector: 'node[type="Component"], node[type="Application"]', style: { 'background-color': '#06b6d4', 'shape': 'ellipse' } },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#6366f1',
            'box-shadow': '0 0 20px #6366f1'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#9ca3af',
            'text-outline-color': '#0b1220',
            'text-outline-width': 1
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

    // Bind Events
    cy.on('tap', 'node', (evt) => {
      const node = evt.target.data();
      onNodeClick(node);
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.style('background-color', '#6366f1');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      const type = node.data('type');
      const colors = {
        'Concept': '#3b82f6',
        'Prerequisite': '#f59e0b',
        'CodeBlock': '#22c55e',
        'DocumentSection': '#a855f7',
        'Component': '#06b6d4',
        'Application': '#06b6d4'
      };
      node.style('background-color', colors[type] || '#3b82f6');
    });

    // Run Layout in RAF to avoid race conditions with cleanup
    const runLayout = requestAnimationFrame(() => {
      if (!cy || cy.destroyed()) return;

      layoutRef.current = cy.layout({
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      });
      layoutRef.current.run();
    });

    // Cleanup
    return () => {
      cancelAnimationFrame(runLayout);

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
    cy.removeAllListeners();

    cy.on('tap', 'node', (evt) => {
      const node = evt.target.data();
      onNodeClick(node);
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.style('background-color', '#6366f1');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      const type = node.data('type');
      const colors = {
        'Concept': '#3b82f6',
        'Prerequisite': '#f59e0b',
        'CodeBlock': '#22c55e',
        'DocumentSection': '#a855f7',
        'Component': '#06b6d4',
        'Application': '#06b6d4'
      };
      node.style('background-color', colors[type] || '#3b82f6');
    });

  }, [onNodeClick]);

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
        const originalColor = node.style('background-color');
        node.style('background-color', '#6366f1');

        setTimeout(() => {
          if (cyInstance.current && !cyInstance.current.destroyed()) {
            const currentNode = cyInstance.current.getElementById(externalSelectedNode);
            if (currentNode && currentNode.length > 0) {
              currentNode.style('background-color', originalColor);
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

// Import Brain icon
import { Brain } from "lucide-react";
