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
            'font-family': 'Inter, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 34,
            height: 34,
            'border-width': 2,
            'border-color': '#3b82f6',
          },
        },
        {
          selector: 'node[?isTarget]',
          style: {
            'background-color': '#059669',
            'border-color': '#10b981',
            width: 44,
            height: 44,
            'font-weight': 'bold',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '9px',
            color: '#94a3b8',
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#0b0f17',
            'text-background-padding': '2px',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-color': '#f59e0b',
            'border-width': 4,
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
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
    <div style={{ position: 'relative', width: '100%', height: '600px', backgroundColor: '#111827', borderRadius: '10px', border: '1px solid #1f2937', overflow: 'hidden' }}>
      {/* Top Overlay Controls */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: '8px' }}>
        <button
          onClick={resetView}
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} /> Center View
        </button>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          backgroundColor: '#0f172a',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '16px',
          width: '280px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f8fafc' }}>
            {selectedNode.label}
          </h4>
          <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>Type: <span style={{ color: '#f8fafc' }}>{selectedNode.type}</span></div>
            <div>Status: <span style={{ color: '#f8fafc' }}>{selectedNode.status}</span></div>
            <div>Confidence: <span style={{ color: '#10b981' }}>{Math.round((selectedNode.confidence || 0) * 100)}%</span></div>
            {selectedNode.isTarget && (
              <div style={{ color: '#38bdf8', fontWeight: 600, marginTop: '4px' }}>Primary Target Entity</div>
            )}
          </div>
        </div>
      )}

      {elements.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          No graph relationships mapped for this investigation yet. Run a scan to discover associations.
        </div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};
