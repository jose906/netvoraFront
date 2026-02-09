

export const COLORS = [
  'rgba(93, 173, 226, 0.8)',
  'rgba(247, 220, 111, 0.8)',
  'rgba(88, 214, 141, 0.8)',
  'rgba(231, 76, 60, 0.8)',
  'rgba(155, 89, 182, 0.8)',
  'rgba(241, 148, 138, 0.8)',
  'rgba(133, 193, 233, 0.8)',
];

export const SENTIMENT_COLORS = {
  positivos: 'rgba(88, 214, 141, 0.8)',
  negativos: 'rgba(231, 76, 60, 0.8)',
  neutros:   'rgba(247, 220, 111, 0.8)'
};
export function buildDataset(label: string, data: number[], colors: string[]) {
  return {
    label,
    data,
    backgroundColor: colors,
    borderRadius: 10,
    borderSkipped: false
    
  };
}
// 🎨 Paleta NetVora
// src/app/utils/helpers.ts

export const NETVORA_PALETTE = {
  // Branding
  accent: '#6d28d9',
  accentDark: '#5b21b6',
  accentLight: '#8b5cf6',

  // Neutrales / UI
  text: '#0f172a',
  muted: '#64748b',
  grid: 'rgba(15,23,42,.08)',
  border: 'rgba(15,23,42,.10)',
  surface: '#ffffff',

  // Sentimiento (semántico)
  sentiment: {
    negativo: '#ef4444',
    neutro: '#94a3b8',
    positivo: '#22c55e',
  },

  // Timeline (line)
  timeline: {
    line: '#6d28d9',
    point: '#6d28d9',
    fill: 'rgba(109,40,217,.12)',
  },

  // Bars (categorías o comparaciones)
  categories: [
    '#6d28d9'
  ],

  // SentVsUser (stacked)
  sentVsUser: {
    negativo: 'rgba(239,68,68,.85)',
    neutro: 'rgba(148,163,184,.85)',
    positivo: 'rgba(34,197,94,.85)',
  },

  // Índice (horizontal): negativo vs positivo
  indice: {
    positivo: 'rgba(109,40,217,.85)',
    negativo: 'rgba(239,68,68,.75)',
    neutral: 'rgba(148,163,184,.85)',
  }
};


export function buildDatasetSent(label: string, data: number[], colors: string) {
  return {
    label,
    data,
    backgroundColor: colors,
    borderRadius: 10,
    borderSkipped: false
    
  };
}

export function buildLineDataset(label: string, data: number[], i: number) {
  return {
    label,
    data,
    fill: false,
    borderWidth: 2
  };
}

