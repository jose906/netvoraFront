// ====== Tipos base ======
export type SentimentKey = 'negativo' | 'neutro' | 'positivo';

export interface SentimentCounts {
  negativo: number;
  neutro: number;
  positivo: number;
}

export interface EntityTotal {
  entidad: string;
  total: number;
}

export interface TimeLinePoint {
  /** Ej: "Mon, 15 Dec 2025 00:00:00 GMT" (string tal cual viene del back) */
  fecha: string;
  total: number;
}

export interface TopUserItem {
  usuario: string;
  total: number;
}

// ====== Secciones del JSON ======
export interface SentVsUser {
  /**
   * Key = usuario (ej: "ATBDigital", "noticiasfides")
   * Value = conteo por sentimiento
   */
  [user: string]: SentimentCounts;
}

export interface SentimentSection {
  posts_per_sentiment: SentimentCounts;
}

export interface TotalPostsSection {
  total_posts: number;
}

// ====== Respuesta completa ======
export interface DashboardStatsResponse {
  SentVsUser: SentVsUser;

  locacion: EntityTotal[];
  organizacion: EntityTotal[];
  persona: EntityTotal[];

  sentiment: SentimentSection;

  time_line: TimeLinePoint[];

  top_users: TopUserItem[];

  total_posts: TotalPostsSection;
}
