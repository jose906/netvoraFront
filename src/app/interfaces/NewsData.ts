import { NewsItem } from "../interfaces/NewsItem"

export interface NewsData {
  page: number;
  total: number;
  hasMore?: boolean;
  resumen: string;
  resultado: NewsItem[];
}

export interface RepliesSummary {
  tweetid: number; // o string si te llega como string (IDs grandes)
  sentimiento: 'negativo' | 'neutro' | 'positivo' | 'otros' | string;
  total: number;
}


