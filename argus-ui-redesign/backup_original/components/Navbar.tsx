import React from 'react';
import { RefreshCw, Play, Trash2, Plus } from 'lucide-react';
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
    <header
      className="glass-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        zIndex: 50,
      }}
    >
      {/* Brand Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #38bdf8 0%, #1e40af 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#ffffff',
            }}
          >
            ARGUS
          </span>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#64748b',
              letterSpacing: '0.05em',
            }}
          >
            INTELLIGENCE CORE
          </span>
        </div>
      </div>

      {/* Target Selector & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {investigations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>TARGET:</span>
            <select
              value={selectedId || ''}
              onChange={(e) => onSelect(e.target.value)}
              className="glass-btn"
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                outline: 'none',
                maxWidth: '240px',
                color: '#f8fafc',
              }}
            >
              {investigations.map((inv) => (
                <option
                  key={inv.id}
                  value={inv.id}
                  style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                >
                  {inv.name} ({inv.target_name})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={onOpenNew}
          className="glass-btn glass-btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '13px',
          }}
        >
          <Plus size={14} /> New Target
        </button>

        {currentInvestigation && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginLeft: '8px',
              paddingLeft: '14px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              onClick={onRun}
              disabled={loading}
              title="Execute full multi-stage scan"
              className="glass-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                fontSize: '12px',
                color: '#34d399',
                borderColor: 'rgba(52, 211, 153, 0.25)',
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Play size={12} fill="#34d399" /> Run Scan
            </button>

            <button
              onClick={onRescan}
              disabled={loading}
              title="Rescan with memory (incremental change detection)"
              className="glass-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                fontSize: '12px',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.25)',
                opacity: loading ? 0.5 : 1,
              }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Rescan
            </button>

            <button
              onClick={onPurge}
              disabled={loading}
              title="Cryptographically wipe target and all records"
              className="glass-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 10px',
                fontSize: '12px',
                color: '#f87171',
                borderColor: 'rgba(248, 113, 113, 0.2)',
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
