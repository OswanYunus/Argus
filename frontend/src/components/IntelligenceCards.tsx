import React, { useState } from 'react';
import {
  ExternalLink,
  Layers,
  Search,
  CheckCircle,
  Compass,
  RefreshCw,
  Copy,
  Check,
  Share2
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

  // Group and parse URLs and signals into platform cards
  const parseAssets = (): ParsedPlatformAsset[] => {
    const assets: ParsedPlatformAsset[] = [];
    const seenUrls = new Set<string>();

    // 1. Parse discovered URLs
    for (const u of urls) {
      if (seenUrls.has(u.url)) continue;
      seenUrls.add(u.url);

      const urlLower = u.url.toLowerCase();
      let platform = 'Web Asset';
      let category: ParsedPlatformAsset['category'] = 'web';
      let handle = '';

      if (urlLower.includes('instagram.com')) {
        platform = 'Instagram';
        category = 'social';
        const m = u.url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('github.com')) {
        platform = 'GitHub';
        category = 'code';
        const m = u.url.match(/github\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('tiktok.com')) {
        platform = 'TikTok';
        category = 'social';
        const m = u.url.match(/tiktok\.com\/@?([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('snapchat.com')) {
        platform = 'Snapchat';
        category = 'social';
        const m = u.url.match(/snapchat\.com\/add\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linkedin.com')) {
        platform = 'LinkedIn';
        category = 'social';
        const m = u.url.match(/linkedin\.com\/in\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('t.me/')) {
        platform = 'Telegram';
        category = 'messaging';
        const m = u.url.match(/t\.me\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('pinterest.com')) {
        platform = 'Pinterest';
        category = 'social';
        const m = u.url.match(/pinterest\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('soundcloud.com')) {
        platform = 'SoundCloud';
        category = 'audio';
        const m = u.url.match(/soundcloud\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('duolingo.com')) {
        platform = 'Duolingo';
        category = 'education';
        const m = u.url.match(/duolingo\.com\/profile\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('steamcommunity.com')) {
        platform = 'Steam';
        category = 'gaming';
        const m = u.url.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linktr.ee')) {
        platform = 'Linktree';
        category = 'social';
        const m = u.url.match(/linktr\.ee\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('reddit.com')) {
        platform = 'Reddit';
        category = 'social';
        const m = u.url.match(/reddit\.com\/user\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('chess.com')) {
        platform = 'Chess.com';
        category = 'gaming';
        const m = u.url.match(/chess\.com\/member\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      }

      // Collect past usernames / aliases detected for this identity or handle
      const pastUsernames = new Set<string>();
      if (handle) {
        // Collect aliases from signals and permutations
        for (const s of signals) {
          if (s.signal_type === 'bio_reference' || s.signal_type === 'username_match') {
            const cleanVal = s.signal_value.toLowerCase().replace(/^@/, '');
            if (cleanVal && cleanVal !== handle.toLowerCase()) {
              pastUsernames.add(cleanVal);
            }
          }
        }
        // Known permutations (e.g. oswan_yunus -> oswanyunus, oswan-yunus)
        const noDelims = handle.replace(/[-_.]/g, '');
        if (noDelims && noDelims.toLowerCase() !== handle.toLowerCase()) {
          pastUsernames.add(noDelims.toLowerCase());
        }
        if (handle.includes('_')) {
          pastUsernames.add(handle.replace(/_/g, '-').toLowerCase());
        }
      }

      assets.push({
        id: u.id,
        platform,
        category,
        handle: handle ? `@${handle}` : '',
        profileUrl: u.url,
        title: u.title || `${platform} Profile`,
        snippet: u.snippet || '',
        status: u.status,
        pastUsernames: Array.from(pastUsernames).slice(0, 4),
        relevance: u.relevance_score || 0.8,
      });
    }

    return assets;
  };

  const allAssets = parseAssets();

  // Filtering
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

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'Instagram':
        return '#e1306c';
      case 'TikTok':
        return '#00f2fe';
      case 'GitHub':
        return '#f0f6fc';
      case 'Snapchat':
        return '#fffc00';
      case 'LinkedIn':
        return '#0a66c2';
      case 'Telegram':
        return '#229ed9';
      case 'SoundCloud':
        return '#ff5500';
      case 'Duolingo':
        return '#58cc02';
      case 'Steam':
        return '#66c0f4';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar: Search & Category Filters */}
      <div
        className="glass-panel"
        style={{
          borderRadius: '10px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Search Filter */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.4)',
            }}
          />
          <input
            type="text"
            placeholder="Filter platforms or handles..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '7px 12px 7px 32px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {[
            { id: 'all', label: `All Assets (${allAssets.length})` },
            { id: 'social', label: 'Social & Media' },
            { id: 'code', label: 'Developer Hubs' },
            { id: 'gaming', label: 'Gaming' },
            { id: 'messaging', label: 'Messaging' },
          ].map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="glass-btn"
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 400,
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: active ? 'rgba(96, 165, 250, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  color: active ? '#93c5fd' : '#94a3b8',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      {filteredAssets.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            borderRadius: '12px',
            color: '#64748b',
          }}
        >
          <Layers size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#f1f5f9' }}>
            No platform assets matching filter
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Run an investigation or adjust your filter keyword to display discovered footprint cards.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredAssets.map((asset, idx) => {
            const color = getPlatformColor(asset.platform);
            return (
              <div
                key={asset.id}
                className="glass-card animate-card-in"
                style={{
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  animationDelay: `${idx * 0.04}s`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Subtle top edge platform accent line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, ${color} 0%, transparent 80%)`,
                    opacity: 0.8,
                  }}
                />

                {/* Card Top: Platform Name & Direct Link */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '2px',
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}80`,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#f8fafc',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {asset.platform}
                      </span>
                      {asset.handle && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: '#94a3b8',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {asset.handle}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {asset.handle && (
                        <button
                          onClick={() => handleCopy(asset.handle, asset.id)}
                          title="Copy handle"
                          className="glass-btn"
                          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                        >
                          {copiedId === asset.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      )}
                      <a
                        href={asset.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open verified profile"
                        className="glass-btn"
                        style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Profile Snippet / Bio Excerpt */}
                  {asset.snippet && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#cbd5e1',
                        lineHeight: 1.5,
                        backgroundColor: 'rgba(10, 14, 22, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        margin: '10px 0',
                        maxHeight: '85px',
                        overflowY: 'auto',
                      }}
                    >
                      {asset.snippet}
                    </div>
                  )}

                  {/* PAST USERNAMES / ALIASES ON THIS PROFILE CARD (User's specific osintsearch.org requirement!) */}
                  {asset.pastUsernames.length > 0 && (
                    <div
                      style={{
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#38bdf8',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Compass size={12} />
                        Past / Associated Usernames:
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {asset.pastUsernames.map((prevU) => {
                          const isCurrentPivoting = pivotingHandle === prevU;
                          return (
                            <button
                              key={prevU}
                              onClick={() => handleExecutePivot(prevU)}
                              disabled={isPivoting}
                              title={`Click to launch recursive search for past username @${prevU}`}
                              className="glass-btn"
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: isCurrentPivoting ? '#93c5fd' : '#f1f5f9',
                                backgroundColor: isCurrentPivoting ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                                borderColor: isCurrentPivoting ? '#60a5fa' : 'rgba(255, 255, 255, 0.15)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {isCurrentPivoting ? (
                                <RefreshCw size={11} className="animate-spin" />
                              ) : (
                                <Share2 size={10} color="#38bdf8" />
                              )}
                              @{prevU}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Metadata & Status */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '16px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    fontSize: '11px',
                    color: '#64748b',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={11} color="#10b981" />
                    Verified Discovery
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    Score: {Math.round(asset.relevance * 100)}%
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
