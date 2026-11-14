import React, { useState } from 'react';
import { UserCheck, AlertTriangle, HelpCircle, CheckCircle2, Layers, Search, Compass, RefreshCw, ArrowRight } from 'lucide-react';
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
      setPivotMessage(`Pivot complete: Discovered ${res.urls_discovered} new URLs & collected ${res.docs_collected} documents across platforms.`);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Pivot Exploration Bar */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Compass size={18} color="#38bdf8" />
          <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
            Alias Pivot Engine (Past Instagram Usernames & Secondary Handles)
          </h4>
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8' }}>
          Encountered a previous username from Instagram's "About this account", a forum signature, or a bio? Enter it here to recursively scan all 23 platforms and index dorks, linking findings back to the main target graph.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
              @
            </span>
            <input
              type="text"
              placeholder="e.g. past_handle, old_username"
              value={pivotUsername}
              onChange={(e) => setPivotUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePivot(pivotUsername)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '9px 12px 9px 30px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => handlePivot(pivotUsername)}
            disabled={isPivoting || !pivotUsername.trim()}
            style={{
              backgroundColor: isPivoting ? '#1e3a8a' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isPivoting || !pivotUsername.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isPivoting ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Pivoting across 23 hubs...
              </>
            ) : (
              <>
                <Search size={14} /> Pivot Scan Alias
              </>
            )}
          </button>
        </div>

        {pivotMessage && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              backgroundColor: pivotMessage.includes('error') ? '#450a0a' : '#064e3b',
              color: pivotMessage.includes('error') ? '#fca5a5' : '#a7f3d0',
              border: `1px solid ${pivotMessage.includes('error') ? '#7f1d1d' : '#065f46'}`,
            }}
          >
            {pivotMessage}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Identity List */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#3b82f6" /> Resolved Target & Discovered Aliases ({identities.length})
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
                      {ident.is_target ? (
                        <span style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          PRIMARY TARGET
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#0f766e', color: '#5eead4', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          LINKED ALIAS
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

        {/* Signals Explorer */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={18} color="#10b981" />
            Corroborating Evidence & Discovered Handles
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                      {sig.signal_value}
                    </div>

                    {/* Quick Pivot Button for username / alias signals */}
                    {(sig.signal_type === 'username_match' || sig.signal_type === 'bio_reference' || !sig.signal_value.includes('@')) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePivot(sig.signal_value);
                        }}
                        disabled={isPivoting}
                        title={`Pivot search across all platforms for ${sig.signal_value}`}
                        style={{
                          backgroundColor: '#1e293b',
                          color: '#38bdf8',
                          border: '1px solid #334155',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Compass size={11} /> Pivot Across Platforms <ArrowRight size={10} />
                      </button>
                    )}
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
    </div>
  );
};
