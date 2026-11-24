import type { BarElement, ChartOptions, ChartType, Plugin, Scale, TickOptions } from 'chart.js';
import { merge } from 'chart.js/helpers';

const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const muted = '#475569';
const grid = '#e2e8f0';
const number = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });

function rankingLabel(label: string, width: number): string | string[] {
  if (label.length <= width) return label;
  const split = label.lastIndexOf(' ', width);
  const first = split > width / 2 ? split : width;
  const continuation = label.slice(first).trimStart();
  return [label.slice(0, first), continuation.length > width
    ? continuation.slice(0, width - 1) + '…'
    : continuation];
}

export function statisticsChartOptions<T extends ChartType>(options: NonNullable<ChartOptions<T>>): NonNullable<ChartOptions<T>> {
  const scaleStyles = Object.fromEntries(Object.entries(options.scales ?? {}).map(([axis, scale]) => {
    const ranking = options.indexAxis === 'y' && axis === 'y';
    const category = ranking || (axis === 'x' && options.indexAxis !== 'y');
    const callback = (scale as { ticks?: Partial<TickOptions> }).ticks?.callback;

    return [axis, merge({}, [{
      border: { display: false },
      grid: { color: grid, drawTicks: false, display: !category },
      ticks: {
        padding: 9,
        font: { family: fontFamily, size: 12, weight: 550 },
        maxRotation: 0,
        ...(ranking ? { autoSkip: false } : { maxTicksLimit: axis === 'x' ? 8 : 7 })
      },
    }, scale, {
        grid: { color: grid },
        ticks: {
          color: muted,
          font: { family: fontFamily, size: 12, weight: 550 },
          ...(ranking ? {
            callback(this: Scale, value: string | number, index: number, ticks: Parameters<TickOptions['callback']>[2]) {
              const label = callback ? callback.call(this, value, index, ticks) : this.getLabelForValue(Number(value));
              return typeof label === 'string' ? rankingLabel(label, this.chart.width < 430 ? 12 : 22) : label;
            }
          } : {})
        }
    }])];
  }));

  return merge({}, [
    {
      locale: 'es-BO',
      layout: { padding: { top: 12, right: 13, bottom: 8, left: 6 } },
      elements: {
        line: { borderWidth: 3, cubicInterpolationMode: 'monotone' },
        point: { hitRadius: 12, hoverRadius: 6, hoverBorderWidth: 2 },
        bar: { borderRadius: 5, borderSkipped: false },
        arc: { borderColor: '#fff', borderWidth: 2, hoverOffset: 5 }
      },
      datasets: { bar: { maxBarThickness: 32 } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 9, padding: 14 }
        },
        tooltip: {
          backgroundColor: '#172136',
          titleFont: { family: fontFamily, size: 13, weight: 700 },
          bodyFont: { family: fontFamily, size: 12 },
          padding: 12,
          cornerRadius: 9,
          boxPadding: 4
        }
      }
    },
    options,
    {
      plugins: { legend: { labels: { color: muted, font: { family: fontFamily, size: 12, weight: 600 } } } },
      ...(options.scales ? { scales: scaleStyles } : {}),
      ...(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
        ? { animation: false as const }
        : {})
    }
  ]) as NonNullable<ChartOptions<T>>;
}

export const statisticsBreakdownBars = statisticsChartOptions<'bar'>({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } },
    y: {}
  },
  plugins: { legend: { display: false } }
});

export const statisticsRankingValues: Plugin = {
  id: 'statisticsRankingValues',
  afterDatasetsDraw(chart) {
    const [meta] = chart.getSortedVisibleDatasetMetas();
    if (!meta || meta.type !== 'bar' || chart.options.indexAxis !== 'y' ||
      chart.data.datasets.length !== 1 || meta.data.length > 12) return;

    const { ctx, chartArea } = chart;
    const values = chart.data.datasets[meta.index].data;
    ctx.save();
    ctx.font = `650 11px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    meta.data.forEach((element, index) => {
      const value = values[index];
      if (typeof value !== 'number' || value <= 0) return;

      const { x, y, base } = (element as BarElement).getProps(['x', 'y', 'base'], false);
      if (x === null || y === null) return;
      const label = number.format(value);
      const width = ctx.measureText(label).width;
      const fitsOutside = x + width + 8 < chartArea.right;
      if (!fitsOutside && x - base < width + 14) return;

      ctx.textAlign = fitsOutside ? 'left' : 'right';
      ctx.fillStyle = fitsOutside ? '#334155' : '#fff';
      ctx.fillText(label, x + (fitsOutside ? 6 : -7), y);
    });

    ctx.restore();
  }
};
