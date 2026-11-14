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
        `Rescan complete.\nUnchanged sources: ${res.rescan_stats.unchanged_sources}\nChanged sources: ${res.rescan_stats.changed_sources}\nNewly discovered sources: ${res.rescan_stats.new_sources_discovered}`
      );
      await loadInvestigationData(selectedId);
    } catch (err) {
      alert('Error during rescan: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!selectedId || !confirm('Permanently purge this case file and wipe all records? This cannot be undone.')) return;
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
      await pivotAlias(selectedId, username, `Card pivot on past username @${username}`);
      await loadInvestigationData(selectedId);
    } catch (err) {
      alert('Failed to pivot username: ' + err);
    } finally {
      setIsPivoting(false);
    }
  };

  const navItems = [
    { id: 'cards', label: 'Platform Cards', desc: 'Social & developer profile cards' },
    { id: 'identities', label: 'Identities & Aliases', count: identities.length, desc: 'Subject identities & linked handles' },
    { id: 'evidence', label: 'Verified Findings', count: findings.length, desc: 'Extracted facts & citations' },
    { id: 'graph', label: 'Relationship Graph', desc: 'Interactive entity link map' },
    { id: 'timeline', label: 'Timeline', count: timeline.length, desc: 'Chronological footprint events' },
    { id: 'sources', label: 'All Discovered URLs', count: urls.length, desc: 'Raw web index' },
    { id: 'overview', label: 'Case Brief', desc: 'Target briefing & seeds' },
    { id: 'resources', label: 'Telemetry', desc: 'HTTP & token quotas' },
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

      {currentInv && (
        <nav className="tab-strip">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`tab${active ? ' active' : ''}`}
              >
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="tab-count">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      <main style={{ flex: 1, padding: '0', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {!currentInv ? (
          <div
            style={{
              textAlign: 'left',
              padding: '72px 40px',
              maxWidth: '620px',
              margin: '48px auto',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: '18px' }}>
              No case file open
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '40px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--paper)',
                margin: '0 0 16px 0',
                lineHeight: 1.1,
              }}
            >
              Open a new case to begin tracing a footprint.
            </h1>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: '15px',
                lineHeight: 1.65,
                margin: '0 0 32px 0',
                maxWidth: '480px',
              }}
            >
              ARGUS runs deterministic reconnaissance across 23 platforms, pivots on
              discovered aliases, and keeps every finding tied back to the source it
              came from. Start with one username, email, or profile link.
            </p>
            <button onClick={() => setModalOpen(true)} className="btn btn-primary" style={{ padding: '11px 24px', fontSize: '14px' }}>
              Open new case
            </button>
          </div>
        ) : (
          <div className="fade-in" style={{ padding: '28px 32px' }}>
            {activeTab === 'cards' && (
              <IntelligenceCards
                investigation={currentInv}
                identities={identities}
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
