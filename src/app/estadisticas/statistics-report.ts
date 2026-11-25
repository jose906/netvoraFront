import { Chart } from 'chart.js';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface StatisticsReportChart {
  element: HTMLElement;
  title: string;
  group?: string;
  note?: string;
  selected: boolean;
}

export interface StatisticsReport {
  title: string;
  scope: [string, string][];
  note: string;
  warnings: string[];
  charts: StatisticsReportChart[];
}

const INK = '#182238';
const MUTED = '#475569';
const PURPLE = '#6045c7';
const MARGIN = 16;
const WIDTH = 178;
const BOTTOM = 275;
const CHART_HEIGHT = 165;
const number = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });

export async function downloadStatisticsReport(report: StatisticsReport, fileName: string): Promise<number> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: report.title, subject: 'Estadísticas de NetVora', creator: 'NetVora' });
  let y = 0;
  let included = 0;
  const omitted: string[] = [];

  function startPage(add = true): void {
    if (add) pdf.addPage();
    pdf.setDrawColor(PURPLE);
    pdf.setLineWidth(1);
    pdf.line(MARGIN, 14, MARGIN + 14, 14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(PURPLE);
    pdf.text('NetVora  /  Estadísticas', MARGIN + 18, 15);
    y = 26;
  }

  function paragraph(text: string, size = 10, bold = false, color = INK): void {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lineHeight = size * 0.44;
    for (const line of pdf.splitTextToSize(text, WIDTH) as string[]) {
      if (y > BOTTOM) {
        startPage();
        pdf.setTextColor(color);
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
      }
      pdf.text(line, MARGIN, y);
      y += lineHeight;
    }
    y += 2;
  }

  startPage(false);
  paragraph(report.title, 23, true);
  for (const [label, value] of report.scope) paragraph(label + ' · ' + value, 10, false, MUTED);
  if (report.note) {
    y += 3;
    paragraph('Notas del informe', 11, true);
    paragraph(report.note);
  }
  y += 7;

  for (const figure of report.charts) {
    try {
      const image = await captureFigure(figure.element);
      const note = [figure.note, chartLegend(figure.element)].filter(Boolean).join(' ');
      const indivisible = figure.element.matches('canvas, img');
      const drawWidth = indivisible ? Math.min(WIDTH, CHART_HEIGHT * image.width / image.height) : WIDTH;
      const pagePixels = indivisible ? image.height : Math.floor(CHART_HEIGHT * image.width / drawWidth);
      const parts = Math.ceil(image.height / pagePixels);

      for (let part = 0; part < parts; part++) {
        const top = part * pagePixels;
        const sliceHeight = Math.min(pagePixels, image.height - top);
        const drawHeight = drawWidth * sliceHeight / image.width;
        if (y + drawHeight + 35 > BOTTOM) startPage();
        if (figure.group) paragraph(figure.group, 9, true, PURPLE);
        paragraph(figure.title + (parts > 1 ? ` (${part + 1}/${parts})` : ''), 13, true);
        if (note && part === 0) paragraph(note, 9, false, MUTED);
        if (y + drawHeight > BOTTOM) startPage();
        pdf.addImage(parts === 1 ? image : copyImage(image, image.width, sliceHeight, top),
          'PNG', MARGIN + (WIDTH - drawWidth) / 2, y, drawWidth, drawHeight);
        y += drawHeight + 11;
      }
      included++;
    } catch {
      omitted.push(figure.title);
    }
  }

  if (!included) throw new Error('No se pudo capturar ninguna gráfica.');
  const warnings = [...report.warnings, ...omitted.map(title => 'No se pudo capturar «' + title + '».')];
  if (warnings.length) {
    if (y + 25 > BOTTOM) startPage();
    paragraph('Disponibilidad de datos', 12, true);
    for (const warning of warnings) paragraph(warning, 10, false, MUTED);
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor('#e2e8f0');
    pdf.setLineWidth(.25);
    pdf.line(MARGIN, 282, MARGIN + WIDTH, 282);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(MUTED);
    pdf.setFontSize(9);
    pdf.text(`${page} / ${pages}`, MARGIN + WIDTH, 288, { align: 'right' });
  }

  pdf.save(fileName);
  return omitted.length;
}

function chartLegend(element: HTMLElement): string {
  if (!(element instanceof HTMLCanvasElement)) return '';
  const chart = Chart.getChart(element);
  if (!chart || !['doughnut', 'pie'].includes(chart.getDatasetMeta(0).type)) return '';

  const values = chart.data.datasets[0]?.data ?? [];
  return (chart.data.labels ?? []).flatMap((label, index) => {
    const count = values[index];
    return chart.getDataVisibility(index) && typeof count === 'number'
      ? [String(label) + ' (' + number.format(count) + ')'] : [];
  }).join(' · ');
}

async function captureFigure(element: HTMLElement): Promise<HTMLCanvasElement> {
  if (element instanceof HTMLCanvasElement) {
    const chart = Chart.getChart(element);
    chart?.stop();
    chart?.update('none');
    return copyImage(element, element.width, element.height);
  }
  if (element instanceof HTMLImageElement) {
    await element.decode();
    return copyImage(element, element.naturalWidth, element.naturalHeight);
  }

  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, element.scrollWidth));
  const height = Math.ceil(Math.max(rect.height, element.scrollHeight));
  const image = await toCanvas(element, {
    width, height, backgroundColor: '#ffffff', skipFonts: true,
    pixelRatio: Math.min(2, 16000 / Math.max(width, height)),
    style: { maxHeight: 'none', overflow: 'visible', margin: '0' }
  });
  if (!image.width || !image.height) throw new Error('Gráfica vacía');
  return image;
}

function copyImage(source: CanvasImageSource, width: number, height: number, top = 0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || !width || !height) throw new Error('Gráfica vacía');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, top, width, height, 0, 0, width, height);
  return canvas;
}
