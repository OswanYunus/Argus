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
    <div className="panel" style={{ padding: '28px 32px' }}>
      <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--paper)', fontWeight: 600 }}>
        Engine telemetry
      </h3>
      <p style={{ margin: '0 0 24px 0', color: 'var(--muted)', fontSize: '13px' }}>
        Deterministic bounds guard every HTTP probe, platform scraper, and entity extraction.
      </p>

      <div className="ledger-strip">
        <div className="ledger-cell">
          <div className="eyebrow">LLM token usage</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '8px' }}>
            {totalTokens.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {tokenIn.toLocaleString()} in / {tokenOut.toLocaleString()} out
          </div>
        </div>

        <div className="ledger-cell">
          <div className="eyebrow">Model inferences</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '8px' }}>
            {llmCalls}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '4px' }}>
            entity extraction &amp; provenance
          </div>
        </div>

        <div className="ledger-cell">
          <div className="eyebrow">HTTP probes</div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--paper)', marginTop: '8px' }}>
            {httpReqs}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '4px' }}>
            {(docBytes / (1024 * 1024)).toFixed(2)} MB encrypted at rest
          </div>
        </div>
      </div>
    </div>
  );
};
