import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

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
      setErrorMsg('Please enter at least one identifier (e.g. an Instagram username, handle, or profile URL).');
      return;
    }

    const autoTitle = name.trim() || (
      parsedUsernames.length > 0 ? `Target @${parsedUsernames[0]}` :
      cleanTargetName ? `Investigation: ${cleanTargetName}` :
      parsedEmails.length > 0 ? `Audit: ${parsedEmails[0]}` :
      parsedDomains.length > 0 ? `Domain Intel: ${parsedDomains[0]}` :
      `Case #${Date.now().toString().slice(-6)}`
    );

    const autoTargetName = cleanTargetName || (
      parsedUsernames.length > 0 ? `@${parsedUsernames[0]}` :
      parsedEmails.length > 0 ? parsedEmails[0].split('@')[0] :
      'Unknown Subject'
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
      setErrorMsg('Error creating investigation: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel animate-card-in"
        style={{
          borderRadius: '16px',
          width: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontFamily: 'var(--font-display)',
                color: '#f8fafc',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              New Investigation Target
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Initialize with any single known identifier.
            </p>
          </div>
          <button
            onClick={onClose}
            className="glass-btn"
            style={{
              padding: '6px',
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              fontSize: '12px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* USERNAME */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#f8fafc', fontWeight: 600, marginBottom: '6px' }}>
              <span>Target Username / Social Handle</span>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 400 }}>Instagram, TikTok, X, Snapchat</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. oswan_yunus, friend_handle"
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              className="glass-btn"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                padding: '9px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {/* PROFILE URLS */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Direct Profile URL (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. https://instagram.com/oswan_yunus"
              value={profileUrls}
              onChange={(e) => setProfileUrls(e.target.value)}
              className="glass-btn"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* REAL NAME */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              <span>Target Real Name (Optional)</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Discovered automatically</span>
            </label>
            <input
              type="text"
              placeholder="Leave blank if unknown"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="glass-btn"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* EMAILS & DOMAINS (SPLIT) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Known Email (Optional)
              </label>
              <input
                type="text"
                placeholder="name@example.com"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                className="glass-btn"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Domain (Optional)
              </label>
              <input
                type="text"
                placeholder="domain.com"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className="glass-btn"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* TITLE & DESCRIPTION */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                <Sparkles size={11} color="#38bdf8" /> Case Title (Optional)
              </label>
              <input
                type="text"
                placeholder="Auto-generated if empty"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-btn"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                Investigation Notes
              </label>
              <input
                type="text"
                placeholder="Authorized footprint audit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="glass-btn"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            <button
              type="button"
              onClick={onClose}
              className="glass-btn"
              style={{
                padding: '9px 16px',
                fontSize: '13px',
                color: '#94a3b8',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="glass-btn glass-btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating...' : 'Initialize Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
