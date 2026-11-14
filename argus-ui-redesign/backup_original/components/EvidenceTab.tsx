import React, { useState } from 'react';
import { ExternalLink, Quote } from 'lucide-react';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderRadius: '10px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'fact', 'inference', 'contradiction'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="glass-btn"
              style={{
                backgroundColor: filterType === t ? 'rgba(56, 189, 248, 0.2)' : undefined,
                borderColor: filterType === t ? 'rgba(56, 189, 248, 0.4)' : undefined,
                color: filterType === t ? '#38bdf8' : '#94a3b8',
                padding: '6px 12px',
                fontSize: '12px',
                textTransform: 'capitalize',
              }}
            >
              {t === 'all' ? 'All Types' : `${t}s`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>CATEGORY:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="glass-btn"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              outline: 'none',
              color: '#f8fafc',
            }}
          >
            <option value="all" style={{ backgroundColor: '#0f172a' }}>All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c} style={{ backgroundColor: '#0f172a' }}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Findings List */}
      {filtered.length === 0 ? (
        <div className="glass-panel" style={{ borderRadius: '10px', padding: '80px', textAlign: 'center', color: '#64748b' }}>
          No findings matching the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              className="glass-card"
              style={{
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.summary}
                    </span>
                    <span
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        textTransform: 'capitalize',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: item.confidence >= 0.8 ? '#34d399' : item.confidence >= 0.6 ? '#38bdf8' : '#fbbf24',
                    }}
                  >
                    {Math.round(item.confidence * 100)}% Confidence
                  </span>
                  {item.temporal_date && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
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
                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
                    Verifiable Source Citations ({item.sources.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {item.sources.map((src) => (
                      <div
                        key={src.id}
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                        }}
                      >
                        {src.excerpt && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <Quote size={13} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
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
                            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
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
