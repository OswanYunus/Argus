import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { DiscoveredUrl } from '../types';

interface SourcesTabProps {
  urls: DiscoveredUrl[];
}

export const SourcesTab: React.FC<SourcesTabProps> = ({ urls }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = urls.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery && !u.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stampFor = (status: string) => {
    switch (status) {
      case 'filtered': return { cls: 'stamp-brass', label: 'passed' };
      case 'collected': return { cls: 'stamp-teal', label: 'indexed' };
      case 'rejected': return { cls: 'stamp-clay', label: 'rejected' };
      case 'robots_blocked': return { cls: 'stamp-clay', label: 'blocked' };
      default: return { cls: 'stamp-muted', label: status };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          {['all', 'filtered', 'collected', 'rejected', 'robots_blocked'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="btn"
              style={{
                background: statusFilter === s ? 'var(--brass-dim)' : 'transparent',
                borderColor: statusFilter === s ? 'var(--brass)' : 'var(--line)',
                color: statusFilter === s ? 'var(--brass)' : 'var(--muted)',
                padding: '6px 12px',
                fontSize: '12px',
              }}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter sources…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="field-input"
          style={{ width: '220px' }}
        />
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--line)', color: 'var(--faint)' }}>
              <th style={{ padding: '13px 18px', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>url / endpoint</th>
              <th style={{ padding: '13px 18px', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '10.5px', width: '150px' }}>status</th>
              <th style={{ padding: '13px 18px', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '10.5px', width: '220px' }}>analysis</th>
              <th style={{ padding: '13px 18px', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '10.5px', width: '110px' }}>first seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--faint)' }}>
                  No discovered URLs matching this filter.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const stamp = stampFor(u.status);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--line)', color: 'var(--paper)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--paper)' }}>
                        {u.title || 'Untitled discovery'}
                      </div>
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--teal)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                      >
                        <ExternalLink size={11} /> {u.url}
                      </a>
                      {u.snippet && (
                        <div style={{ color: 'var(--faint)', fontSize: '11px', marginTop: '4px', maxWidth: '600px' }}>
                          {u.snippet}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '12px', color: u.rejection_reason ? 'var(--clay)' : 'var(--muted)' }}>
                      {u.rejection_reason || 'Passed relevance heuristics'}
                    </td>
                    <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--faint)' }}>
                      {u.first_seen_at.slice(0, 10)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
