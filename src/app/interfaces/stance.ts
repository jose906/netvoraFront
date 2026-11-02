// Interfaces para los 10 endpoints de Stance de NetVora.
export type StanceAnalysisType = 'post' | 'topic';
export type StanceValue = 'FAVOR' | 'CONTRA' | 'MIXTO' | 'NEUTRAL' | 'NO_CLARO';
export type StanceStatus = 'processed' | 'pending' | 'not_applicable' | 'no_comments' | 'partial';
export type TimelineInterval = '1h' | '3h' | '6h' | '12h' | '1d';

export interface StanceFilters {
  start?: string;
  end?: string;
  analysisType?: StanceAnalysisType;
  users?: string[];
  topic_ids?: number[];
  topicId?: number;
  tweetid?: string;
  categoria?: string;
  type_user?: 'Medio' | 'Persona' | 'Entidad';
  search?: string;
  commentSearch?: string;
  stance?: StanceValue;
  status?: StanceStatus;
  minConfidence?: number;
  timeline_interval?: TimelineInterval;
  page?: number;
  limit?: number;
}

export type StanceDistribution = Record<StanceValue, number>;

export interface StanceSummary {
  total: number;
  processed: number;
  pending: number;
  not_applicable: number;
  coverage_percent: number;
  distribution: StanceDistribution;
  percentages: StanceDistribution;
  avg_confidence: number | null;
}

export interface StanceTimelineRow extends StanceDistribution {
  date: string;
  total: number;
}

export interface StanceComment {
  replyid: string;
  comment_text: string;
  comment_created: string | null;
  tweetid: string;
  post_text: string;
  post_created: string;
  post_url: string | null;
  source_id: string | number;
  source_name: string;
  categoria?: string;
  topic_id?: number | null;
  topic_name?: string | null;
  main_target?: string | null;
  stance: StanceValue | null;
  confidence: number | null;
  status: StanceStatus;
}

export interface StancePublication {
  tweetid: string;
  text: string;
  created: string;
  url: string | null;
  source_name: string;
  topic_id?: number | null;
  topic_name?: string | null;
  target_type?: string | null;
  main_target?: string | null;
  target_description?: string | null;
  stance_summary: StanceSummary;
  status: StanceStatus;
}

export interface StanceTopic {
  topic_id: number;
  topic_name: string;
  main_target?: string | null;
  target_type?: string | null;
  total_posts: number;
  stance_summary: StanceSummary;
  status?: StanceStatus;
}

export interface StanceSource {
  source_id: string | number;
  source_name: string;
  source_type: string;
  stance_summary: StanceSummary;
}

export interface StancePage<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}

export interface StanceResponse<T> {
  ok: boolean;
  [key: string]: unknown;
}
