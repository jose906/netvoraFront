export type DashboardEntityType = 'PER' | 'ORG' | 'LOC';

export interface DashboardSelection {
  bucket?: string;
  sourceId?: string;
  topicId?: number;
  label?: string;
  entity?: string;
  entityType?: DashboardEntityType;
}

export interface DashboardEvidenceFilters {
  start: string;
  end: string;
  users: string[];
  topic_ids: number[];
  search: string;
  categoria: string;
  type_user: string;
  bucket?: string;
  interval: string;
  page: number;
  entidad?: string;
  entity_type?: DashboardEntityType;
}

export interface DashboardEvidence {
  total: number;
  previous: number;
  previous_start: string;
  topics: { topic_id: number; topic_name: string; total: number; previous: number }[];
  sources: { id: string; name: string; total: number; previous: number }[];
  posts: { tweetid: string; source: string; text: string; url: string | null; sentimiento: string | null }[];
}
