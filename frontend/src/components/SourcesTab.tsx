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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'filtered':
        return (
          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            PASSED
          </span>
        );
      case 'collected':
        return (
          <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            INDEXED
          </span>
        );
      case 'rejected':
        return (
          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            REJECTED
          </span>
        );
      case 'robots_blocked':
        return (
          <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            ROBOTS BLOCKED
          </span>
        );
      default:
        return (
          <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            {status.toUpperCase()}
          </span>
        );
    }
  };

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
          {['all', 'filtered', 'collected', 'rejected', 'robots_blocked'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="glass-btn"
              style={{
                backgroundColor: statusFilter === s ? 'rgba(56, 189, 248, 0.2)' : undefined,
                borderColor: statusFilter === s ? 'rgba(56, 189, 248, 0.4)' : undefined,
                color: statusFilter === s ? '#38bdf8' : '#94a3b8',
                padding: '6px 12px',
                fontSize: '12px',
                textTransform: 'capitalize',
              }}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter sources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-btn"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '7px 12px',
            fontSize: '12px',
            width: '220px',
            outline: 'none',
            color: '#f8fafc',
          }}
        />
      </div>

      {/* URLs Table */}
      <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.07)', color: '#64748b' }}>
              <th style={{ padding: '14px 18px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase' }}>URL / Target Endpoint</th>
              <th style={{ padding: '14px 18px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', width: '160px' }}>Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', width: '220px' }}>Analysis</th>
              <th style={{ padding: '14px 18px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', width: '110px' }}>First Seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No discovered URLs found matching filter.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: '#e2e8f0' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 500, color: '#f8fafc' }}>
                      {u.title || 'Untitled Discovery'}
                    </div>
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#60a5fa', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                    >
                      <ExternalLink size={11} /> {u.url}
                    </a>
                    {u.snippet && (
                      <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', maxWidth: '600px' }}>
                        {u.snippet}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>{getStatusBadge(u.status)}</td>
                  <td style={{ padding: '14px 18px', fontSize: '12px', color: u.rejection_reason ? '#fca5a5' : '#94a3b8' }}>
                    {u.rejection_reason || 'Verified discovery passed relevance heuristics'}
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
                    {u.first_seen_at.slice(0, 10)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
