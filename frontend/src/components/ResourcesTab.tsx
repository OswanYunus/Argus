import React from 'react';
import { Activity, Cpu, HardDrive, Zap } from 'lucide-react';

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
      <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#3b82f6" /> Real-time Resource Consumption & Budget Limits
        </h3>
        <p style={{ margin: '0 0 24px 0', color: '#94a3b8', fontSize: '13px' }}>
          Every HTTP fetch, search query, and LLM inference is bounded by strict budget ceilings to prevent resource exhaustion.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '12px' }}>
              <span>LLM Token Usage</span>
              <Cpu size={16} color="#3b82f6" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
              {totalTokens.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {tokenIn.toLocaleString()} in / {tokenOut.toLocaleString()} out
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '12px' }}>
              <span>Total Model Calls</span>
              <Zap size={16} color="#10b981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
              {llmCalls}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              DeepSeek Chat (OpenAI-compatible)
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '12px' }}>
              <span>HTTP Fetch Operations</span>
              <HardDrive size={16} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
              {httpReqs}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {(docBytes / (1024 * 1024)).toFixed(2)} MB encrypted at rest
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
