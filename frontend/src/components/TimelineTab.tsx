import React from 'react';
import { ExternalLink } from 'lucide-react';

interface TimelineTabProps {
  timeline: any[];
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ timeline }) => {
  return (
    <div className="panel" style={{ padding: '28px 32px' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--paper)', fontWeight: 600 }}>
        Chronological timeline
      </h3>

      {timeline.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--faint)' }}>
          No events with identified dates yet.
        </div>
      ) : (
        <div style={{ position: 'relative', borderLeft: '1px solid var(--line-strong)', marginLeft: '6px', paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {timeline.map((event, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '-31px',
                  top: '4px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--ink)',
                  border: '2px solid var(--brass)',
                }}
              />

              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--brass)' }}>
                    {event.temporal_date ? event.temporal_date.slice(0, 10) : 'date unverified'}
                  </span>
                  <span className="eyebrow">{event.temporal_precision || 'approximate'}</span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--paper)', margin: '7px 0' }}>
                  {event.summary}
                </div>

                {event.detail && (
                  <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.45 }}>
                    {event.detail}
                  </div>
                )}

                {event.excerpt && (
                  <div style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: '10px', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '10px' }}>
                    {event.excerpt}
                  </div>
                )}

                {event.source_url && (
                  <div style={{ marginTop: '8px' }}>
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--teal)', fontSize: '11px', textDecoration: 'none' }}
                    >
                      <ExternalLink size={11} /> {event.source_url}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
