// homePage.ts

export interface HomePageResponse {
  daily: HomePageDaily;
  last_7_days: HomePageLast7DayItem[];
}

export interface HomePageDaily {
    fecha: string; // YYYY-MM-DD

    sentimientos: {
    negativo: string;
    neutro: string;
    positivo: string;
  };

  top_3_entidades: string[];
  top_categoria: string;
  total_noticias: number;
  topics_dia: TopicDay[];
  topics_semana: TopicWeek[];
}
export interface TopicWeek {
  topic_id: number;
  topic_name: string;
  tweets_actual: number;
  tweets_anterior: number;
  tendencia: string;
  diferencia: string;
  porcentaje?: string | null;
}

export interface TopicDay {
  topic_id: number;
  topic_name: string;
  tweets_hoy: number;
  tweets_ayer: number;
  tendencia: string;
  diferencia: string;
  porcentaje?: string | null;
}
export interface HomePageLast7DayItem {
  fecha: string;     // YYYY-MM-DD
  indice: number;    // -0.395 etc
  negativas: string; // viene como string en tu JSON
  positivas: string; // viene como string en tu JSON
  total: number;     // en tu JSON es number
}
