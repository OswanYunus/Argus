import React from 'react';

interface ResourcesTabProps {
  resources: Record<string, number>;
}

export const ResourcesTab: React.FC<ResourcesTabProps> = ({ resources }) => {
  const tokenIn = resources.llm_token_input || 0;
  const tokenOut = resources.llm_token_output || 0;
  const totalTokens = tokenIn + tokenOut;
  const llmCalls = resources.llm_call || 0;
  const httpReqs = resources.http_request || 0;
  const docBytes = resources.document_bytes || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ borderRadius: '12px', padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontFamily: 'var(--font-display)', color: '#f8fafc', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Engine Telemetry & Resource Budgets
        </h3>
        <p style={{ margin: '0 0 24px 0', color: '#94a3b8', fontSize: '13px' }}>
          Deterministic bounds guard all HTTP probes, platform scrapers, and neural entity extractions.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="glass-card" style={{ borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              LLM Token Usage
            </div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
              {totalTokens.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {tokenIn.toLocaleString()} in / {tokenOut.toLocaleString()} out
            </div>
          </div>

          <div className="glass-card" style={{ borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Model Inferences
            </div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
              {llmCalls}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              Entity Extraction & Provenance
            </div>
          </div>

          <div className="glass-card" style={{ borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              HTTP Probes & Fetches
            </div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
              {httpReqs}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {(docBytes / (1024 * 1024)).toFixed(2)} MB encrypted at rest
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
