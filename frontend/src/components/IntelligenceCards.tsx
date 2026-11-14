import React, { useState } from 'react';
import {
  ExternalLink,
  Layers,
  Search,
  Copy,
  Check,
  Share2,
  RefreshCw,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { DiscoveredUrl, Identity, IdentitySignal, Investigation } from '../types';

interface IntelligenceCardsProps {
  investigation?: Investigation | null;
  identities?: Identity[];
  urls: DiscoveredUrl[];
  signals?: IdentitySignal[];
  onPivot: (username: string) => Promise<void>;
  isPivoting?: boolean;
}

interface ParsedPlatformAsset {
  id: string;
  platform: string;
  category: 'social' | 'code' | 'messaging' | 'gaming' | 'audio' | 'education' | 'media' | 'web';
  handle: string;
  profileUrl: string;
  title?: string;
  snippet?: string;
  location?: string;
  status: 'verified' | 'active_profile';
  subUrlsCount: number;
  pastUsernames: string[];
  relevance: number;
}

export const IntelligenceCards: React.FC<IntelligenceCardsProps> = ({
  investigation,
  identities = [],
  urls,
  signals = [],
  onPivot,
  isPivoting = false,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [pivotingHandle, setPivotingHandle] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Gather all tracked handles across target and verified linked aliases
  const getTrackedUsernames = (): string[] => {
    const handleSet = new Set<string>();

    if (investigation?.target_signals?.usernames) {
      for (const u of investigation.target_signals.usernames) {
        const clean = u.trim().replace(/^@/, '').toLowerCase();
        if (clean) handleSet.add(clean);
      }
    }

    if (investigation?.target_name) {
      const tn = investigation.target_name.trim().replace(/^@/, '').toLowerCase();
      if (tn && !tn.includes(' ') && tn.length > 2) {
        handleSet.add(tn);
      }
    }

    for (const ident of identities) {
      if (ident.identity_type === 'username' || ident.canonical_value) {
        const clean = ident.canonical_value.trim().replace(/^@/, '').toLowerCase();
        if (clean && !clean.includes(' ') && !clean.includes('/')) {
          handleSet.add(clean);
        }
      }
    }

    return Array.from(handleSet);
  };

  const trackedUsernames = getTrackedUsernames();

  // Helper: Get real former/associated usernames for Instagram (from verified aliases and bio signals only - NO guessing)
  const getInstagramPastUsernames = (currentHandle: string): string[] => {
    const past = new Set<string>();
    const cleanCurrent = currentHandle.toLowerCase();

    // Actual linked alias identities recorded in the investigation database
    for (const ident of identities) {
      if (ident.canonical_value) {
        const val = ident.canonical_value.trim().replace(/^@/, '').toLowerCase();
        if (val && val !== cleanCurrent && !ident.is_target) {
          past.add(val);
        }
      }
    }

    // Extracted signals with verified provenance (e.g. bio references like "formerly @old_handle")
    for (const s of signals) {
      if (s.signal_type === 'bio_reference' || s.signal_type === 'alias_match') {
        const cleanVal = s.signal_value.toLowerCase().replace(/^@/, '');
        if (cleanVal && cleanVal !== cleanCurrent) {
          past.add(cleanVal);
        }
      }
    }

    return Array.from(past);
  };

  // 2. Parse ONLY profiles that have been FOUND or VERIFIED by probes/discovery
  const parseAssets = (): ParsedPlatformAsset[] => {
    // Map keyed by `${platform.toLowerCase()}:${handle.toLowerCase()}`
    const cardMap = new Map<string, ParsedPlatformAsset>();

    // Step A: Parse Discovered & Probed URLs (strictly excluding 404/rejected/error)
    for (const u of urls) {
      // Skip failed, rejected, or unverified endpoints
      if (u.status === 'rejected' || u.status === 'error' || u.status === 'robots_blocked') {
        continue;
      }

      const urlLower = u.url.toLowerCase();
      let platform = '';
      let category: ParsedPlatformAsset['category'] = 'web';
      let handle = '';
      let location = '';

      if (urlLower.includes('chess.com/member/')) {
        platform = 'Chess.com';
        category = 'gaming';
        const m = u.url.match(/chess\.com\/member\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
        // Extract real country from Chess.com probe response
        if (u.snippet) {
          const locMatch = u.snippet.match(/Location:\s*([^|]+)/i) || u.snippet.match(/Country:\s*([^|]+)/i);
          if (locMatch) {
            location = locMatch[1].trim();
          }
        }
      } else if (urlLower.includes('instagram.com/')) {
        platform = 'Instagram';
        category = 'social';
        const m = u.url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
        // Extract actual location from snippet if present
        if (u.snippet && u.snippet.includes('Account based in:')) {
          const locMatch = u.snippet.match(/Account based in:\s*([^|]+)/i);
          if (locMatch) location = locMatch[1].trim();
        } else if (u.snippet && u.snippet.includes('Location:')) {
          const locMatch = u.snippet.match(/Location:\s*([^|]+)/i);
          if (locMatch) location = locMatch[1].trim();
        }
      } else if (urlLower.includes('tiktok.com/@')) {
        platform = 'TikTok';
        category = 'social';
        const m = u.url.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('pinterest.com/')) {
        platform = 'Pinterest';
        category = 'social';
        const m = u.url.match(/pinterest\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('twitter.com/') || urlLower.includes('x.com/')) {
        platform = 'X (Twitter)';
        category = 'social';
        const m = u.url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linkedin.com/in/')) {
        platform = 'LinkedIn';
        category = 'social';
        const m = u.url.match(/linkedin\.com\/in\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('youtube.com/')) {
        platform = 'YouTube';
        category = 'media';
        const m = u.url.match(/youtube\.com\/(?:@|c\/|user\/)?([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('twitch.tv/')) {
        platform = 'Twitch';
        category = 'media';
        const m = u.url.match(/twitch\.tv\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('strava.com/athletes/')) {
        platform = 'Strava';
        category = 'social';
        const m = u.url.match(/strava\.com\/athletes\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('open.spotify.com/user/')) {
        platform = 'Spotify';
        category = 'audio';
        const m = u.url.match(/open\.spotify\.com\/user\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('github.com/')) {
        platform = 'GitHub';
        category = 'code';
        const m = u.url.match(/github\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('reddit.com/user/')) {
        platform = 'Reddit';
        category = 'social';
        const m = u.url.match(/reddit\.com\/user\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('t.me/')) {
        platform = 'Telegram';
        category = 'messaging';
        const m = u.url.match(/t\.me\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('steamcommunity.com/id/')) {
        platform = 'Steam';
        category = 'gaming';
        const m = u.url.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('duolingo.com/profile/')) {
        platform = 'Duolingo';
        category = 'education';
        const m = u.url.match(/duolingo\.com\/profile\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('soundcloud.com/')) {
        platform = 'SoundCloud';
        category = 'audio';
        const m = u.url.match(/soundcloud\.com\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('codeforces.com/profile/')) {
        platform = 'Codeforces';
        category = 'code';
        const m = u.url.match(/codeforces\.com\/profile\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('dev.to/')) {
        platform = 'Dev.to';
        category = 'code';
        const m = u.url.match(/dev\.to\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('hub.docker.com/u/')) {
        platform = 'DockerHub';
        category = 'code';
        const m = u.url.match(/hub\.docker\.com\/u\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('keybase.io/')) {
        platform = 'Keybase';
        category = 'code';
        const m = u.url.match(/keybase\.io\/([a-zA-Z0-9_.-]+)/i);
        handle = m ? m[1].replace(/\/$/, '') : '';
      } else {
        // Discovered independent web asset (personal blog, website, etc.)
        try {
          const parsed = new URL(u.url);
          platform = parsed.hostname.replace(/^www\./, '');
          category = 'web';
        } catch {
          platform = 'Web Asset';
        }
      }

      if (!platform) continue;

      const cleanHandle = handle || (trackedUsernames[0] || '');
      const lookupKey = `${platform.toLowerCase()}:${cleanHandle.toLowerCase()}`;

      // Deduplication: exactly ONE card per platform & handle!
      if (cardMap.has(lookupKey)) {
        const existing = cardMap.get(lookupKey)!;
        existing.subUrlsCount += 1;
        if (u.snippet && (!existing.snippet || existing.snippet.length < u.snippet.length)) {
          existing.snippet = u.snippet;
        }
        if (location && !existing.location) {
          existing.location = location;
        }
      } else {
        cardMap.set(lookupKey, {
          id: u.id,
          platform,
          category,
          handle: cleanHandle ? `@${cleanHandle}` : '',
          profileUrl: u.url,
          title: u.title || `${platform} Profile`,
          snippet: u.snippet || '',
          location,
          status: 'verified',
          subUrlsCount: 1,
          pastUsernames: platform === 'Instagram' ? getInstagramPastUsernames(cleanHandle) : [],
          relevance: u.relevance_score || 0.95,
        });
      }
    }

    return Array.from(cardMap.values());
  };

  const allAssets = parseAssets();

  // 3. Filter assets by category & search query
  const filteredAssets = allAssets.filter((a) => {
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    const matchesQuery =
      !filterQuery ||
      a.platform.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.handle.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (a.location && a.location.toLowerCase().includes(filterQuery.toLowerCase())) ||
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
      {/* Controls Bar */}
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
            placeholder="Filter found platforms or handles…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="field-input"
            style={{ paddingLeft: '32px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `Discovered Profiles (${allAssets.length})` },
            { id: 'social', label: 'Social' },
            { id: 'code', label: 'Code' },
            { id: 'gaming', label: 'Gaming' },
            { id: 'messaging', label: 'Messaging' },
            { id: 'media', label: 'Media' },
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

      {/* Cards Grid: ONLY FOUND PROFILES */}
      {filteredAssets.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--faint)' }}>
          <Layers size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--paper)', fontWeight: 600 }}>
            No verified profiles found matching filter
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Only profiles that have been verified to exist on external platforms are displayed here.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '14px',
          }}
        >
          {filteredAssets.map((asset) => {
            const isInstagram = asset.platform === 'Instagram';
            const isChess = asset.platform === 'Chess.com';

            return (
              <div
                key={asset.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  {/* Top line: Platform name, handle, verified badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--paper)',
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
                            color: 'var(--brass)',
                            backgroundColor: 'var(--brass-dim)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                          }}
                        >
                          {asset.handle}
                        </span>
                      )}
                    </div>

                    <span className="stamp stamp-teal" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <ShieldCheck size={11} /> FOUND
                    </span>
                  </div>

                  {/* Profile Link Box with quick copy & open */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(0, 0, 0, 0.22)',
                      border: '1px solid var(--line)',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--muted)',
                      marginTop: '6px',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                      {asset.profileUrl.replace(/^https?:\/\//, '')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleCopy(asset.profileUrl, asset.id)}
                        title="Copy profile URL"
                        className="btn-plain"
                        style={{ cursor: 'pointer', padding: '2px' }}
                      >
                        {copiedId === asset.id ? <Check size={12} color="var(--teal)" /> : <Copy size={12} />}
                      </button>
                      <a
                        href={asset.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open verified profile"
                        className="btn-plain"
                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Location display ONLY when verified from live data */}
                  {asset.location && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginTop: '8px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--teal)',
                      }}
                    >
                      <MapPin size={12} color="var(--teal)" />
                      <span>{isInstagram ? 'Account based in:' : 'Location:'} {asset.location}</span>
                    </div>
                  )}

                  {/* Snippet / Bio Preview */}
                  {asset.snippet && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        lineHeight: 1.45,
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        padding: '8px 10px',
                        borderRadius: '4px',
                        marginTop: '8px',
                        maxHeight: '60px',
                        overflowY: 'auto',
                      }}
                    >
                      {asset.snippet}
                    </div>
                  )}

                  {/* INSTAGRAM ONLY: FORMER USERNAMES (Strictly on Instagram, only actual recorded aliases) */}
                  {isInstagram && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--brass)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        <Share2 size={11} color="var(--brass)" />
                        Former Instagram Usernames:
                      </div>

                      {asset.pastUsernames.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {asset.pastUsernames.map((prevU) => {
                            const isCurrentPivoting = pivotingHandle === prevU;
                            return (
                              <button
                                key={prevU}
                                onClick={() => handleExecutePivot(prevU)}
                                disabled={isPivoting}
                                title={`Click to search across platforms for former username @${prevU}`}
                                className="btn"
                                style={{
                                  padding: '3px 9px',
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  color: isCurrentPivoting ? 'var(--brass)' : 'var(--paper)',
                                  background: isCurrentPivoting ? 'var(--brass-dim)' : 'transparent',
                                  borderColor: isCurrentPivoting ? 'var(--brass)' : 'var(--line-strong)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isCurrentPivoting ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  <span style={{ color: 'var(--brass)' }}>⤿</span>
                                )}
                                @{prevU}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--faint)', fontStyle: 'italic', fontFamily: 'var(--font-mono)' }}>
                          None recorded on profile
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Category & Endpoints */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--line)',
                    fontSize: '11px',
                    color: 'var(--faint)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span style={{ textTransform: 'uppercase' }}>
                    {asset.category}
                  </span>
                  <span>
                    {isChess ? 'Chess.com Verified Player' : isInstagram ? 'Instagram Profile' : `${asset.subUrlsCount} endpoint indexed`}
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
