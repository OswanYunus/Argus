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
          <span style={{ backgroundColor: '#065f46', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            FILTERED (PASSED)
          </span>
        );
      case 'collected':
        return (
          <span style={{ backgroundColor: '#1e3a8a', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            COLLECTED
          </span>
        );
      case 'rejected':
        return (
          <span style={{ backgroundColor: '#7f1d1d', color: '#f87171', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            REJECTED
          </span>
        );
      case 'robots_blocked':
        return (
          <span style={{ backgroundColor: '#78350f', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            ROBOTS.TXT BLOCKED
          </span>
        );
      default:
        return (
          <span style={{ backgroundColor: '#334155', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: '14px 20px', borderRadius: '10px', border: '1px solid #1f2937' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'filtered', 'collected', 'rejected', 'robots_blocked'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                backgroundColor: statusFilter === s ? '#2563eb' : '#1f2937',
                color: statusFilter === s ? '#ffffff' : '#94a3b8',
                border: '1px solid #374151',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search URLs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '6px 12px',
            fontSize: '13px',
            width: '240px',
            outline: 'none',
          }}
        />
      </div>

      {/* URLs Table */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1f2937', color: '#94a3b8' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>URL / Webpage</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '180px' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '220px' }}>Analysis / Rejection Reason</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '120px' }}>Discovered</th>
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
                <tr key={u.id} style={{ borderBottom: '1px solid #1f2937', color: '#e2e8f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#f8fafc' }}>
                      {u.title || 'Untitled Document'}
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
                  <td style={{ padding: '12px 16px' }}>{getStatusBadge(u.status)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: u.rejection_reason ? '#fca5a5' : '#94a3b8' }}>
                    {u.rejection_reason || 'Passed all deterministic relevance filters'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#64748b' }}>
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
