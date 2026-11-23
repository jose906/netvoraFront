import { jsPDF } from 'jspdf';
import type { RadarSignal, RadarSnapshot, RadarWatch } from '../interfaces/radar';

const number = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 });
const reviewLabels = { new: 'Nuevo', reviewing: 'En curso', resolved: 'Resuelto' };

function signalSummary(signal: RadarSignal): string {
  const value = (numberOrMissing?: number, unit = '') =>
    numberOrMissing == null ? 'Sin dato' : number.format(numberOrMissing) + unit;
  switch (signal.kind) {
    case 'volume':
      return `${value(signal.observed)} publicaciones · Referencia ${value(signal.expected)} · Umbral ${value(signal.threshold)}`;
    case 'topic':
      return `${value(signal.observed)} publicaciones · ${value(signal.sources)} fuentes`;
    case 'stance':
      return `${value(signal.observed, '%')} en contra frente a ${value(signal.expected, '%')} · `
        + `Cobertura ${value(signal.coverage, '%')} frente a ${value(signal.previous_coverage, '%')} · `
        + `Comentarios clasificados: ${value(signal.processed)} frente a ${value(signal.previous_processed)}`;
  }
}

export function createRadarPdf(watch: RadarWatch, day: RadarSnapshot, days: RadarSnapshot[]): jsPDF {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const margin = 17;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const width = pageWidth - margin * 2;
  const bottom = pageHeight - 20;
  const accent = '#6d28d9';
  const comparison = '#c4b5fd';
  const ink = '#172136';
  const muted = '#526178';
  let y = margin;

  const ensureSpace = (height: number): void => {
    if (y + height <= bottom) return;
    pdf.addPage();
    y = margin;
  };

  const write = (content: string, options: { size?: number; bold?: boolean; color?: string; url?: string } = {}): void => {
    const { size = 10, bold = false, color = ink, url } = options;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(color);
    const lineHeight = size * .5;
    // The standard PDF font covers Latin text. Substitute unsupported glyphs before line wrapping.
    const printable = content.normalize('NFC')
      .replace(/[^\x20-\x7e\xa0-\xff\n\r\t€‘’“”–—…]/gu, '?').replace(/\t/g, ' ');
    for (const line of pdf.splitTextToSize(printable, width) as string[]) {
      ensureSpace(lineHeight);
      if (url) pdf.textWithLink(line, margin, y + lineHeight * .75, { url });
      else pdf.text(line, margin, y + lineHeight * .75);
      y += lineHeight;
    }
  };

  const heading = (title: string, minimumBody = 10): void => {
    ensureSpace(minimumBody + 14);
    y += 5;
    write(title, { size: 13, bold: true });
    y += 2;
  };

  const { evidence } = day;
  pdf.setProperties({ title: 'Radar · ' + day.observation_day, subject: 'Informe de seguimiento de Netvora' });

  write('NETVORA / RADAR', { color: accent, bold: true, size: 9 });
  y += 2;
  write(watch.name, { size: 24, bold: true });
  write(`${day.observation_day} · Revisión: ${reviewLabels[day.review_state]}`, { color: muted });
  y += 4;
  const scope = [
    `Vista: ${watch.filters.view}`,
    watch.filters.users.length ? `${number.format(watch.filters.users.length)} cuentas específicas` : '',
    watch.filters.topic_ids.length ? `Tópicos: ${watch.filters.topic_ids.join(', ')}` : '',
    watch.filters.search ? `Búsqueda: ${watch.filters.search}` : '',
    watch.filters.entidad ? `Mención: ${watch.filters.entidad}` : ''
  ];
  write(scope.filter(Boolean).join(' · '), { color: muted });

  heading('Resumen del día');
  write(`${number.format(evidence.total)} publicaciones · ${number.format(evidence.quality.active_sources ?? 0)} fuentes activas`, { bold: true });
  write(`Referencia habitual: ${number.format(evidence.baseline)} publicaciones`);
  if (evidence.quality.classified != null) {
    write(`Sentimiento clasificado: ${number.format(evidence.quality.classified)} de ${number.format(evidence.total)} publicaciones`);
  }
  if (evidence.active_history < 4) {
    write('Hay pocos días comparables con actividad.', { color: muted });
  }

  if (days.length) {
    heading('Actividad hasta el día del informe', 51);
    write('Morado: publicaciones · Lila: referencia habitual', { color: muted, size: 9 });
    const peak = Math.max(1, ...days.flatMap(item => [item.evidence.total, item.evidence.baseline]));
    const slot = width / days.length;
    const barWidth = Math.min(8, slot / 4);
    const baselineY = y + 33;
    pdf.setDrawColor('#e4e7ef').line(margin, baselineY, margin + width, baselineY);
    pdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor(ink);
    days.forEach((item, index) => {
      const center = margin + slot * (index + .5);
      const totalHeight = item.evidence.total / peak * 26;
      const referenceHeight = item.evidence.baseline / peak * 26;
      if (totalHeight > 0) pdf.setFillColor(accent).rect(center - barWidth - 1, baselineY - totalHeight, barWidth, totalHeight, 'F');
      if (referenceHeight > 0) pdf.setFillColor(comparison).rect(center + 1, baselineY - referenceHeight, barWidth, referenceHeight, 'F');
      pdf.text(number.format(item.evidence.total), center, baselineY - Math.max(totalHeight, referenceHeight) - 2, { align: 'center' });
      const [, month, date] = item.observation_day.split('-');
      pdf.text(`${date}/${month}`, center, baselineY + 5, { align: 'center' });
    });
    y = baselineY + 9;
  }

  heading('Señales detectadas');
  if (!evidence.signals.length) write('Sin señales para el día seleccionado.', { color: muted });
  for (const signal of evidence.signals) {
    ensureSpace(18);
    write(signal.title, { bold: true });
    write(signalSummary(signal), { color: muted });
    y += 2;
  }

  const breakdowns = [
    { title: 'Fuentes principales', rows: evidence.evidence.sources.map(row => ({ ...row, label: row.name })) },
    { title: 'Tópicos principales', rows: evidence.evidence.topics.map(row => ({ ...row, label: row.topic_name })) }
  ];
  for (const { title, rows } of breakdowns) {
    if (!rows.length) continue;
    heading(title, 16);
    write('Publicaciones del día frente al mismo día de la semana anterior', { color: muted, size: 9 });
    for (const row of rows) {
      ensureSpace(12);
      write(row.label, { bold: true });
      write(`${number.format(row.total)} frente a ${number.format(row.previous)}`, { color: muted });
    }
  }

  if (day.note.trim()) {
    heading('Nota de revisión');
    write(day.note);
  }

  heading('Publicaciones de evidencia');
  if (!evidence.evidence.posts.length) write('Sin publicaciones de evidencia para este día.', { color: muted });
  for (const post of evidence.evidence.posts) {
    ensureSpace(24);
    write(post.source || 'Fuente', { bold: true });
    if (post.text?.trim()) write(post.text);
    if (post.url && /^https?:\/\//i.test(post.url)) {
      write('Abrir publicación original', { color: accent, url: post.url });
    }
    y += 4;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page).setDrawColor('#e4e7ef').line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(muted);
    pdf.text('Netvora Radar · ' + day.observation_day, margin, pageHeight - 10);
    pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  return pdf;
}
