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
}

export interface HomePageLast7DayItem {
  fecha: string;     // YYYY-MM-DD
  indice: number;    // -0.395 etc
  negativas: string; // viene como string en tu JSON
  positivas: string; // viene como string en tu JSON
  total: number;     // en tu JSON es number
}
