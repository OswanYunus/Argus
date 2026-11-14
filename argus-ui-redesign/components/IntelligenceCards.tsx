import React, { useState } from 'react';
import {
  ExternalLink,
  Layers,
  Search,
  Copy,
  Check,
  Share2,
  RefreshCw,
} from 'lucide-react';
import { DiscoveredUrl, IdentitySignal } from '../types';

interface IntelligenceCardsProps {
  urls: DiscoveredUrl[];
  signals?: IdentitySignal[];
  onPivot: (username: string) => Promise<void>;
  isPivoting?: boolean;
}

interface ParsedPlatformAsset {
  id: string;
  platform: string;
  category: 'social' | 'code' | 'messaging' | 'gaming' | 'audio' | 'education' | 'web';
  handle: string;
  profileUrl: string;
  title?: string;
  snippet?: string;
  status: string;
  pastUsernames: string[];
  relevance: number;
}

// Category → accent, drawn from the case-ledger palette rather than each
// platform's own brand neon. Keeps the grid calm and lets the pivot buttons
// be the thing that stands out.
const CATEGORY_ACCENT: Record<ParsedPlatformAsset['category'], string> = {
  social: 'var(--teal)',
  code: 'var(--brass)',
  gaming: 'var(--clay)',
  messaging: 'var(--teal)',
  audio: 'var(--brass)',
  education: 'var(--teal)',
  web: 'var(--faint)',
};

