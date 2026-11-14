import React, { useState } from 'react';
import { FileText, ExternalLink, Quote, AlertOctagon, HelpCircle, Sparkles } from 'lucide-react';
import { Finding } from '../types';

interface EvidenceTabProps {
  findings: Finding[];
}

export const EvidenceTab: React.FC<EvidenceTabProps> = ({ findings }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = Array.from(new Set(findings.map((f) => f.category))).filter(Boolean);

  const filtered = findings.filter((f) => {
    if (filterType !== 'all' && f.finding_type !== filterType) return false;
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'fact':
        return <FileText size={15} color="#10b981" />;
      case 'inference':
        return <Sparkles size={15} color="#3b82f6" />;
      case 'contradiction':
        return <AlertOctagon size={15} color="#ef4444" />;
      default:
        return <HelpCircle size={15} color="#f59e0b" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: '14px 20px', borderRadius: '10px', border: '1px solid #1f2937' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'fact', 'inference', 'contradiction'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                backgroundColor: filterType === t ? '#2563eb' : '#1f2937',
                color: filterType === t ? '#ffffff' : '#94a3b8',
                border: '1px solid #374151',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t === 'all' ? 'All Types' : `${t}s`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              backgroundColor: '#1f2937',
              color: '#f8fafc',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Findings List */}
      {filtered.length === 0 ? (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '60px', textAlign: 'center', color: '#64748b' }}>
          No findings matching the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#111827',
                border: '1px solid #1f2937',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                    {getTypeIcon(item.finding_type)}
                  </div>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.summary}
                    </span>
                    <span style={{ marginLeft: '10px', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#94a3b8', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>
                      {item.category}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: item.confidence >= 0.8 ? '#10b981' : item.confidence >= 0.6 ? '#3b82f6' : '#f59e0b' }}>
                    {Math.round(item.confidence * 100)}% Confidence
                  </span>
                  {item.temporal_date && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'JetBrains Mono' }}>
                      Date: {item.temporal_date.slice(0, 10)}
                    </div>
                  )}
                </div>
              </div>

              {item.detail && (
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {item.detail}
                </div>
              )}

              {item.confidence_explanation && (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Rationale: {item.confidence_explanation}
                </div>
              )}

              {/* Verbatim Source Citations */}
              {item.sources && item.sources.length > 0 && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Verifiable Source Citations ({item.sources.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {item.sources.map((src) => (
                      <div
                        key={src.id}
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '6px',
                          padding: '10px 12px',
                        }}
                      >
                        {src.excerpt && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <Quote size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '12px', color: '#e2e8f0', fontStyle: 'italic' }}>
                              "{src.excerpt}"
                            </span>
                          </div>
                        )}
                        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontSize: '11px', textDecoration: 'none' }}
                          >
                            <ExternalLink size={11} /> {src.url}
                          </a>
                          {src.page_or_section && (
                            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono' }}>
                              Section: {src.page_or_section}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
