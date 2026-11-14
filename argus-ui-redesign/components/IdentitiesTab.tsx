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
      setPivotMessage(`Pivot complete — ${res.urls_discovered} new URLs discovered, ${res.docs_collected} evidence records indexed.`);
      setPivotUsername('');
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setPivotMessage(`error: ${err.message || 'failed to execute pivot'}`);
    } finally {
      setIsPivoting(false);
    }
  };

  const stampClass = (status: string) => {
    switch (status) {
      case 'verified': return 'stamp stamp-brass';
      case 'likely': return 'stamp stamp-teal';
      case 'ambiguous': return 'stamp stamp-clay';
      default: return 'stamp stamp-muted';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Pivot bar */}
      <div className="panel" style={{ padding: '22px 28px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontFamily: 'var(--font-display)', color: 'var(--paper)', fontWeight: 600 }}>
          Recursive alias pivot
        </h4>
        <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: 'var(--muted)' }}>
          Enter a past handle, forum pseudonym, or nickname to open a fresh pivot search linked to this case.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
              @
            </span>
            <input
              type="text"
              placeholder="past_username, previous_handle"
              value={pivotUsername}
              onChange={(e) => setPivotUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePivot(pivotUsername)}
              className="field-input field-mono"
              style={{ paddingLeft: '28px' }}
            />
          </div>

          <button
            onClick={() => handlePivot(pivotUsername)}
            disabled={isPivoting || !pivotUsername.trim()}
            className="btn btn-primary"
            style={{ padding: '0 20px', fontSize: '13px' }}
          >
            {isPivoting ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Pivoting 23 hubs&hellip;
              </>
            ) : (
              'Execute pivot'
            )}
          </button>
        </div>

        {pivotMessage && (
          <div
            style={{
              marginTop: '12px',
              padding: '9px 14px',
              fontSize: '12.5px',
              color: pivotMessage.startsWith('error') ? 'var(--clay)' : 'var(--teal)',
              borderLeft: `2px solid ${pivotMessage.startsWith('error') ? 'var(--clay)' : 'var(--teal)'}`,
              background: pivotMessage.startsWith('error') ? 'var(--clay-dim)' : 'var(--teal-dim)',
            }}
          >
            {pivotMessage}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Identity list */}
        <div className="panel" style={{ padding: '22px 26px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--paper)', fontWeight: 600 }}>
            Identities &amp; aliases ({identities.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {identities.map((ident) => (
              <div
                key={ident.id}
                onClick={() => loadSignals(ident)}
                className="card"
                style={{
                  padding: '14px 16px',
                  cursor: 'pointer',
                  borderLeft: selectedIdentity?.id === ident.id ? '2px solid var(--brass)' : '2px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--paper)' }}>
                        {ident.display_name || ident.canonical_value}
                      </span>
                      {ident.is_target && (
                        <span className="eyebrow" style={{ color: 'var(--brass)' }}>target</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                      {ident.identity_type} · {ident.canonical_value}
                    </div>
                  </div>
                  <span className={stampClass(ident.verification_status)}>{ident.verification_status}</span>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--faint)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                    <span>confidence</span>
                    <span style={{ color: 'var(--paper)' }}>{Math.round(ident.confidence * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '2px', backgroundColor: 'var(--line)' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${ident.confidence * 100}%`,
                        backgroundColor: ident.confidence >= 0.8 ? 'var(--brass)' : ident.confidence >= 0.6 ? 'var(--teal)' : 'var(--clay)',
                      }}
                    />
                  </div>
                </div>

                {ident.confidence_explanation && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.45 }}>
                    {ident.confidence_explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Signals */}
        <div className="panel" style={{ padding: '22px 26px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--paper)', fontWeight: 600 }}>
            Signal provenance
          </h3>

          {!selectedIdentity ? (
            <EmptyNote text="Select an identity to inspect its supporting signals." />
          ) : loadingSignals ? (
            <EmptyNote text="Retrieving signal graph…" />
          ) : signals.length === 0 ? (
            <EmptyNote text="No independent signals recorded yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {signals.map((sig) => (
                <div key={sig.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="eyebrow" style={{ color: 'var(--teal)' }}>
                      {sig.signal_type.replace(/_/g, ' ')}
                    </span>
                    <span className="eyebrow">weight {Math.round(sig.signal_strength * 100)}%</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--paper)', fontFamily: 'var(--font-mono)' }}>
                      {sig.signal_value}
                    </div>

                    {(sig.signal_type === 'username_match' || sig.signal_type === 'bio_reference' || !sig.signal_value.includes('@')) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePivot(sig.signal_value);
                        }}
                        disabled={isPivoting}
                        className="btn btn-plain"
                        style={{ fontSize: '11px', color: 'var(--brass)' }}
                      >
                        pivot <ArrowRight size={10} />
                      </button>
                    )}
                  </div>

                  {sig.raw_evidence && (
                    <div style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: '10px', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', margin: '8px 0' }}>
                      {sig.raw_evidence}
                    </div>
                  )}

                  {sig.source_url && (
                    <div style={{ fontSize: '11px', color: 'var(--faint)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={sig.source_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
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

const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ textAlign: 'left', padding: '32px 4px', color: 'var(--faint)', fontSize: '13px', borderLeft: '2px solid var(--line)', paddingLeft: '14px' }}>
    {text}
  </div>
);
