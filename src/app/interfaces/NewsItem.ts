export interface NewsItem{

    tweetid:string;
    TweetUser:string;
    created:string;
    text:string;
    url:string;
    sentimiento:string;
    lugar:string;
    persona:string;
    organizacion:string;
    categoria:string;
    note:string;
    
    }
    export interface TopicItem {
  tweetid: number;

  text: string;
  created: string;
  url: string;

  TweetUser: string;

  sentimiento: 'positivo' | 'negativo' | 'neutro' | string;
  categoria: string;

  topic_name: string;

  Persona: string;
  Organizacion: string;
  Locacion: string;
}
export interface TopicOption {
  topic_id: number;
  topic_name: string;
  last_seen: string;
}

export interface PulseActivity {
  date: string;
  total: number;
}

export interface PulseSentiment {
  positivo: number;
  neutro: number;
  negativo: number;
}

export interface PulseData {
  total_posts: number;
  total_sources: number;
  total_comments: number;
  dominant_sentiment: string;

  sentiment: PulseSentiment;

  activity_7d: PulseActivity[];
}

export interface PulseResponse {
  ok: boolean;
  pulse: PulseData;
}