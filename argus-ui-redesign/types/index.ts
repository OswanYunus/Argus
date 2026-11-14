export interface Investigation {
  id: string;
  name: string;
  description: string;
  target_name: string;
  target_signals: {
    emails?: string[];
    usernames?: string[];
    domains?: string[];
    [key: string]: any;
  };
  config: Record<string, any>;
  encryption_key_id: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'archived' | 'purged';
  created_at: string;
  updated_at: string;
}

export interface InvestigationSummary {
  id: string;
  name: string;
  target_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IdentitySignal {
  id: string;
  identity_id: string;
  signal_type: string;
  signal_value: string;
  signal_strength: number;
  source_document_id?: string;
  source_url?: string;
  raw_evidence?: string;
  created_at: string;
}

export interface Identity {
  id: string;
  investigation_id: string;
  identity_type: string;
  canonical_value: string;
  display_name?: string;
  is_target: boolean;
  confidence: number;
  confidence_explanation?: string;
  verification_status: 'unverified' | 'likely' | 'verified' | 'rejected' | 'ambiguous';
  first_seen_at: string;
  created_at: string;
  updated_at: string;
  signal_count: number;
  link_count: number;
}

export interface FindingSource {
  id: string;
  finding_id: string;
  document_id: string;
  url: string;
  excerpt?: string;
  page_or_section?: string;
  created_at: string;
}

export interface Finding {
  id: string;
  investigation_id: string;
  identity_id?: string;
  finding_type: 'fact' | 'inference' | 'contradiction' | 'uncertainty' | 'timeline_event';
  category: string;
  summary: string;
  detail?: string;
  confidence: number;
  confidence_explanation?: string;
  temporal_date?: string;
  temporal_precision?: string;
  is_new: boolean;
  created_at: string;
  updated_at: string;
  sources: FindingSource[];
}

export interface DiscoveredUrl {
  id: string;
  investigation_id: string;
  url: string;
  source_type: string;
  title?: string;
  snippet?: string;
  relevance_score?: number;
  status: 'pending' | 'queued' | 'collected' | 'filtered' | 'rejected' | 'error' | 'robots_blocked';
  rejection_reason?: string;
  first_seen_at: string;
  last_checked_at?: string;
}

export interface CytoscapeElement {
  data: {
    id: string;
    label?: string;
    type?: string;
    confidence?: number;
    status?: string;
    isTarget?: boolean;
    source?: string;
    target?: string;
  };
}
