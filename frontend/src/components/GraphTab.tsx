import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { RotateCcw } from 'lucide-react';
import { CytoscapeElement } from '../types';

interface GraphTabProps {
  elements: CytoscapeElement[];
}

export const GraphTab: React.FC<GraphTabProps> = ({ elements }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements as any,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#211f18',
            label: 'data(label)',
            color: '#ece7da',
            'font-size': '11px',
            'font-family': 'IBM Plex Sans, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 30,
            height: 30,
            shape: 'round-rectangle',
            'border-width': 1.5,
            'border-color': '#5e9485',
          },
        },
        {
          selector: 'node[?isTarget]',
          style: {
            'background-color': '#2a2310',
            'border-color': '#c9a227',
            width: 40,
            height: 40,
            'font-weight': 'bold',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.25,
            'line-color': 'rgba(236, 231, 218, 0.18)',
            'target-arrow-color': 'rgba(236, 231, 218, 0.3)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '9px',
            color: '#9c9484',
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#121210',
            'text-background-padding': '2px',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-color': '#c9a227',
            'border-width': 2.5,
            'line-color': '#c9a227',
            'target-arrow-color': '#c9a227',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 50,
      },
    });

    cy.on('tap', 'node', (evt) => {
      setSelectedNode(evt.target.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [elements]);

  const resetView = () => {
    if (cyRef.current) {
      cyRef.current.fit();
      cyRef.current.center();
    }
  };

  return (
    <div className="panel" style={{ position: 'relative', width: '100%', height: '600px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <button onClick={resetView} className="btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
          <RotateCcw size={13} /> Reset view
        </button>
      </div>

      {selectedNode && (
        <div
          className="panel"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            padding: '16px',
            width: '250px',
            borderColor: 'var(--brass)',
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontFamily: 'var(--font-display)', color: 'var(--paper)' }}>
            {selectedNode.label}
          </h4>
          <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)' }}>
            <div>type <span style={{ color: 'var(--paper)' }}>{selectedNode.type}</span></div>
            <div>status <span style={{ color: 'var(--paper)' }}>{selectedNode.status}</span></div>
            <div>confidence <span style={{ color: 'var(--teal)' }}>{Math.round((selectedNode.confidence || 0) * 100)}%</span></div>
            {selectedNode.isTarget && (
              <div style={{ color: 'var(--brass)', marginTop: '4px' }}>target entity</div>
            )}
          </div>
        </div>
      )}

      {elements.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)' }}>
          No graph relationships mapped yet. Run a scan to discover associations.
        </div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};