export const IntelligenceCards: React.FC<IntelligenceCardsProps> = ({
  urls,
  signals = [],
  onPivot,
  isPivoting = false,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [pivotingHandle, setPivotingHandle] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const parseAssets = (): ParsedPlatformAsset[] => {
    const assets: ParsedPlatformAsset[] = [];
    const seenUrls = new Set<string>();

    for (const u of urls) {
      if (seenUrls.has(u.url)) continue;
      seenUrls.add(u.url);

      const urlLower = u.url.toLowerCase();
      let platform = 'Web asset';
      let category: ParsedPlatformAsset['category'] = 'web';
      let handle = '';

      if (urlLower.includes('instagram.com')) {
        platform = 'Instagram'; category = 'social';
        const m = u.url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('github.com')) {
        platform = 'GitHub'; category = 'code';
        const m = u.url.match(/github\.com\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('tiktok.com')) {
        platform = 'TikTok'; category = 'social';
        const m = u.url.match(/tiktok\.com\/@?([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('snapchat.com')) {
        platform = 'Snapchat'; category = 'social';
        const m = u.url.match(/snapchat\.com\/add\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linkedin.com')) {
        platform = 'LinkedIn'; category = 'social';
        const m = u.url.match(/linkedin\.com\/in\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('t.me/')) {
        platform = 'Telegram'; category = 'messaging';
        const m = u.url.match(/t\.me\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('pinterest.com')) {
        platform = 'Pinterest'; category = 'social';
        const m = u.url.match(/pinterest\.com\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('soundcloud.com')) {
        platform = 'SoundCloud'; category = 'audio';
        const m = u.url.match(/soundcloud\.com\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('duolingo.com')) {
        platform = 'Duolingo'; category = 'education';
        const m = u.url.match(/duolingo\.com\/profile\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('steamcommunity.com')) {
        platform = 'Steam'; category = 'gaming';
        const m = u.url.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linktr.ee')) {
        platform = 'Linktree'; category = 'social';
        const m = u.url.match(/linktr\.ee\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('reddit.com')) {
        platform = 'Reddit'; category = 'social';
        const m = u.url.match(/reddit\.com\/user\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('chess.com')) {
        platform = 'Chess.com'; category = 'gaming';
        const m = u.url.match(/chess\.com\/member\/([a-zA-Z0-9_.-]+)/i); handle = m ? m[1].replace(/\/$/, '') : '';
      }

      const pastUsernames = new Set<string>();
      if (handle) {
        for (const s of signals) {
          if (s.signal_type === 'bio_reference' || s.signal_type === 'username_match') {
            const cleanVal = s.signal_value.toLowerCase().replace(/^@/, '');
            if (cleanVal && cleanVal !== handle.toLowerCase()) pastUsernames.add(cleanVal);
          }
        }
        const noDelims = handle.replace(/[-_.]/g, '');
        if (noDelims && noDelims.toLowerCase() !== handle.toLowerCase()) pastUsernames.add(noDelims.toLowerCase());
        if (handle.includes('_')) pastUsernames.add(handle.replace(/_/g, '-').toLowerCase());
      }

      assets.push({
        id: u.id,
        platform,
        category,
        handle: handle ? `@${handle}` : '',
        profileUrl: u.url,
        title: u.title || `${platform} profile`,
        snippet: u.snippet || '',
        status: u.status,
        pastUsernames: Array.from(pastUsernames).slice(0, 4),
        relevance: u.relevance_score || 0.8,
      });
    }

    return assets;
  };

  const allAssets = parseAssets();

  const filteredAssets = allAssets.filter((a) => {
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    const matchesQuery =
      !filterQuery ||
      a.platform.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.handle.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (a.title && a.title.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (a.snippet && a.snippet.toLowerCase().includes(filterQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExecutePivot = async (username: string) => {
    setPivotingHandle(username);
    try {
      await onPivot(username);
    } finally {
      setPivotingHandle(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls */}
      <div
        className="panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
          <input
            type="text"
            placeholder="Filter platforms or handles…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="field-input"
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All exhibits (${allAssets.length})` },
            { id: 'social', label: 'Social & media' },
            { id: 'code', label: 'Developer hubs' },
            { id: 'gaming', label: 'Gaming' },
            { id: 'messaging', label: 'Messaging' },
          ].map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="btn"
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  background: active ? 'var(--brass-dim)' : 'transparent',
                  borderColor: active ? 'var(--brass)' : 'var(--line)',
                  color: active ? 'var(--brass)' : 'var(--muted)',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--faint)' }}>
          <Layers size={30} style={{ margin: '0 auto 14px auto', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--paper)', fontWeight: 600 }}>
            No platform assets matching this filter
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Run a scan, or widen your filter keyword, to populate exhibit cards here.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '2px',
          }}
        >
          {filteredAssets.map((asset, idx) => {
            const accent = CATEGORY_ACCENT[asset.category];
            return (
              <div
                key={asset.id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  borderLeft: `2px solid ${accent}`,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                      <span className="eyebrow">{String(idx + 1).padStart(3, '0')}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, color: 'var(--paper)' }}>
                        {asset.platform}
                      </span>
                      {asset.handle && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)' }}>
                          {asset.handle}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      {asset.handle && (
                        <button onClick={() => handleCopy(asset.handle, asset.id)} title="Copy handle" className="btn-plain" style={{ cursor: 'pointer' }}>
                          {copiedId === asset.id ? <Check size={13} color="var(--teal)" /> : <Copy size={13} />}
                        </button>
                      )}
                      <a href={asset.profileUrl} target="_blank" rel="noreferrer" title="Open profile" className="btn-plain" style={{ textDecoration: 'none' }}>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>

                  {asset.snippet && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        lineHeight: 1.55,
                        backgroundColor: 'rgba(0,0,0,0.18)',
                        padding: '10px 12px',
                        margin: '8px 0',
                        maxHeight: '85px',
                        overflowY: 'auto',
                      }}
                    >
                      {asset.snippet}
                    </div>
                  )}

                  {asset.pastUsernames.length > 0 && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
                      <div className="eyebrow" style={{ marginBottom: '8px', color: 'var(--brass)' }}>
                        past / associated usernames
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {asset.pastUsernames.map((prevU) => {
                          const isCurrentPivoting = pivotingHandle === prevU;
                          return (
                            <button
                              key={prevU}
                              onClick={() => handleExecutePivot(prevU)}
                              disabled={isPivoting}
                              title={`Pivot a new search on past username @${prevU}`}
                              className="btn"
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: isCurrentPivoting ? 'var(--brass)' : 'var(--paper)',
                                background: isCurrentPivoting ? 'var(--brass-dim)' : 'transparent',
                                borderColor: isCurrentPivoting ? 'var(--brass)' : 'var(--line-strong)',
                              }}
                            >
                              {isCurrentPivoting ? <RefreshCw size={11} className="animate-spin" /> : <Share2 size={10} />}
                              @{prevU}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '16px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--line)',
                    fontSize: '11px',
                    color: 'var(--faint)',
                  }}
                >
                  <span className="stamp stamp-teal">verified</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    score {Math.round(asset.relevance * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
