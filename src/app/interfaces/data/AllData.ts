import { CategoriasData } from "./CategoriasData";

// models/estadisticas.model.ts (o donde tengas tus interfaces)
export interface ConteoResponse {
  total_posts: number;

  posts_per_media: Record<string, number>;
  posts_per_sentiment: Record<string, number>;
  posts_per_category: Record<string, number>;

  posts_per_persona: EntitySentiment[];
  posts_per_organizacion: EntitySentiment[];
  posts_per_locacion: EntitySentiment[];

  media_per_category: Record<string, Record<string, number>>;
  media_per_sentiment: Record<string, Record<string, number>>;
  sentiment_per_category: Record<string, Record<string, number>>;

  // ✅ NUEVO (según tu back)
  entidad_per_category?: Record<string, Record<string, number>>;
  entidad_per_sentiment?: Record<string, Record<string, number>>;

  persona_per_category?: Record<string, Record<string, number>>;
  persona_per_sentiment?: Record<string, Record<string, number>>;

  posts_per_cuenta_entidad?: Record<string, number>;
  posts_per_cuenta_persona?: Record<string, number>;

  timeline_posts?: Array<{ fecha: string; total: number }>;
  timeline_category?: Record<string, Record<string, number>>;
  timeline_sentiment?: Record<string, Record<string, number>>;
}

export interface EntitySentiment {
  entidad: string;
  positivos: number;
  negativos: number;
  neutros: number;
  total?: number; // a veces llega, a veces no; lo calculamos igual
}
