import React, { useEffect, useState } from 'react';
import {
  CytoscapeElement,
  DiscoveredUrl,
  Finding,
  Identity,
  Investigation,
  InvestigationSummary,
} from './types';
import {
  createInvestigation,
  fetchFindings,
  fetchGraph,
  fetchIdentities,
  fetchInvestigation,
  fetchInvestigations,
  fetchResources,
  fetchTimeline,
  fetchUrls,
  purgeInvestigation,
  triggerRescan,
  triggerRun,
  pivotAlias,
} from './services/api';

import { Navbar } from './components/Navbar';
import { IntelligenceCards } from './components/IntelligenceCards';
import { OverviewTab } from './components/OverviewTab';
import { IdentitiesTab } from './components/IdentitiesTab';
import { EvidenceTab } from './components/EvidenceTab';
import { GraphTab } from './components/GraphTab';
import { TimelineTab } from './components/TimelineTab';
import { SourcesTab } from './components/SourcesTab';
import { ResourcesTab } from './components/ResourcesTab';
import { NewInvestigationModal } from './components/NewInvestigationModal';

export const App: React.FC = () => {
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentInv, setCurrentInv] = useState<Investigation | null>(null);

  const [activeTab, setActiveTab] = useState<string>('cards');
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [urls, setUrls] = useState<DiscoveredUrl[]>([]);
  const [graphElements, setGraphElements] = useState<CytoscapeElement[]>([]);
  const [resources, setResources] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState<boolean>(false);
  const [isPivoting, setIsPivoting] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    loadInvestigations();
  }, []);

  const loadInvestigations = async () => {
    try {
      const list = await fetchInvestigations();
      setInvestigations(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load investigations:', err);
    }
  };

  useEffect(() => {
    if (selectedId) {
      loadInvestigationData(selectedId);
    }
  }, [selectedId]);

  const loadInvestigationData = async (id: string) => {
    try {
      const [inv, idents, finds, times, urlList, graph, res] = await Promise.all([
        fetchInvestigation(id),
        fetchIdentities(id),
        fetchFindings(id),
        fetchTimeline(id),
        fetchUrls(id),
        fetchGraph(id),
        fetchResources(id),
      ]);
      setCurrentInv(inv);
      setIdentities(idents);
      setFindings(finds);
      setTimeline(times);
      setUrls(urlList);
      setGraphElements(graph);
      setResources(res);
    } catch (err) {
      console.error('Failed to load investigation data:', err);
    }
  };

  const handleRun = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await triggerRun(selectedId);
      await loadInvestigationData(selectedId);
    } catch (err) {
      alert('Error running investigation scan: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await triggerRescan(selectedId);
      alert(
        `Rescan Completed!\nUnchanged sources: ${res.rescan_stats.unchanged_sources}\nChanged sources: ${res.rescan_stats.changed_sources}\nNewly discovered sources: ${res.rescan_stats.new_sources_discovered}`
      );
      await loadInvestigationData(selectedId);
    } catch (err) {
      alert('Error during rescan: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!selectedId || !confirm('Permanently purge this target and cryptographically wipe all records?')) return;
    setLoading(true);
    try {
      await purgeInvestigation(selectedId);
      setSelectedId(null);
      setCurrentInv(null);
      await loadInvestigations();
    } catch (err) {
      alert('Error purging investigation: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    const created = await createInvestigation(data);
    await loadInvestigations();
    setSelectedId(created.id);
  };

  const handlePivot = async (username: string) => {
    if (!selectedId) return;
    setIsPivoting(true);
    try {
      await pivotAlias(selectedId, username, `Card Pivot on past username @${username}`);
      await loadInvestigationData(selectedId);
    } catch (err) {
      alert('Failed to pivot username: ' + err);
    } finally {
      setIsPivoting(false);
    }
  };

  const navItems = [
    { id: 'cards', label: 'Platform Cards', count: urls.length },
    { id: 'overview', label: 'Overview' },
    { id: 'identities', label: 'Identities & Aliases', count: identities.length },
    { id: 'evidence', label: 'Findings', count: findings.length },
    { id: 'graph', label: 'Entity Graph' },
    { id: 'timeline', label: 'Timeline', count: timeline.length },
    { id: 'sources', label: 'Raw Sources' },
    { id: 'resources', label: 'Engine Telemetry' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <Navbar
        investigations={investigations}
        selectedId={selectedId}
        currentInvestigation={currentInv}
        onSelect={(id) => setSelectedId(id)}
        onOpenNew={() => setModalOpen(true)}
        onRun={handleRun}
        onRescan={handleRescan}
        onPurge={handlePurge}
        loading={loading}
      />

      {/* Sleek Frosted Sub-Navigation */}
      {currentInv && (
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 24px',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            overflowX: 'auto',
          }}
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
                  color: active ? '#f8fafc' : '#94a3b8',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  borderRadius: '4px 4px 0 0',
                }}
              >
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      background: active ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: active ? '#38bdf8' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main View Area */}
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {!currentInv ? (
          <div
            className="glass-panel animate-card-in"
            style={{
              textAlign: 'center',
              padding: '100px 32px',
              borderRadius: '16px',
              maxWidth: '680px',
              margin: '60px auto',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#38bdf8',
                marginBottom: '12px',
              }}
            >
              System Ready
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#f8fafc',
                margin: '0 0 12px 0',
              }}
            >
              Digital Footprint Intelligence
            </h2>
            <p
              style={{
                color: '#94a3b8',
                fontSize: '14px',
                lineHeight: 1.6,
                margin: '0 auto 28px auto',
                maxWidth: '480px',
              }}
            >
              Deterministic 23-platform reconnaissance, alias pivoting, and cryptographic evidence graphs.
              Provide an Instagram, TikTok, or web identifier to begin.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="glass-btn glass-btn-primary"
              style={{
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              Launch Target Investigation
            </button>
          </div>
        ) : (
          <div className="animate-card-in">
            {activeTab === 'cards' && (
              <IntelligenceCards
                urls={urls}
                onPivot={handlePivot}
                isPivoting={isPivoting}
              />
            )}
            {activeTab === 'overview' && (
              <OverviewTab
                investigation={currentInv}
                identities={identities}
                findings={findings}
                urls={urls}
                resources={resources}
              />
            )}
            {activeTab === 'identities' && (
              <IdentitiesTab
                investigationId={currentInv.id}
                identities={identities}
                onRefresh={() => loadInvestigationData(currentInv.id)}
              />
            )}
            {activeTab === 'evidence' && <EvidenceTab findings={findings} />}
            {activeTab === 'graph' && <GraphTab elements={graphElements} />}
            {activeTab === 'timeline' && <TimelineTab timeline={timeline} />}
            {activeTab === 'sources' && <SourcesTab urls={urls} />}
            {activeTab === 'resources' && <ResourcesTab resources={resources} />}
          </div>
        )}
      </main>

      <NewInvestigationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
};
