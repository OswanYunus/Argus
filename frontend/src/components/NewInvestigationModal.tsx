import React, { useState } from 'react';
import { X, ShieldPlus } from 'lucide-react';

interface NewInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    target_name: string;
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
  const [emails, setEmails] = useState('');
  const [usernames, setUsernames] = useState('');
  const [domains, setDomains] = useState('');
  const [profileUrls, setProfileUrls] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetName) return;

    setSubmitting(true);
    try {
      await onCreate({
        name,
        target_name: targetName,
        description,
        target_signals: {
          emails: emails.split(',').map((s) => s.trim()).filter(Boolean),
          usernames: usernames.split(',').map((s) => s.trim()).filter(Boolean),
          domains: domains.split(',').map((s) => s.trim()).filter(Boolean),
          profile_urls: profileUrls.split(',').map((s) => s.trim()).filter(Boolean),
        },
      });
      onClose();
    } catch (err) {
      alert('Error creating target: ' + err);
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
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #374151',
        borderRadius: '12px',
        width: '520px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldPlus size={20} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>
              New Authorized Investigation
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Investigation Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Self Digital Footprint Audit"
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
              Target Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Scope & Purpose Description
            </label>
            <input
              type="text"
              placeholder="e.g. Authorized self digital-footprint security audit"
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Known Emails (comma-separated)
            </label>
            <input
              type="text"
              placeholder="john@example.com, jdoe@sec.org"
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Known Usernames (comma-separated)
            </label>
            <input
              type="text"
              placeholder="johndoe, jdoe_sec"
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
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
              Associated Domains (comma-separated)
            </label>
            <input
              type="text"
              placeholder="johndoe.me, myblog.dev"
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              Direct Profile / Seed URLs (comma-separated)
            </label>
            <input
              type="text"
              placeholder="https://github.com/oswanyunus, https://gitlab.com/..."
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                color: '#94a3b8',
                padding: '8px 16px',
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
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
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
