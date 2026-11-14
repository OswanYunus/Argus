import {
  DiscoveredUrl,
  Finding,
  Identity,
  IdentitySignal,
  Investigation,
  InvestigationSummary,
  CytoscapeElement,
} from '../types';

const BASE_URL = '/api/v1';

export async function fetchInvestigations(): Promise<InvestigationSummary[]> {
  const res = await fetch(`${BASE_URL}/investigations`);
  if (!res.ok) throw new Error('Failed to load investigations');
  return res.json();
}

export async function fetchInvestigation(id: string): Promise<Investigation> {
  const res = await fetch(`${BASE_URL}/investigations/${id}`);
  if (!res.ok) throw new Error('Failed to load investigation details');
  return res.json();
}

export async function createInvestigation(data: {
  name: string;
  target_name: string;
  description?: string;
  target_signals: Record<string, any>;
}): Promise<Investigation> {
  const res = await fetch(`${BASE_URL}/investigations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create investigation');
  return res.json();
}

export async function triggerRun(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run investigation pipeline');
  return res.json();
}

export async function triggerRescan(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/rescan`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run incremental rescan');
  return res.json();
}

export async function purgeInvestigation(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/investigations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to purge investigation');
}

export async function fetchIdentities(id: string): Promise<Identity[]> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/identities`);
  if (!res.ok) throw new Error('Failed to fetch identities');
  return res.json();
}

export async function fetchIdentitySignals(invId: string, identityId: string): Promise<IdentitySignal[]> {
  const res = await fetch(`${BASE_URL}/investigations/${invId}/identities/${identityId}/signals`);
  if (!res.ok) throw new Error('Failed to fetch signals');
  return res.json();
}

export async function fetchFindings(id: string): Promise<Finding[]> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/findings`);
  if (!res.ok) throw new Error('Failed to fetch findings');
  return res.json();
}

export async function fetchTimeline(id: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/findings/timeline`);
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

export async function fetchUrls(id: string): Promise<DiscoveredUrl[]> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/urls`);
  if (!res.ok) throw new Error('Failed to fetch URLs');
  return res.json();
}

export async function fetchGraph(id: string): Promise<CytoscapeElement[]> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/graph`);
  if (!res.ok) throw new Error('Failed to fetch graph data');
  return res.json();
}

export async function fetchResources(id: string): Promise<Record<string, number>> {
  const res = await fetch(`${BASE_URL}/investigations/${id}/resources`);
  if (!res.ok) throw new Error('Failed to fetch resource usage');
  return res.json();
}
