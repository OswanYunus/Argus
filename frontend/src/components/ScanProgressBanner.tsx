import React from 'react';
import { Loader2, CheckCircle2, Clock, Globe, Shield, Search, Database } from 'lucide-react';

interface ScanProgressBannerProps {
  active: boolean;
  type: 'scan' | 'rescan' | null;
  elapsedSeconds: number;
  targetName?: string;
  lastCompletedStats?: {
    duration: number;
    sourcesCount: number;
  } | null;
  onDismissCompleted?: () => void;
}

export const ScanProgressBanner: React.FC<ScanProgressBannerProps> = ({
  active,
  type,
  elapsedSeconds,
  targetName = 'Target',
  lastCompletedStats,
  onDismissCompleted,
}) => {
  if (!active && !lastCompletedStats) {
    return null;
  }

  // Format seconds into MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Estimated total time ~45 seconds
  const estimatedTotal = 45;
  const progressPercent = active
    ? Math.min(95, Math.max(5, Math.floor((elapsedSeconds / estimatedTotal) * 100)))
    : 100;

  // Stages breakdown based on elapsed time
  const stages = [
    {
      id: 1,
      name: 'Direct Probes',
      desc: 'API probes (Chess.com, GitHub, etc.)',
      icon: Database,
      done: elapsedSeconds > 8,
      active: elapsedSeconds <= 8,
    },
    {
      id: 2,
      name: 'Web Discovery',
      desc: 'DuckDuckGo social dorks & footprint',
      icon: Search,
      done: elapsedSeconds > 22,
      active: elapsedSeconds > 8 && elapsedSeconds <= 22,
    },
    {
      id: 3,
      name: 'Collection & Robots',
      desc: 'Robots.txt compliance & page fetch',
      icon: Globe,
      done: elapsedSeconds > 35,
      active: elapsedSeconds > 22 && elapsedSeconds <= 35,
    },
    {
      id: 4,
      name: 'Signal Filtering',
      desc: 'URL/snippet scoring & deduplication',
      icon: Shield,
      done: !active && !!lastCompletedStats,
      active: elapsedSeconds > 35,
    },
  ];

  if (!active && lastCompletedStats) {
    return (
      <div
        className="panel fade-in"
        style={{
          margin: '16px 32px 0 32px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(94, 148, 133, 0.08)',
          borderColor: 'var(--teal)',
          borderRadius: '3px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} color="var(--teal)" />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--paper)' }}>
              Scan Completed in {lastCompletedStats.duration}s
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              Verified profiles, discovered sources, and entity signals updated across all tabs.
            </div>
          </div>
        </div>
        {onDismissCompleted && (
          <button
            onClick={onDismissCompleted}
            className="btn btn-plain"
            style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="panel fade-in"
      style={{
        margin: '16px 32px 0 32px',
        padding: '18px 22px',
        backgroundColor: 'var(--surface-raised)',
        borderColor: 'var(--brass)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
        borderRadius: '3px',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--brass-dim)',
              border: '1.5px solid var(--brass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Loader2 size={20} color="var(--brass)" className="animate-spin" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-dot" />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--paper)',
                }}
              >
                {type === 'rescan' ? 'Rescanning Footprint' : 'Active Footprint Scan'} — {targetName}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              Executing multi-stage OSINT pipeline: search dorks, platform verification, and signal extraction.
            </div>
          </div>
        </div>

        {/* Live Timer Counter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              padding: '6px 12px',
              borderRadius: '2px',
              border: '1px solid var(--line)',
            }}
          >
            <Clock size={13} color="var(--brass)" />
            <span style={{ fontSize: '13px', color: 'var(--paper)', fontWeight: 600 }}>
              {formatTime(elapsedSeconds)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--faint)' }}>elapsed</span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--faint)' }}>
            Est. ~{estimatedTotal}s total
          </div>
        </div>
      </div>

      {/* Progress Bar with Shimmer */}
      <div
        style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <div
          className="progress-shimmer"
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: 'var(--brass)',
            transition: 'width 0.4s ease',
            borderRadius: '3px',
          }}
        />
      </div>

      {/* Stage Indicators */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
        }}
      >
        {stages.map((st) => {
          const Icon = st.icon;
          const isCurrent = st.active;
          const isDone = st.done;

          return (
            <div
              key={st.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: isCurrent
                  ? 'rgba(201, 162, 39, 0.1)'
                  : isDone
                  ? 'rgba(94, 148, 133, 0.08)'
                  : 'rgba(0, 0, 0, 0.2)',
                border: '1px solid',
                borderColor: isCurrent
                  ? 'var(--brass)'
                  : isDone
                  ? 'var(--teal)'
                  : 'var(--line)',
                borderRadius: '2px',
                transition: 'all 0.25s ease',
              }}
            >
              {isDone ? (
                <CheckCircle2 size={14} color="var(--teal)" />
              ) : isCurrent ? (
                <Loader2 size={14} color="var(--brass)" className="animate-spin" />
              ) : (
                <Icon size={14} color="var(--faint)" />
              )}

              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: isCurrent ? 600 : 500,
                    color: isCurrent
                      ? 'var(--brass)'
                      : isDone
                      ? 'var(--paper)'
                      : 'var(--muted)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {st.name}
                </div>
                <div
                  style={{
                    fontSize: '10.5px',
                    color: 'var(--faint)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {isCurrent ? 'Running…' : isDone ? 'Verified' : 'Queued'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
