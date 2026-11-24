

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

  // Sentimiento
  sentiment: {
    negativo: '#b93949',
    neutro: '#64748b',
    positivo: '#087e5d'
  },

  timeline: {
    line: '#6d28d9',
    point: '#6d28d9',
    fill: 'rgba(109,40,217,.14)'
  },

  categories: [
    '#6d28d9', '#2563eb', '#007f92', '#14764e',
    '#99520e', '#b93949', '#ad3375', '#4e548d',
    '#925836', '#126b68', '#63388c', '#475569'
  ],

  sentVsUser: {
    negativo: '#b93949',
    neutro: '#64748b',
    positivo: '#087e5d'
  },

  indice: {
    positivo: '#6d28d9',
    negativo: '#b93949',
    neutral: '#64748b'
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

export function exportCanvasWithWhiteBg(canvas: HTMLCanvasElement): string {
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = canvas.width;
  tmpCanvas.height = canvas.height;

  const ctx = tmpCanvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);

  // Dibuja el gráfico encima
  ctx.drawImage(canvas, 0, 0);

  return tmpCanvas.toDataURL('image/png');
}
// src/app/helpers/helpers.ts

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function linkifyText(text: string): string {
  if (!text) return '';

  // Primero escapamos HTML para evitar problemas
  let safeText = escapeHtml(text);

  // Regex para detectar links http/https
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Reemplazar links por <a>
  safeText = safeText.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Mantener saltos de línea
  safeText = safeText.replace(/\n/g, '<br>');

  return safeText;
}



