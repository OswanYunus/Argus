import React from 'react';
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
  const totalTokens = (resources.llm_token_input || 0) + (resources.llm_token_output || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Case header */}
      <div
        className="panel"
        style={{
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ maxWidth: '560px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="eyebrow">case no. {investigation.id.slice(0, 8)}</span>
            <span
              className={`stamp ${investigation.status === 'completed' ? 'stamp-teal' : 'stamp-brass'}`}
            >
              {investigation.status}
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: '28px',
              fontFamily: 'var(--font-display)',
              color: 'var(--paper)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {investigation.name}
          </h2>
          <p style={{ margin: '10px 0 0 0', color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
            {investigation.description || 'Target intelligence profile with evidence-backed provenance.'}
          </p>
        </div>

        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--faint)' }}>
          <div>subject: <span style={{ color: 'var(--paper)' }}>{investigation.target_name}</span></div>
          <div style={{ marginTop: '5px' }}>encryption: Fernet AES-128, at rest</div>
        </div>
      </div>

      {/* Ledger strip */}
      <div className="ledger-strip">
        <div className="ledger-cell">
          <div className="eyebrow">identities</div>
          <div style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '6px' }}>
            {identities.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--teal)', marginTop: '3px' }}>
            {verifiedCount} verified · {likelyCount} likely
          </div>
        </div>

        <div className="ledger-cell">
          <div className="eyebrow">findings</div>
          <div style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '6px' }}>
            {findings.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
            cited with source excerpts
          </div>
        </div>

        <div className="ledger-cell">
          <div className="eyebrow">footprint</div>
          <div style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '6px' }}>
            {urls.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
            {collectedUrls} indexed · {rejectedUrls} filtered
          </div>
        </div>

        <div className="ledger-cell">
          <div className="eyebrow">telemetry</div>
          <div style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '6px' }}>
            {totalTokens.toLocaleString()}
            <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--faint)', fontFamily: 'var(--font-sans)' }}> tok</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
            {resources.llm_call || 0} calls · {resources.http_request || 0} requests
          </div>
        </div>
      </div>

      {/* Seeds */}
      <div className="panel" style={{ padding: '26px 32px' }}>
        <h3 style={{ margin: '0 0 18px 0', fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--paper)', fontWeight: 600 }}>
          Signals on file
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          <SeedGroup label="Usernames / handles" values={investigation.target_signals?.usernames} />
          <SeedGroup label="Known emails" values={investigation.target_signals?.emails} />
          <SeedGroup label="Associated domains" values={investigation.target_signals?.domains} />
        </div>
      </div>
    </div>
  );
};

const SeedGroup: React.FC<{ label: string; values?: string[] }> = ({ label, values }) => (
  <div>
    <span className="eyebrow">{label}</span>
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {(values && values.length > 0 ? values : ['none specified']).map((v, idx) => (
        <div
          key={idx}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: values && values.length > 0 ? 'var(--paper)' : 'var(--faint)',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '6px',
          }}
        >
          {v}
        </div>
      ))}
    </div>
  </div>
);
