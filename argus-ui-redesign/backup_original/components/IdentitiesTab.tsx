import React, { useState } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { Identity, IdentitySignal } from '../types';
import { fetchIdentitySignals, pivotAlias } from '../services/api';

interface IdentitiesTabProps {
  investigationId: string;
  identities: Identity[];
  onRefresh?: () => void;
}

export const IdentitiesTab: React.FC<IdentitiesTabProps> = ({ investigationId, identities, onRefresh }) => {
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [signals, setSignals] = useState<IdentitySignal[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [pivotUsername, setPivotUsername] = useState('');
  const [isPivoting, setIsPivoting] = useState(false);
  const [pivotMessage, setPivotMessage] = useState<string | null>(null);

  const loadSignals = async (ident: Identity) => {
    setSelectedIdentity(ident);
    setLoadingSignals(true);
    try {
      const data = await fetchIdentitySignals(investigationId, ident.id);
      setSignals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSignals(false);
    }
  };

  const handlePivot = async (usernameToPivot: string) => {
    const clean = usernameToPivot.trim().replace(/^@/, '');
    if (!clean) return;

    setIsPivoting(true);
    setPivotMessage(null);
    try {
      const res = await pivotAlias(investigationId, clean, `Pivoted on alias @${clean}`);
      setPivotMessage(`Pivot complete: Discovered ${res.urls_discovered} new URLs & indexed ${res.docs_collected} evidence records across platforms.`);
      setPivotUsername('');
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setPivotMessage(`Pivot error: ${err.message || 'Failed to execute pivot'}`);
    } finally {
      setIsPivoting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            VERIFIED
          </span>
        );
      case 'likely':
        return (
          <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            LIKELY
          </span>
        );
      case 'ambiguous':
        return (
          <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            AMBIGUOUS
          </span>
        );
      default:
        return (
          <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            UNVERIFIED
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Pivot Exploration Bar */}
      <div className="glass-panel" style={{ borderRadius: '12px', padding: '18px 24px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontFamily: 'var(--font-display)', color: '#f8fafc', fontWeight: 600 }}>
          Recursive Alias Pivot
        </h4>
        <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94a3b8' }}>
          Enter any past handle, forum pseudonym, or nickname to trigger an immediate multi-platform pivot linked to the subject.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              @
            </span>
            <input
              type="text"
              placeholder="e.g. past_username, previous_handle"
              value={pivotUsername}
              onChange={(e) => setPivotUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePivot(pivotUsername)}
              className="glass-btn"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '9px 12px 9px 30px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <button
            onClick={() => handlePivot(pivotUsername)}
            disabled={isPivoting || !pivotUsername.trim()}
            className="glass-btn glass-btn-primary"
            style={{
              padding: '0 20px',
              fontSize: '13px',
              fontWeight: 600,
              opacity: isPivoting || !pivotUsername.trim() ? 0.6 : 1,
            }}
          >
            {isPivoting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={13} className="animate-spin" /> Pivoting 23 Hubs...
              </span>
            ) : (
              'Execute Pivot'
            )}
          </button>
        </div>

        {pivotMessage && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              backgroundColor: pivotMessage.includes('error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: pivotMessage.includes('error') ? '#fca5a5' : '#a7f3d0',
              border: `1px solid ${pivotMessage.includes('error') ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            }}
          >
            {pivotMessage}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Identity List */}
        <div className="glass-panel" style={{ borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontFamily: 'var(--font-display)', color: '#f8fafc', fontWeight: 600 }}>
            Identities & Aliases ({identities.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {identities.map((ident) => (
              <div
                key={ident.id}
                onClick={() => loadSignals(ident)}
                className="glass-card"
                style={{
                  borderRadius: '8px',
                  padding: '14px',
                  cursor: 'pointer',
                  borderColor: selectedIdentity?.id === ident.id ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.07)',
                  backgroundColor: selectedIdentity?.id === ident.id ? 'rgba(30, 58, 138, 0.2)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                        {ident.display_name || ident.canonical_value}
                      </span>
                      {ident.is_target ? (
                        <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                          TARGET
                        </span>
                      ) : (
                        <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                          ALIAS
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                      {ident.identity_type} : {ident.canonical_value}
                    </div>
                  </div>
                  {getStatusBadge(ident.verification_status)}
                </div>

                {/* Attribution bar */}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                    <span>Confidence</span>
                    <span style={{ color: '#f8fafc' }}>{Math.round(ident.confidence * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${ident.confidence * 100}%`,
                        backgroundColor: ident.confidence >= 0.8 ? '#34d399' : ident.confidence >= 0.6 ? '#38bdf8' : '#fbbf24',
                      }}
                    />
                  </div>
                </div>

                {ident.confidence_explanation && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                    {ident.confidence_explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Signals Explorer */}
        <div className="glass-panel" style={{ borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontFamily: 'var(--font-display)', color: '#f8fafc', fontWeight: 600 }}>
            Signal Provenance
          </h3>

          {!selectedIdentity ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b', fontSize: '13px' }}>
              Select an identity to inspect supporting signals.
            </div>
          ) : loadingSignals ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8', fontSize: '13px' }}>
              Retrieving signal graph...
            </div>
          ) : signals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b', fontSize: '13px' }}>
              No independent signals recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className="glass-card"
                  style={{
                    borderRadius: '8px',
                    padding: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38bdf8', textTransform: 'uppercase' }}>
                      {sig.signal_type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      Weight: {Math.round(sig.signal_strength * 100)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                      {sig.signal_value}
                    </div>

                    {(sig.signal_type === 'username_match' || sig.signal_type === 'bio_reference' || !sig.signal_value.includes('@')) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePivot(sig.signal_value);
                        }}
                        disabled={isPivoting}
                        className="glass-btn"
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: '#38bdf8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Pivot <ArrowRight size={10} />
                      </button>
                    )}
                  </div>

                  {sig.raw_evidence && (
                    <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '8px 10px', borderRadius: '4px', fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', margin: '6px 0' }}>
                      "{sig.raw_evidence}"
                    </div>
                  )}

                  {sig.source_url && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={sig.source_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                        {sig.source_url}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
