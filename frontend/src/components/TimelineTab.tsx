import React from 'react';
import { ExternalLink } from 'lucide-react';

interface TimelineTabProps {
  timeline: any[];
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ timeline }) => {
  return (
    <div className="glass-panel" style={{ borderRadius: '12px', padding: '24px 28px' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontFamily: 'var(--font-display)', color: '#f8fafc', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        Chronological Timeline
      </h3>

      {timeline.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#64748b' }}>
          No chronological timeline events with temporal dates identified yet.
        </div>
      ) : (
        <div style={{ position: 'relative', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', marginLeft: '12px', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {timeline.map((event, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: '-29px',
                  top: '6px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf880',
                }}
              />

              <div className="glass-card" style={{ borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {event.temporal_date ? event.temporal_date.slice(0, 10) : 'Date unverified'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize', fontFamily: 'var(--font-mono)' }}>
                    Precision: {event.temporal_precision || 'approximate'}
                  </span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: '6px 0' }}>
                  {event.summary}
                </div>

                {event.detail && (
                  <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
                    {event.detail}
                  </div>
                )}

                {event.excerpt && (
                  <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', marginTop: '10px' }}>
                    "{event.excerpt}"
                  </div>
                )}

                {event.source_url && (
                  <div style={{ marginTop: '8px' }}>
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontSize: '11px', textDecoration: 'none' }}
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
