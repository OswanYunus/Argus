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
  category: 'social' | 'code' | 'messaging' | 'gaming' | 'audio' | 'education' | 'web';
  handle: string;
  profileUrl: string;
  title?: string;
  snippet?: string;
  status: 'verified' | 'profile_target' | 'indexed' | 'robots_blocked';
  subUrlsCount: number;
  pastUsernames: string[];
  relevance: number;
}

interface CorePlatformDef {
  name: string;
  category: ParsedPlatformAsset['category'];
  urlTemplate: (u: string) => string;
  color: string;
}

const CORE_PLATFORMS: CorePlatformDef[] = [
  { name: 'Instagram', category: 'social', urlTemplate: (u) => `https://www.instagram.com/${u}/`, color: '#E1306C' },
  { name: 'TikTok', category: 'social', urlTemplate: (u) => `https://www.tiktok.com/@${u}`, color: '#00F2FE' },
  { name: 'Pinterest', category: 'social', urlTemplate: (u) => `https://www.pinterest.com/${u}/`, color: '#BD081C' },
  { name: 'Snapchat', category: 'social', urlTemplate: (u) => `https://www.snapchat.com/add/${u}`, color: '#FFFC00' },
  { name: 'GitHub', category: 'code', urlTemplate: (u) => `https://github.com/${u}`, color: '#F0F6FC' },
  { name: 'X (Twitter)', category: 'social', urlTemplate: (u) => `https://x.com/${u}`, color: '#1DA1F2' },
  { name: 'Reddit', category: 'social', urlTemplate: (u) => `https://www.reddit.com/user/${u}`, color: '#FF4500' },
  { name: 'Telegram', category: 'messaging', urlTemplate: (u) => `https://t.me/${u}`, color: '#229ED9' },
  { name: 'LinkedIn', category: 'social', urlTemplate: (u) => `https://www.linkedin.com/in/${u}`, color: '#0A66C2' },
  { name: 'YouTube', category: 'social', urlTemplate: (u) => `https://www.youtube.com/@${u}`, color: '#FF0000' },
  { name: 'Spotify', category: 'audio', urlTemplate: (u) => `https://open.spotify.com/user/${u}`, color: '#1DB954' },
  { name: 'SoundCloud', category: 'audio', urlTemplate: (u) => `https://soundcloud.com/${u}`, color: '#FF5500' },
  { name: 'Linktree', category: 'social', urlTemplate: (u) => `https://linktr.ee/${u}`, color: '#43E660' },
  { name: 'Steam', category: 'gaming', urlTemplate: (u) => `https://steamcommunity.com/id/${u}`, color: '#66C0F4' },
  { name: 'Chess.com', category: 'gaming', urlTemplate: (u) => `https://www.chess.com/member/${u}`, color: '#81B64C' },
  { name: 'Duolingo', category: 'education', urlTemplate: (u) => `https://www.duolingo.com/profile/${u}`, color: '#58CC02' },
];

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
  const [selectedHandleFilter, setSelectedHandleFilter] = useState<string>('all');
  const [pivotingHandle, setPivotingHandle] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Gather all tracked usernames for the subject
  const getTrackedUsernames = (): string[] => {
    const handleSet = new Set<string>();

    // From investigation target_signals
    if (investigation?.target_signals?.usernames) {
      for (const u of investigation.target_signals.usernames) {
        const clean = u.trim().replace(/^@/, '').toLowerCase();
        if (clean) handleSet.add(clean);
      }
    }

    // From target name if handle-like
    if (investigation?.target_name) {
      const tn = investigation.target_name.trim().replace(/^@/, '').toLowerCase();
      if (tn && !tn.includes(' ') && tn.length > 2) {
        handleSet.add(tn);
      }
    }

    // From resolved identities and aliases
    for (const ident of identities) {
      if (ident.identity_type === 'username' || ident.canonical_value) {
        const clean = ident.canonical_value.trim().replace(/^@/, '').toLowerCase();
        if (clean && !clean.includes(' ') && !clean.includes('/')) {
          handleSet.add(clean);
        }
      }
    }

    // From discovered URLs handles
    for (const u of urls) {
      const match = u.url.match(/(?:instagram\.com|github\.com|tiktok\.com\/@?|pinterest\.com|snapchat\.com\/add|x\.com|twitter\.com|t\.me|reddit\.com\/user)\/([a-zA-Z0-9_.-]+)/i);
      if (match && match[1]) {
        const clean = match[1].replace(/\/$/, '').toLowerCase();
        if (clean && clean.length > 1 && clean !== 'add' && clean !== 'p' && clean !== 'user') {
          handleSet.add(clean);
        }
      }
    }

    return Array.from(handleSet);
  };

  const trackedUsernames = getTrackedUsernames();

  // Helper to compute possible alias variations and past usernames
  const getPastUsernamesForHandle = (currentHandle: string): string[] => {
    const past = new Set<string>();
    const cleanCurrent = currentHandle.toLowerCase();

    // Any other tracked username in the investigation is an associated alias
    for (const u of trackedUsernames) {
      if (u.toLowerCase() !== cleanCurrent) {
        past.add(u);
      }
    }

    // Common OSINT permutations (e.g. oswan_yunus <-> oswanyunus, oswan-yunus)
    const noDelims = cleanCurrent.replace(/[-_.]/g, '');
    if (noDelims && noDelims !== cleanCurrent) {
      past.add(noDelims);
    }
    if (cleanCurrent.includes('_')) {
      past.add(cleanCurrent.replace(/_/g, '-'));
      past.add(cleanCurrent.replace(/_/g, '.'));
    } else if (cleanCurrent.includes('-')) {
      past.add(cleanCurrent.replace(/-/g, '_'));
    }

    // Signals
    for (const s of signals) {
      if (s.signal_type === 'bio_reference' || s.signal_type === 'username_match') {
        const cleanVal = s.signal_value.toLowerCase().replace(/^@/, '');
        if (cleanVal && cleanVal !== cleanCurrent) {
          past.add(cleanVal);
        }
      }
    }

    return Array.from(past).slice(0, 4);
  };

  // 2. Synthesize & Deduplicate Cards
  const parseAssets = (): ParsedPlatformAsset[] => {
    // Key: `${platform.toLowerCase()}:${handle.toLowerCase()}`
    const cardMap = new Map<string, ParsedPlatformAsset>();

    // Step A: For EVERY tracked username, ensure the core platforms exist
    const baseHandles = trackedUsernames.length > 0 ? trackedUsernames : ['target'];

    for (const handle of baseHandles) {
      const pastUsernames = getPastUsernamesForHandle(handle);

      for (const p of CORE_PLATFORMS) {
        const key = `${p.name.toLowerCase()}:${handle.toLowerCase()}`;
        cardMap.set(key, {
          id: `seed_${p.name}_${handle}`,
          platform: p.name,
          category: p.category,
          handle: `@${handle}`,
          profileUrl: p.urlTemplate(handle),
          title: `${p.name} Profile`,
          snippet: `Direct profile target for @${handle} on ${p.name}.`,
          status: 'profile_target',
          subUrlsCount: 0,
          pastUsernames,
          relevance: 0.88,
        });
      }
    }

    // Step B: Enrich or add from discovered URLs (merging duplicate URLs into the card!)
    for (const u of urls) {
      const urlLower = u.url.toLowerCase();
      let matchedPlatform = '';
      let matchedCategory: ParsedPlatformAsset['category'] = 'web';
      let extractedHandle = '';

      if (urlLower.includes('instagram.com')) {
        matchedPlatform = 'Instagram'; matchedCategory = 'social';
        const m = u.url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('github.com')) {
        matchedPlatform = 'GitHub'; matchedCategory = 'code';
        const m = u.url.match(/github\.com\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('tiktok.com')) {
        matchedPlatform = 'TikTok'; matchedCategory = 'social';
        const m = u.url.match(/tiktok\.com\/@?([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('pinterest.com')) {
        matchedPlatform = 'Pinterest'; matchedCategory = 'social';
        const m = u.url.match(/pinterest\.com\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('snapchat.com')) {
        matchedPlatform = 'Snapchat'; matchedCategory = 'social';
        const m = u.url.match(/snapchat\.com\/add\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) {
        matchedPlatform = 'X (Twitter)'; matchedCategory = 'social';
        const m = u.url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('reddit.com')) {
        matchedPlatform = 'Reddit'; matchedCategory = 'social';
        const m = u.url.match(/reddit\.com\/user\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('t.me/')) {
        matchedPlatform = 'Telegram'; matchedCategory = 'messaging';
        const m = u.url.match(/t\.me\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linkedin.com')) {
        matchedPlatform = 'LinkedIn'; matchedCategory = 'social';
        const m = u.url.match(/linkedin\.com\/in\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('youtube.com')) {
        matchedPlatform = 'YouTube'; matchedCategory = 'social';
        const m = u.url.match(/youtube\.com\/@?([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('spotify.com')) {
        matchedPlatform = 'Spotify'; matchedCategory = 'audio';
        const m = u.url.match(/open\.spotify\.com\/user\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('soundcloud.com')) {
        matchedPlatform = 'SoundCloud'; matchedCategory = 'audio';
        const m = u.url.match(/soundcloud\.com\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('linktr.ee')) {
        matchedPlatform = 'Linktree'; matchedCategory = 'social';
        const m = u.url.match(/linktr\.ee\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('steamcommunity.com')) {
        matchedPlatform = 'Steam'; matchedCategory = 'gaming';
        const m = u.url.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('chess.com')) {
        matchedPlatform = 'Chess.com'; matchedCategory = 'gaming';
        const m = u.url.match(/chess\.com\/member\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else if (urlLower.includes('duolingo.com')) {
        matchedPlatform = 'Duolingo'; matchedCategory = 'education';
        const m = u.url.match(/duolingo\.com\/profile\/([a-zA-Z0-9_.-]+)/i); extractedHandle = m ? m[1].replace(/\/$/, '') : '';
      } else {
        // Generic Web Asset
        try {
          const parsed = new URL(u.url);
          matchedPlatform = parsed.hostname.replace(/^www\./, '');
          matchedCategory = 'web';
        } catch {
          matchedPlatform = 'Web Asset';
        }
      }

      const cleanHandle = extractedHandle || (trackedUsernames[0] || 'target');
      const lookupKey = `${matchedPlatform.toLowerCase()}:${cleanHandle.toLowerCase()}`;

      if (cardMap.has(lookupKey)) {
        // ENRICH EXISTING CARD - NO DUPLICATE CARD SPAWNED!
        const existing = cardMap.get(lookupKey)!;
        existing.subUrlsCount += 1;
        if (u.status === 'collected' || u.status === 'filtered') {
          existing.status = 'verified';
        }
        if (u.snippet && (!existing.snippet || existing.snippet.startsWith('Direct profile target'))) {
          existing.snippet = u.snippet;
        }
        if (u.title && !existing.title?.includes('@')) {
          existing.title = u.title;
        }
        existing.relevance = Math.max(existing.relevance, u.relevance_score || 0.85);
      } else if (matchedCategory === 'web') {
        // Discovered independent web asset
        cardMap.set(lookupKey, {
          id: u.id,
          platform: matchedPlatform,
          category: 'web',
          handle: cleanHandle ? `@${cleanHandle}` : '',
          profileUrl: u.url,
          title: u.title || `${matchedPlatform} Asset`,
          snippet: u.snippet || '',
          status: u.status === 'collected' ? 'verified' : 'indexed',
          subUrlsCount: 1,
          pastUsernames: getPastUsernamesForHandle(cleanHandle),
          relevance: u.relevance_score || 0.8,
        });
      }
    }

    return Array.from(cardMap.values());
  };

  const allAssets = parseAssets();

  // 3. Filter assets by category, search query, and handle
  const filteredAssets = allAssets.filter((a) => {
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    const cleanCardHandle = a.handle.replace(/^@/, '').toLowerCase();
    const matchesHandle =
      selectedHandleFilter === 'all' ||
      cleanCardHandle === selectedHandleFilter.toLowerCase();

    const matchesQuery =
      !filterQuery ||
      a.platform.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.handle.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (a.title && a.title.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (a.snippet && a.snippet.toLowerCase().includes(filterQuery.toLowerCase()));

    return matchesCategory && matchesHandle && matchesQuery;
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
      {/* Controls Bar: Search, Category Filters, and Tracked Handle Switcher */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
            <input
              type="text"
              placeholder="Filter platform, handle, or bio…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="field-input"
              style={{ paddingLeft: '32px', width: '100%' }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All Platforms (${allAssets.length})` },
              { id: 'social', label: 'Social & Media' },
              { id: 'code', label: 'Developer Hubs' },
              { id: 'gaming', label: 'Gaming' },
              { id: 'audio', label: 'Music & Audio' },
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

        {/* Handle Switcher (if multiple handles exist due to alias pivots) */}
        {trackedUsernames.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Subject Handles:
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedHandleFilter('all')}
                className="btn"
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  background: selectedHandleFilter === 'all' ? 'var(--teal-dim)' : 'transparent',
                  borderColor: selectedHandleFilter === 'all' ? 'var(--teal)' : 'var(--line)',
                  color: selectedHandleFilter === 'all' ? 'var(--teal)' : 'var(--muted)',
                }}
              >
                All Handles ({allAssets.length})
              </button>
              {trackedUsernames.map((u) => {
                const active = selectedHandleFilter.toLowerCase() === u.toLowerCase();
                return (
                  <button
                    key={u}
                    onClick={() => setSelectedHandleFilter(u)}
                    className="btn"
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      background: active ? 'var(--teal-dim)' : 'transparent',
                      borderColor: active ? 'var(--teal)' : 'var(--line)',
                      color: active ? 'var(--teal)' : 'var(--paper)',
                    }}
                  >
                    @{u}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cards Grid: Summarized, Clean, osintsearch-style */}
      {filteredAssets.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--faint)' }}>
          <Layers size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--paper)', fontWeight: 600 }}>
            No platform cards matching your filter
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Try clearing your search query or selecting "All Platforms".
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredAssets.map((asset) => {
            return (
              <div
                key={asset.id}
                className="card"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line)',
                  position: 'relative',
                }}
              >
                {/* Card Header: Platform name, handle, status badge */}
                <div>
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

                    {/* Status Badge */}
                    <div>
                      {asset.status === 'verified' ? (
                        <span className="stamp stamp-teal" style={{ fontSize: '10px' }}>
                          VERIFIED
                        </span>
                      ) : (
                        <span className="stamp stamp-brass" style={{ fontSize: '10px' }}>
                          DIRECT TARGET
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Profile Link with quick actions */}
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
                        title="Copy profile link"
                        className="btn-plain"
                        style={{ cursor: 'pointer', padding: '2px' }}
                      >
                        {copiedId === asset.id ? <Check size={12} color="var(--teal)" /> : <Copy size={12} />}
                      </button>
                      <a
                        href={asset.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open profile in new tab"
                        className="btn-plain"
                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Bio / Snippet (Concise) */}
                  {asset.snippet && !asset.snippet.startsWith('Direct profile target') && (
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

                  {/* PAST USERNAMES / ALIASES ROW (The core osintsearch.org recursive pivot feature) */}
                  {asset.pastUsernames.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Share2 size={11} color="var(--brass)" />
                        Past / Associated Usernames:
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {asset.pastUsernames.map((prevU) => {
                          const isCurrentPivoting = pivotingHandle === prevU;
                          return (
                            <button
                              key={prevU}
                              onClick={() => handleExecutePivot(prevU)}
                              disabled={isPivoting}
                              title={`Click to search across all platforms for past username @${prevU}`}
                              className="btn"
                              style={{
                                padding: '3px 8px',
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
                    </div>
                  )}
                </div>

                {/* Card Footer: Category & Match confidence */}
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
                    {asset.subUrlsCount > 1 ? `${asset.subUrlsCount} endpoints indexed` : `${Math.round(asset.relevance * 100)}% match`}
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
