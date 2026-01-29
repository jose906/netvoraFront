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

// ---- Estructura principal ----
export interface StatsResponse {
  locacion: EntityTotal[];
  organizacion: EntityTotal[];
  persona: EntityTotal[];

  posts: {
    total_posts: number;
  };

  posts_categories: {
    posts_per_category: Record<string, number>;
    // si quieres más estricto:
    // posts_per_category: {
    //   Ambiente: number; Deportes: number; Economia: number; Educacion: number;
    //   Municipal: number; Otros: number; Politica: number; Salud: number;
    //   Seguridad: number; Sociedad: number;
    // };
  };

  sentimientos: {
    posts_per_sentiment: {
      negativo: number;
      neutro: number;
      positivo: number;
    };
  };

  time_line: TimeLinePoint[];
}
