export interface RadarFilters {
  view: string;
  users: string[];
  topic_ids: number[];
  search: string;
  entidad?: string;
  entity_type?: string;
}

export type RadarCadence = 'none' | 'daily' | 'weekly';
export type RadarState = 'new' | 'reviewing' | 'resolved';

export interface RadarWatch {
  id: string;
  name: string;
  filters: RadarFilters;
  cadence: RadarCadence;
  paused: boolean;
}

export interface RadarPost {
  tweetid: string;
  text: string;
  source: string;
  url?: string | null;
  created?: string;
}

export interface RadarSignal {
  kind: 'volume' | 'topic' | 'stance';
  title: string;
  observed: number;
  expected?: number;
  threshold?: number;
  sources?: number;
  topic_id?: string;
  processed?: number;
  previous_processed?: number;
  coverage?: number;
  previous_coverage?: number;
}

export interface RadarSnapshot {
  observation_day: string;
  note: string;
  review_state: RadarState;
  evidence: {
    total: number;
    baseline: number;
    active_history: number;
    signals: RadarSignal[];
    quality: { active_sources?: number; classified?: number; last_publication?: string };
    sources: { id: string; name: string; last_publication?: string }[];
    evidence: {
      posts: RadarPost[];
      sources: { id: string; name: string; total: number; previous: number }[];
      topics: { topic_id: number; topic_name: string; total: number; previous: number }[];
    };
  };
}

export interface RadarActor {
  name: string;
  type: 'PER' | 'ORG';
  total: number;
  sources: number;
}

export interface RadarStory {
  manual_split: boolean;
  title: string;
  pieces: number;
  sources: string[];
  posts: RadarPost[];
}
