// ---- Tipos base ----

export interface EntityTotal {
  entidad: string;
  total: number;
}

export interface TimeLinePoint {
  // viene como string tipo: "Mon, 15 Dec 2025 00:00:00 GMT"
  fecha: string;
  total: number;
}

export interface TopicDashboard {
  topic_id: number;
  topic_name: string;
  total: number;
}
export interface TopicTimelineItem {
  fecha: string;
  topic_id: number;
  topic_name: string;
  total: number;
}


// ---- Estructura principal ----

export interface StatsResponse {

  locacion: EntityTotal[];

  organizacion: EntityTotal[];

  persona: EntityTotal[];

  posts: {
    total_posts: number;
  };

  total_replies: {
    negativo: number;
    neutro: number;
    positivo: number;
    total: number;
  };

  posts_categories: {
    posts_per_category: Record<string, number>;
  };

  sentimientos: {
    posts_per_sentiment: {
      negativo: number;
      neutro: number;
      positivo: number;
    };
  };

  time_line: TimeLinePoint[];

  // NUEVO
  topics: TopicDashboard[];
  topics_timeline: TopicTimelineItem[];
  emerging_topics: EmergingTopicItem[];
  topic_sentiment: TopicSentimentItem[];
}
export interface EmergingTopicItem {
  topic_id: number;
  topic_name: string;
  total_actual: number;
  total_anterior: number;
  diferencia: number;
  porcentaje: number | null;
  tendencia: 'NUEVO' | 'SUBIO' | 'BAJO' | 'IGUAL';
}
export interface TopicSentimentItem {
  topic_id: number;
  topic_name: string;
  positivos: number;
  neutrales: number;
  negativos: number;
  total: number;
}