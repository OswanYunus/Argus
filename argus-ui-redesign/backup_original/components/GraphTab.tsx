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
            'background-color': '#1e3a8a',
            label: 'data(label)',
            color: '#f8fafc',
            'font-size': '11px',
            'font-family': 'Space Grotesk, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 32,
            height: 32,
            'border-width': 1,
            'border-color': '#38bdf8',
          },
        },
        {
          selector: 'node[?isTarget]',
          style: {
            'background-color': '#065f46',
            'border-color': '#34d399',
            width: 42,
            height: 42,
            'font-weight': 'bold',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': 'rgba(255, 255, 255, 0.15)',
            'target-arrow-color': 'rgba(255, 255, 255, 0.25)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '9px',
            color: '#64748b',
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#07090e',
            'text-background-padding': '2px',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-color': '#38bdf8',
            'border-width': 3,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
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
    <div className="glass-panel" style={{ position: 'relative', width: '100%', height: '600px', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Top Overlay Controls */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <button
          onClick={resetView}
          className="glass-btn"
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
          }}
        >
          <RotateCcw size={13} /> Reset View
        </button>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            borderRadius: '8px',
            padding: '16px',
            width: '260px',
            border: '1px solid rgba(56, 189, 248, 0.4)',
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontFamily: 'var(--font-display)', color: '#f8fafc' }}>
            {selectedNode.label}
          </h4>
          <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)' }}>
            <div>Type: <span style={{ color: '#f8fafc' }}>{selectedNode.type}</span></div>
            <div>Status: <span style={{ color: '#f8fafc' }}>{selectedNode.status}</span></div>
            <div>Confidence: <span style={{ color: '#34d399' }}>{Math.round((selectedNode.confidence || 0) * 100)}%</span></div>
            {selectedNode.isTarget && (
              <div style={{ color: '#38bdf8', marginTop: '4px' }}>Target Entity</div>
            )}
          </div>
        </div>
      )}

      {elements.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          No graph relationships mapped yet. Run a scan to discover associations.
        </div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};
