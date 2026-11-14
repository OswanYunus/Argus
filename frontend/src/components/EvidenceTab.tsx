import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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
      {/* Controls */}
      <div
        className="panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '2px' }}>
          {['all', 'fact', 'inference', 'contradiction'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="btn"
              style={{
                background: filterType === t ? 'var(--brass-dim)' : 'transparent',
                borderColor: filterType === t ? 'var(--brass)' : 'var(--line)',
                color: filterType === t ? 'var(--brass)' : 'var(--muted)',
                padding: '6px 12px',
                fontSize: '12px',
              }}
            >
              {t === 'all' ? 'All types' : `${t}s`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="eyebrow">category</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="field-input"
            style={{ padding: '6px 10px', fontSize: '12px', width: 'auto' }}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel" style={{ padding: '80px', textAlign: 'center', color: 'var(--faint)' }}>
          No findings matching the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filtered.map((item, idx) => (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                borderLeft: `2px solid ${item.confidence >= 0.8 ? 'var(--brass)' : item.confidence >= 0.6 ? 'var(--teal)' : 'var(--clay)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span className="eyebrow">{String(idx + 1).padStart(3, '0')}</span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--paper)' }}>
                    {item.summary}
                  </span>
                  <span className="eyebrow" style={{ textTransform: 'none' }}>{item.category}</span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: item.confidence >= 0.8 ? 'var(--brass)' : item.confidence >= 0.6 ? 'var(--teal)' : 'var(--clay)',
                    }}
                  >
                    {Math.round(item.confidence * 100)}%
                  </span>
                  {item.temporal_date && (
                    <div style={{ fontSize: '11px', color: 'var(--faint)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {item.temporal_date.slice(0, 10)}
                    </div>
                  )}
                </div>
              </div>

              {item.detail && (
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
                  {item.detail}
                </div>
              )}

              {item.confidence_explanation && (
                <div style={{ fontSize: '12px', color: 'var(--faint)', fontStyle: 'italic' }}>
                  {item.confidence_explanation}
                </div>
              )}

              {item.sources && item.sources.length > 0 && (
                <div style={{ marginTop: '4px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
                  <span className="eyebrow">source citations ({item.sources.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {item.sources.map((src) => (
                      <div
                        key={src.id}
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.22)',
                          borderLeft: '2px solid var(--line-strong)',
                          padding: '10px 14px',
                        }}
                      >
                        {src.excerpt && (
                          <div style={{ fontSize: '12px', color: 'var(--paper)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            {src.excerpt}
                          </div>
                        )}
                        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--teal)', fontSize: '11px', textDecoration: 'none' }}
                          >
                            <ExternalLink size={11} /> {src.url}
                          </a>
                          {src.page_or_section && (
                            <span style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
                              {src.page_or_section}
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
