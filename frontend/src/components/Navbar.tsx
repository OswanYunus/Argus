import React from 'react';
import { RefreshCw, Play, Trash2, Plus, Loader2 } from 'lucide-react';
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
  scanType?: 'scan' | 'rescan' | null;
  scanElapsed?: number;
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
  scanType = null,
  scanElapsed = 0,
}) => {
  return (
    <header
      className="panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
      }}
    >
      {/* Letterhead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
        <div
          style={{
            width: '30px',
            height: '30px',
            border: '1.5px solid var(--brass)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '15px',
            color: 'var(--brass)',
          }}
        >
          A
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '19px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              color: 'var(--paper)',
            }}
          >
            Argus
          </span>
          <span
            style={{
              fontSize: '11.5px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--faint)',
            }}
          >
            case management
          </span>
        </div>
      </div>

      {/* Case selector & actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {investigations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>case</span>
            <select
              value={selectedId || ''}
              onChange={(e) => onSelect(e.target.value)}
              className="field-input"
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                width: 'auto',
                maxWidth: '240px',
              }}
            >
              {investigations.map((inv) => (
                <option
                  key={inv.id}
                  value={inv.id}
                  style={{ backgroundColor: '#1a1914', color: 'var(--paper)' }}
                >
                  {inv.name} ({inv.target_name})
                </option>
              ))}
            </select>
          </div>
        )}

        <button onClick={onOpenNew} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
          <Plus size={13} /> New case
        </button>

        {currentInvestigation && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginLeft: '6px',
              paddingLeft: '14px',
              borderLeft: '1px solid var(--line)',
            }}
          >
            <button
              onClick={onRun}
              disabled={loading}
              title="Execute full multi-stage scan"
              className="btn btn-teal"
              style={{
                padding: '7px 12px',
                fontSize: '12.5px',
                borderColor: scanType === 'scan' ? 'var(--teal)' : undefined,
                backgroundColor: scanType === 'scan' ? 'var(--teal-dim)' : undefined,
              }}
            >
              {scanType === 'scan' ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Scanning… ({scanElapsed}s)
                </>
              ) : (
                <>
                  <Play size={12} /> Run scan
                </>
              )}
            </button>

            <button
              onClick={onRescan}
              disabled={loading}
              title="Rescan with memory (incremental change detection)"
              className="btn btn-brass"
              style={{
                padding: '7px 12px',
                fontSize: '12.5px',
                borderColor: scanType === 'rescan' ? 'var(--brass)' : undefined,
                backgroundColor: scanType === 'rescan' ? 'var(--brass-dim)' : undefined,
              }}
            >
              {scanType === 'rescan' ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Rescanning… ({scanElapsed}s)
                </>
              ) : (
                <>
                  <RefreshCw size={12} /> Rescan
                </>
              )}
            </button>

            <button
              onClick={onPurge}
              disabled={loading}
              title="Purge case file and all records"
              className="btn btn-clay"
              style={{ padding: '7px 10px', fontSize: '12.5px' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
