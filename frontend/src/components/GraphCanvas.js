import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

export default function GraphCanvas({ graphData, onNodeClick, selectedNode }) {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);

  useEffect(() => {
    if (!cyRef.current) return;

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

    if (cyInstance.current) {
      cyInstance.current.destroy();
    }

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
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
        {
          selector: 'node[type="Concept"]',
          style: {
            'background-color': '#3b82f6',
            'shape': 'ellipse'
          }
        },
        {
          selector: 'node[type="Prerequisite"]',
          style: {
            'background-color': '#f59e0b',
            'shape': 'ellipse'
          }
        },
        {
          selector: 'node[type="CodeBlock"]',
          style: {
            'background-color': '#22c55e',
            'shape': 'rectangle'
          }
        },
        {
          selector: 'node[type="DocumentSection"]',
          style: {
            'background-color': '#a855f7',
            'shape': 'round-rectangle'
          }
        },
        {
          selector: 'node[type="Component"], node[type="Application"]',
          style: {
            'background-color': '#06b6d4',
            'shape': 'ellipse'
          }
        },
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
        {
          selector: 'edge[label="DEPENDS_ON"]',
          style: {
            'line-style': 'dashed'
          }
        },
        {
          selector: 'edge[label="RELATED_TO"]',
          style: {
            'width': 1,
            'line-style': 'dotted'
          }
        }
      ],
      layout: {
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
      },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    cyInstance.current.on('tap', 'node', (evt) => {
      const node = evt.target.data();
      onNodeClick(node);
    });

    cyInstance.current.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.style('background-color', '#6366f1');
    });

    cyInstance.current.on('mouseout', 'node', (evt) => {
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

    return () => {
      if (cyInstance.current) {
        cyInstance.current.destroy();
      }
    };
  }, [graphData]);

  useEffect(() => {
    if (cyInstance.current && selectedNode) {
      cyInstance.current.nodes().unselect();
      const node = cyInstance.current.getElementById(selectedNode.id);
      if (node) {
        node.select();
        cyInstance.current.animate({
          center: { eles: node },
          zoom: 1.5
        }, {
          duration: 300
        });
      }
    }
  }, [selectedNode]);

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
