import React from 'react';
import { Key } from 'lucide-react';
import { Investigation, Identity, Finding, DiscoveredUrl } from '../types';

interface OverviewTabProps {
  investigation: Investigation;
  identities: Identity[];
  findings: Finding[];
  urls: DiscoveredUrl[];
  resources: Record<string, number>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  investigation,
  identities,
  findings,
  urls,
  resources,
}) => {
  const verifiedCount = identities.filter((i) => i.verification_status === 'verified').length;
  const likelyCount = identities.filter((i) => i.verification_status === 'likely').length;
  const rejectedUrls = urls.filter((u) => u.status === 'rejected' || u.status === 'robots_blocked').length;
  const collectedUrls = urls.filter((u) => u.status === 'collected' || u.status === 'filtered').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Target Card */}
      <div
        className="glass-card"
        style={{
          borderRadius: '14px',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontFamily: 'var(--font-display)',
                color: '#f8fafc',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {investigation.name}
            </h2>
            <span
              style={{
                backgroundColor: investigation.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: investigation.status === 'completed' ? '#34d399' : '#38bdf8',
                border: `1px solid ${investigation.status === 'completed' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {investigation.status}
            </span>
          </div>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '13px', lineHeight: 1.5 }}>
            {investigation.description || 'Target intelligence profile with evidence-backed provenance.'}
          </p>
        </div>

        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
          <div>UID: {investigation.id}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', marginTop: '6px', color: '#34d399' }}>
            <Key size={11} /> Cryptographic At-Rest (Fernet AES-128)
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Target Subject
          </div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {investigation.target_name}
          </div>
          <div style={{ fontSize: '12px', color: '#34d399', marginTop: '4px' }}>
            {verifiedCount} verified, {likelyCount} likely aliases
          </div>
        </div>

        <div className="glass-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verified Findings
          </div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {findings.length}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            100% cited with source excerpts
          </div>
        </div>

        <div className="glass-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Discovered Footprint
          </div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {urls.length}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            {collectedUrls} indexed, {rejectedUrls} filtered
          </div>
        </div>

        <div className="glass-card" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Telemetry
          </div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {(resources.llm_token_input || 0) + (resources.llm_token_output || 0)}{' '}
            <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748b' }}>tokens</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            {resources.llm_call || 0} LLM calls, {resources.http_request || 0} HTTP reqs
          </div>
        </div>
      </div>

      {/* Target Signals & Discovery Seeds */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 26px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontFamily: 'var(--font-display)', color: '#f8fafc', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Active Investigation Seeds
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Usernames / Handles</span>
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(investigation.target_signals?.usernames || ['None specified']).map((u, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#e2e8f0',
                  }}
                >
                  {u}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Known Emails</span>
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(investigation.target_signals?.emails || ['None specified']).map((e, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#e2e8f0',
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Associated Domains</span>
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(investigation.target_signals?.domains || ['None specified']).map((d, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#e2e8f0',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
