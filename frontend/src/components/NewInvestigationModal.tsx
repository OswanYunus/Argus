import React, { useState } from 'react';
import { X } from 'lucide-react';

interface NewInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name?: string;
    target_name?: string;
    description: string;
    target_signals: {
      emails: string[];
      usernames: string[];
      domains: string[];
      profile_urls?: string[];
    };
  }) => Promise<void>;
}

export const NewInvestigationModal: React.FC<NewInvestigationModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [targetName, setTargetName] = useState('');
  const [description, setDescription] = useState('');
  const [usernames, setUsernames] = useState('');
  const [profileUrls, setProfileUrls] = useState('');
  const [emails, setEmails] = useState('');
  const [domains, setDomains] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedUsernames = usernames.split(',').map((s) => s.trim().replace(/^@/, '')).filter(Boolean);
    const parsedEmails = emails.split(',').map((s) => s.trim()).filter(Boolean);
    const parsedDomains = domains.split(',').map((s) => s.trim()).filter(Boolean);
    const parsedProfiles = profileUrls.split(',').map((s) => s.trim()).filter(Boolean);
    const cleanTargetName = targetName.trim();

    if (!cleanTargetName && parsedUsernames.length === 0 && parsedEmails.length === 0 && parsedDomains.length === 0 && parsedProfiles.length === 0) {
      setErrorMsg('Enter at least one identifier — a username, handle, or profile URL.');
      return;
    }

    const autoTitle = name.trim() || (
      parsedUsernames.length > 0 ? `Target @${parsedUsernames[0]}` :
      cleanTargetName ? `Investigation: ${cleanTargetName}` :
      parsedEmails.length > 0 ? `Audit: ${parsedEmails[0]}` :
      parsedDomains.length > 0 ? `Domain intel: ${parsedDomains[0]}` :
      `Case #${Date.now().toString().slice(-6)}`
    );

    const autoTargetName = cleanTargetName || (
      parsedUsernames.length > 0 ? `@${parsedUsernames[0]}` :
      parsedEmails.length > 0 ? parsedEmails[0].split('@')[0] :
      'Unknown subject'
    );

    setSubmitting(true);
    try {
      await onCreate({
        name: autoTitle,
        target_name: autoTargetName,
        description,
        target_signals: {
          emails: parsedEmails,
          usernames: parsedUsernames,
          domains: parsedDomains,
          profile_urls: parsedProfiles,
        },
      });
      onClose();
    } catch (err: any) {
      setErrorMsg('Could not create case: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8, 8, 6, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        className="panel fade-in"
        style={{
          width: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '30px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '6px' }}>new intake</div>
            <h3 style={{ margin: 0, fontSize: '19px', fontFamily: 'var(--font-display)', color: 'var(--paper)', fontWeight: 600 }}>
              Open case file
            </h3>
          </div>
          <button onClick={onClose} className="btn-plain" style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}>
            <X size={17} color="var(--muted)" />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              borderLeft: '2px solid var(--clay)',
              background: 'var(--clay-dim)',
              color: 'var(--clay)',
              fontSize: '12px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', ...labelStyle, color: 'var(--paper)', fontWeight: 600 }}>
              <span>Target username / handle</span>
              <span style={{ fontSize: '11px', color: 'var(--brass)', fontWeight: 400 }}>Instagram, TikTok, X, Snapchat</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="oswan_yunus, friend_handle"
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              className="field-input field-mono"
              style={{ borderColor: 'var(--brass)' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Direct profile URL (optional)</label>
            <input
              type="text"
              placeholder="https://instagram.com/oswan_yunus"
              value={profileUrls}
              onChange={(e) => setProfileUrls(e.target.value)}
              className="field-input"
            />
          </div>

          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', ...labelStyle }}>
              <span>Target real name (optional)</span>
              <span style={{ fontSize: '11px', color: 'var(--faint)' }}>discovered automatically</span>
            </label>
            <input
              type="text"
              placeholder="Leave blank if unknown"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="field-input"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Known email (optional)</label>
              <input
                type="text"
                placeholder="name@example.com"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label style={labelStyle}>Domain (optional)</label>
              <input
                type="text"
                placeholder="domain.com"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className="field-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Case title (optional)</label>
              <input
                type="text"
                placeholder="Auto-generated if empty"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input
                type="text"
                placeholder="Authorized footprint audit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--line)', paddingTop: '18px' }}>
            <button type="button" onClick={onClose} className="btn" style={{ padding: '9px 16px', fontSize: '13px' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '9px 20px', fontSize: '13px' }}>
              {submitting ? 'Creating…' : 'Open case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
