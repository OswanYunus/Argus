import React from 'react';
import { Calendar, ExternalLink } from 'lucide-react';

interface TimelineTabProps {
  timeline: any[];
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ timeline }) => {
  return (
    <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={18} color="#3b82f6" /> Target Footprint Chronological Timeline
      </h3>

      {timeline.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
          No chronological timeline events with temporal dates identified yet.
        </div>
      ) : (
        <div style={{ position: 'relative', borderLeft: '2px solid #1e293b', marginLeft: '16px', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {timeline.map((event, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: '-31px',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  border: '2px solid #0b0f17',
                }}
              />

              <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono', color: '#38bdf8', fontWeight: 600 }}>
                    {event.temporal_date ? event.temporal_date.slice(0, 10) : 'Date unverified'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
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
                  <div style={{ backgroundColor: '#1e293b', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', marginTop: '10px' }}>
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
