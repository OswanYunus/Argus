import React from 'react';
import { Database, FileText, UserCheck, Activity, Key } from 'lucide-react';
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
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#f8fafc', fontWeight: 600 }}>
              {investigation.name}
            </h2>
            <span style={{
              backgroundColor: investigation.status === 'completed' ? '#065f46' : '#1e3a8a',
              color: investigation.status === 'completed' ? '#34d399' : '#60a5fa',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {investigation.status}
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            {investigation.description || 'Target profile investigation with evidence-backed provenance.'}
          </p>
        </div>

        <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: '12px', color: '#64748b' }}>
          <div>ID: {investigation.id}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Key size={12} color="#10b981" /> Encrypted at rest (Fernet AES-128)
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
            <span>Target Subject</span>
            <UserCheck size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {investigation.target_name}
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
            {verifiedCount} verified, {likelyCount} likely aliases
          </div>
        </div>

        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
            <span>Verified Findings</span>
            <FileText size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {findings.length}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            100% cited with verbatim excerpts
          </div>
        </div>

        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
            <span>Public Webpages</span>
            <Database size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {urls.length}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            {collectedUrls} collected, {rejectedUrls} rejected/filtered
          </div>
        </div>

        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
            <span>Resource Usage</span>
            <Activity size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
            {(resources.llm_token_input || 0) + (resources.llm_token_output || 0)} <span style={{ fontSize: '13px', fontWeight: 400 }}>tokens</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            {resources.llm_call || 0} LLM calls, {resources.http_request || 0} HTTP reqs
          </div>
        </div>
      </div>

      {/* Target Signals & Discovery Seeds */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
          Seed Signals & Authorized Boundaries
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Emails</span>
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(investigation.target_signals?.emails || ['None specified']).map((e, idx) => (
                <span key={idx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}>
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Usernames</span>
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(investigation.target_signals?.usernames || ['None specified']).map((u, idx) => (
                <span key={idx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}>
                  {u}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Domains</span>
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(investigation.target_signals?.domains || ['None specified']).map((d, idx) => (
                <span key={idx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}>
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
