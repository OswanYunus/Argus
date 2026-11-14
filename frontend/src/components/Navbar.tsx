import React from 'react';
import { Shield, PlusCircle, RefreshCw, Trash2, Play } from 'lucide-react';
import { InvestigationSummary, Investigation } from '../types';

interface NavbarProps {
  investigations: InvestigationSummary[];
  selectedId: string | null;
  currentInvestigation: Investigation | null;
  onSelect: (id: string) => void;
  onOpenNew: () => void;
  onRun: () => void;
  onRescan: () => void;
  onPurge: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  investigations,
  selectedId,
  currentInvestigation,
  onSelect,
  onOpenNew,
  onRun,
  onRescan,
  onPurge,
  loading,
}) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      backgroundColor: '#111827',
      borderBottom: '1px solid #1f2937'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: '#3b82f6',
          padding: '8px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)'
        }}>
          <Shield size={22} color="#ffffff" />
        </div>
        <div>
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.05em', color: '#f8fafc' }}>
            ARGUS
          </span>
          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px', fontFamily: 'JetBrains Mono' }}>
            v0.1.0-INTEL
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Target:</span>
          <select
            value={selectedId || ''}
            onChange={(e) => onSelect(e.target.value)}
            style={{
              backgroundColor: '#1f2937',
              color: '#f8fafc',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {investigations.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.target_name})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <PlusCircle size={15} /> New Target
        </button>

        {currentInvestigation && (
          <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #374151', paddingLeft: '16px' }}>
            <button
              onClick={onRun}
              disabled={loading}
              title="Execute full multi-stage scan"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <Play size={14} /> Full Scan
            </button>

            <button
              onClick={onRescan}
              disabled={loading}
              title="Rescan with memory: checks existing sources for changes and captures newly indexed footprint"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Rescan (Memory)
            </button>

            <button
              onClick={onPurge}
              disabled={loading}
              title="Cryptographically wipe all documents and cascade delete investigation"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <Trash2 size={14} /> Purge
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
