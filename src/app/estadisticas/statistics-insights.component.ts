import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, TemplateRef, ViewChild } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { Subscription } from 'rxjs';

import { statisticsChartOptions } from '../data/statistics-chart';
import { ApiService } from '../services/api.service';
import { formatStatisticsRange, StatisticsFilters, StatisticsInsights, StatisticsSourceGroup } from './statistics-insights';

@Component({
  selector: 'app-statistics-insights',
  standalone: true,
  imports: [CommonModule, NgChartsModule],
  templateUrl: './statistics-insights.component.html',
  styleUrl: './statistics-insights.component.css'
})
export class StatisticsInsightsComponent implements OnChanges, OnDestroy {
  @Input() filters?: StatisticsFilters;
  @Output() topicSelected = new EventEmitter<number>();
  @Output() sourceSelected = new EventEmitter<string>();

  @ViewChild('activity', { static: true }) activity!: TemplateRef<unknown>;
  @ViewChild('topics', { static: true }) topics!: TemplateRef<unknown>;
  @ViewChild('sources', { static: true }) sources!: TemplateRef<unknown>;
  @ViewChild('sentiment', { static: true }) sentiment!: TemplateRef<unknown>;

  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
  readonly range = formatStatisticsRange;
  readonly number = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });

  readonly Math = Math;
  readonly hasClassifications = (bucket: { classified: number }) => bucket.classified > 0;

  loading = false;
  error = '';
  data?: StatisticsInsights;
  heatMax = 0;
  comparisonData!: ChartData<'bar'>;
  toneData!: ChartData<'bar'>;
  sourcesData!: ChartData<'bar'>;
  agendaData!: ChartData<'bar'>;
  coverageData!: ChartData<'bar'>;
  turnoverData!: ChartData<'bar'>;
  readonly sourceGroups: { id: StatisticsSourceGroup; label: string }[] = [
    { id: 'in_both', label: 'En ambos grupos de fechas' },
    { id: 'only_current', label: 'Solo en las fechas elegidas' },
    { id: 'only_previous', label: 'Solo en los días previos' }
  ];
  readonly coverageLabels = ['Sin tópico', '1 tópico', '2 tópicos', '3 o más tópicos'];
  overlapRows: { first: string; second: string; shared: number; union: number; percentage: number }[] = [];
  private request?: Subscription;

  readonly comparisonOptions = statisticsChartOptions<'bar'>({
    animation: false,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: { x: {}, y: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: {
      tooltip: {
        callbacks: {
          title: items => {
            const bucket = this.data?.buckets[items[0]?.dataIndex];
            return bucket ? this.range(bucket.range) + ' vs. ' + this.range(bucket.previous_range) : '';
          }
        }
      }
    }
  });

  readonly toneOptions = statisticsChartOptions<'bar'>({
    animation: false,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { stacked: true },
      y: { stacked: true, min: 0, max: 100, ticks: { callback: value => value + '%' } }
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: items => {
            const bucket = this.data?.buckets[items[0]?.dataIndex];
            return bucket ? this.range(bucket.range) : '';
          },
          label: item => item.parsed.y === null ? '' : `${item.dataset.label}: ${this.number.format(item.parsed.y)}%`,
          footer: items => {
            const bucket = this.data?.buckets[items[0]?.dataIndex];
            return bucket ? `${this.number.format(bucket.classified)} de ${this.number.format(bucket.current)} clasificadas` : '';
          }
        }
      }
    }
  });

  readonly sourcesOptions = statisticsChartOptions<'bar'>({
    animation: false,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: {} },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: item => {
            const topic = this.data?.topics[item.dataIndex];
            return topic ? `${this.number.format(topic.posts)} publicaciones` : '';
          }
        }
      }
    }
  });

  readonly agendaOptions = statisticsChartOptions<'bar'>({
    animation: false, maintainAspectRatio: false, indexAxis: 'y',
    scales: { x: { beginAtZero: true, ticks: { callback: value => value + ' pp' } }, y: {} },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: item => item.parsed.x === null ? '' : this.signed(item.parsed.x) + ' pp',
          afterLabel: item => {
            const topic = this.data?.agenda_change?.[item.dataIndex];
            if (!topic) return '';
            return 'Fechas previas ' + this.number.format(topic.previous_share) + '% · Fechas elegidas ' +
              this.number.format(topic.current_share) + '%';
          }
        }
      }
    }
  });

  readonly coverageOptions = statisticsChartOptions<'bar'>({
    animation: false, maintainAspectRatio: false, indexAxis: 'y',
    scales: { x: { min: 0, max: 100, ticks: { callback: value => value + '%' } }, y: {} },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: item => {
            const level = this.data?.topic_coverage?.[item.dataIndex];
            return level ? this.number.format(level.share) + '% · ' + this.number.format(level.posts) + ' publicaciones' : '';
          }
        }
      }
    }
  });

  readonly turnoverOptions = statisticsChartOptions<'bar'>({
    animation: false, maintainAspectRatio: false, indexAxis: 'y',
    scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } }
  });

  signed(value: number): string {
    return (value > 0 ? '+' : '') + this.number.format(value);
  }

  ngOnChanges(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  load(): void {
    this.request?.unsubscribe();
    this.data = undefined;
    this.error = '';
    if (!this.filters) return;
    this.loading = true;
    this.request = this.api.getStatisticsInsights(this.filters).subscribe({
      next: data => {
        this.setCharts(data);
        this.data = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la actividad para estas fechas.';
        this.loading = false;
      }
    });
  }

  constructor(private api: ApiService) {}

  private setCharts(data: StatisticsInsights): void {
    this.heatMax = Math.max(0, ...data.heatmap.flatMap(row => row.cells.map(cell => cell?.average ?? 0)));
    const labels = data.buckets.map(bucket => this.range(bucket.range, false));
    this.comparisonData = {
      labels,
      datasets: [
        { label: 'Fechas elegidas', data: data.buckets.map(bucket => bucket.current), backgroundColor: '#6045c7' },
        { label: 'Días previos', data: data.buckets.map(bucket => bucket.previous), backgroundColor: '#a5aebe' }
      ]
    };

    const sentiments = [
      { key: 'positive', label: 'Positivo', color: '#178354' },
      { key: 'neutral', label: 'Neutro', color: '#777f9e' },
      { key: 'negative', label: 'Negativo', color: '#c94d57' }
    ] as const;
    this.toneData = {
      labels,
      datasets: sentiments.map(({ key, label, color }) => ({
        label, backgroundColor: color, borderRadius: 0,
        data: data.buckets.map(bucket => this.percentage(bucket[key], bucket.classified))
      }))
    };

    this.sourcesData = {
      labels: data.topics.map(topic => topic.topic_name),
      datasets: [{ label: 'Cuentas distintas', data: data.topics.map(topic => topic.sources), backgroundColor: '#386fb7' }]
    };

    const agenda = data.agenda_change ?? [];
    this.agendaData = {
      labels: agenda.map(topic => topic.topic_name),
      datasets: [{
        label: 'Cambio en puntos porcentuales', data: agenda.map(topic => topic.change),
        backgroundColor: agenda.map(topic => topic.change < 0 ? '#a65b34' : '#386fb7')
      }]
    };

    this.coverageData = {
      labels: this.coverageLabels,
      datasets: [{
        label: 'Porcentaje de publicaciones', data: (data.topic_coverage ?? []).map(level => level.share),
        backgroundColor: ['#74678f', '#b8a8ed', '#8f73db', '#6045c7']
      }]
    };

    const topicNames = new Map(data.topics.map(topic => [topic.topic_id, topic.topic_name]));
    this.overlapRows = (data.topic_overlap ?? []).filter(pair => pair.shared > 0)
      .sort((a, b) => b.percentage - a.percentage || b.shared - a.shared)
      .map(pair => ({
        first: topicNames.get(pair.first_id) ?? String(pair.first_id),
        second: topicNames.get(pair.second_id) ?? String(pair.second_id),
        shared: pair.shared, union: pair.union, percentage: pair.percentage
      }));

    const sources = data.source_turnover;
    this.turnoverData = {
      labels: [this.range(data.previous_range, false), 'Fechas elegidas'],
      datasets: [
        { label: 'En ambos', data: [sources?.in_both ?? 0, sources?.in_both ?? 0], backgroundColor: '#6045c7' },
        { label: 'Solo en los días previos', data: [sources?.only_previous ?? 0, null], backgroundColor: '#a65b34' },
        { label: 'Solo en las fechas elegidas', data: [null, sources?.only_current ?? 0], backgroundColor: '#386fb7' }
      ]
    };
  }

  percentage(amount: number, total: number): number | null {
    return total ? 100 * amount / total : null;
  }
}
