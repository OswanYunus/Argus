import React, { useState } from 'react';
import { X, ShieldPlus, Sparkles } from 'lucide-react';

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

    // Verify at least one starting signal exists
    if (!cleanTargetName && parsedUsernames.length === 0 && parsedEmails.length === 0 && parsedDomains.length === 0 && parsedProfiles.length === 0) {
      setErrorMsg('Please provide at least one starting point (e.g. an Instagram/TikTok username, profile URL, or name).');
      return;
    }

    // Auto-generate title if omitted
    const autoTitle = name.trim() || (
      parsedUsernames.length > 0 ? `Footprint @${parsedUsernames[0]}` :
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #374151',
        borderRadius: '12px',
        width: '540px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldPlus size={20} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>
              New Target Investigation
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
          Start an investigation with any single identifier you have. If you only have an Instagram or TikTok username, enter it below. Real names and aliases will be discovered and resolved during the investigation.
        </p>

        {errorMsg && (
          <div style={{
            marginBottom: '14px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: '#450a0a',
            color: '#fca5a5',
            fontSize: '12px',
            border: '1px solid #7f1d1d',
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* PRIMARY ENTRY POINT: USERNAME */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#f8fafc', fontWeight: 600, marginBottom: '4px' }}>
              <span>Target Username(s) / Social Handles</span>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 400 }}>Instagram, TikTok, X, Snapchat, etc.</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. oswan_yunus, friend_handle"
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                padding: '9px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
              Comma-separate multiple handles or variations if known.
            </span>
          </div>

          {/* DIRECT PROFILE URLS */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Direct Profile / Seed URLs (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. https://instagram.com/oswan_yunus, https://github.com/oswanyunus"
              value={profileUrls}
              onChange={(e) => setProfileUrls(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* TARGET FULL NAME (OPTIONAL) */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              <span>Target Real Name (Optional)</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Leave blank if unknown</span>
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe (optional — discovered during scan)"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* KNOWN EMAILS */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Known Email(s) (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. john@example.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* DOMAINS */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Associated Domain(s) (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. johndoe.me, portfolio.dev"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* TITLE & DESCRIPTION */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <Sparkles size={11} color="#38bdf8" /> Case Title (Optional)
              </label>
              <input
                type="text"
                placeholder="Auto-generated if empty"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Case Notes / Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. Authorized security audit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                color: '#94a3b8',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submitting ? 'Creating...' : 'Initialize Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
