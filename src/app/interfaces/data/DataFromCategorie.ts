import { EntitySentiment } from "./AllData";

export interface EntidadPorUserItem {
  entidad: string;
  cantidad: number;
}

export interface DataFromCategorie {
  total_posts: number;
  posts_per_media: Record<string, number>;
  posts_per_sentiment: {[key:string]: number};
  posts_per_persona: EntitySentiment[];
  posts_per_organizacion: EntitySentiment[];
  posts_per_locacion: EntitySentiment[];
  media_per_sentiment: { [media: string]: { [sentimiento: string]: number } };

}