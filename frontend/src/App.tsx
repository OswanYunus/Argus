import React, { useEffect, useState } from 'react';
import {
  Activity,
  Calendar,
  Database,
  FileText,
  Network,
  Shield,
  UserCheck,
} from 'lucide-react';

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
} from './services/api';

import { Navbar } from './components/Navbar';
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

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [urls, setUrls] = useState<DiscoveredUrl[]>([]);
  const [graphElements, setGraphElements] = useState<CytoscapeElement[]>([]);
  const [resources, setResources] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Load list on startup
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
      console.error(err);
    }
  };

  // Load active investigation data when selectedId changes
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
      console.error(err);
    }
  };

  const handleRun = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await triggerRun(selectedId);
      await loadInvestigationData(selectedId);
    } catch (err) {
      alert('Error running investigation: ' + err);
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
    if (!selectedId || !confirm('Permanently purge this target and cryptographically wipe all data?')) return;
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'identities', label: 'Identities & Aliases', icon: UserCheck },
    { id: 'evidence', label: 'Evidence Repository', icon: FileText },
    { id: 'graph', label: 'Relationship Graph', icon: Network },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'sources', label: 'Source Explorer', icon: Database },
    { id: 'resources', label: 'Resource Consumption', icon: Activity },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

      {/* Subnav Tabs */}
      {currentInv && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 24px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1f2937'
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 14px',
                  backgroundColor: 'transparent',
                  color: active ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  borderBottom: `2px solid ${active ? '#38bdf8' : 'transparent'}`,
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {!currentInv ? (
          <div style={{
            textAlign: 'center',
            padding: '100px 20px',
            backgroundColor: '#111827',
            borderRadius: '12px',
            border: '1px solid #1f2937'
          }}>
            <Shield size={48} color="#3b82f6" style={{ margin: '0 auto 16px auto', display: 'block' }} />
            <h3 style={{ fontSize: '20px', color: '#f8fafc', margin: '0 0 8px 0' }}>
              Welcome to ARGUS OSINT Intelligence Engine
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
              Multi-stage digital-footprint intelligence platform. Select an existing target or initialize a new authorized footprint investigation.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Initialize Target Investigation
            </button>
          </div>
        ) : (
          <>
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
          </>
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
