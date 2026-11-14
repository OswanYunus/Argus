import React, { useState } from 'react';
import { UserCheck, AlertTriangle, HelpCircle, CheckCircle2, Layers } from 'lucide-react';
import { Identity, IdentitySignal } from '../types';
import { fetchIdentitySignals } from '../services/api';

interface IdentitiesTabProps {
  investigationId: string;
  identities: Identity[];
}

export const IdentitiesTab: React.FC<IdentitiesTabProps> = ({ investigationId, identities }) => {
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [signals, setSignals] = useState<IdentitySignal[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(false);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span style={{ backgroundColor: '#065f46', color: '#34d399', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> VERIFIED
          </span>
        );
      case 'likely':
        return (
          <span style={{ backgroundColor: '#1e3a8a', color: '#60a5fa', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <UserCheck size={12} /> LIKELY
          </span>
        );
      case 'ambiguous':
        return (
          <span style={{ backgroundColor: '#78350f', color: '#fbbf24', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} /> AMBIGUOUS
          </span>
        );
      default:
        return (
          <span style={{ backgroundColor: '#334155', color: '#94a3b8', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <HelpCircle size={12} /> UNVERIFIED
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Identity List */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="#3b82f6" /> Resolved Target & Discovered Aliases
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {identities.map((ident) => (
            <div
              key={ident.id}
              onClick={() => loadSignals(ident)}
              style={{
                backgroundColor: selectedIdentity?.id === ident.id ? '#1e293b' : '#0f172a',
                border: `1px solid ${selectedIdentity?.id === ident.id ? '#3b82f6' : '#1e293b'}`,
                borderRadius: '8px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                      {ident.display_name || ident.canonical_value}
                    </span>
                    {ident.is_target && (
                      <span style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        PRIMARY TARGET
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontFamily: 'JetBrains Mono' }}>
                    Type: {ident.identity_type} | Value: {ident.canonical_value}
                  </div>
                </div>
                {getStatusBadge(ident.verification_status)}
              </div>

              {/* Confidence Bar */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Attribution Confidence</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{Math.round(ident.confidence * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${ident.confidence * 100}%`,
                      backgroundColor: ident.confidence >= 0.8 ? '#10b981' : ident.confidence >= 0.6 ? '#3b82f6' : '#f59e0b',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>

              {ident.confidence_explanation && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {ident.confidence_explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Signal Evidence Explorer */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 600 }}>
          Corroborating Evidence Signals
        </h3>

        {!selectedIdentity ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '13px' }}>
            Select an identity from the left to inspect its independent signal evidence and provenance.
          </div>
        ) : loadingSignals ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            Loading corroborating signals...
          </div>
        ) : signals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '13px' }}>
            No independent signals recorded yet for this identity.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {signals.map((sig) => (
              <div
                key={sig.id}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>
                    {sig.signal_type.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono' }}>
                    Strength: {Math.round(sig.signal_strength * 100)}%
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 500, color: '#f8fafc', margin: '4px 0' }}>
                  {sig.signal_value}
                </div>

                {sig.raw_evidence && (
                  <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '4px', fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', margin: '6px 0' }}>
                    "{sig.raw_evidence}"
                  </div>
                )}

                {sig.source_url && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Source:{' '}
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
  );
};
