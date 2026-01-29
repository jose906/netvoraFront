export interface Ejemplo {
  sentimiento: string;
  text: string;
  tweetid: number;
}

export interface Sentimientos {
  negativo: number;
  neutro: number;
  positivo: number;
}

export interface CategoriaData {
  ejemplos: Ejemplo[];
  sentimientos: Sentimientos;
  total_posts: number;
}

export interface MainPageData {
  [categoria: string]: CategoriaData;
}
