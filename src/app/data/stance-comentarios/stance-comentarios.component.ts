import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../services/api.service';
import { users } from '../../interfaces/users';
import {
  StanceAnalysisType,
  StanceFilters,
  StanceSource,
  StanceSummary,
  StanceTimelineRow,
  StanceTopic,
  StanceValue,
  TimelineInterval
} from '../../interfaces/stance';

const EMPTY_SUMMARY: StanceSummary = {
  total: 0,
  processed: 0,
  pending: 0,
  not_applicable: 0,
  coverage_percent: 0,
  avg_confidence: null,
  distribution: { FAVOR: 0, CONTRA: 0, MIXTO: 0, NEUTRAL: 0, NO_CLARO: 0 },
  percentages: { FAVOR: 0, CONTRA: 0, MIXTO: 0, NEUTRAL: 0, NO_CLARO: 0 }
};

@Component({
  selector: 'app-stance-comentarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stance-comentarios.component.html',
  styleUrls: ['./stance-comentarios.component.css']
})
export class StanceComentariosComponent implements OnChanges, OnDestroy {
  // Se reutilizan los filtros superiores de Estadísticas.
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;
  @Input() selectedUsers: string[] = [];
  @Input() selectedTopics: number[] = [];
  @Input() searchText = '';
  @Input() users: users[] = [];
  @Input() categoria = '';
  @Input() type_user: 'Medio' | 'Persona' | 'Entidad' | null = null;
  @Input() fallbackEndToStart = false;

  readonly stances: StanceValue[] = [
    'FAVOR', 'CONTRA', 'MIXTO', 'NEUTRAL', 'NO_CLARO'
  ];

  readonly labels: Record<StanceValue, string> = {
    FAVOR: 'A favor',
    CONTRA: 'En contra',
    MIXTO: 'Mixto',
    NEUTRAL: 'Neutral',
    NO_CLARO: 'No claro'
  };

  readonly colors: Record<StanceValue, string> = {
    FAVOR: '#16a34a',
    CONTRA: '#dc2626',
    MIXTO: '#d97706',
    NEUTRAL: '#64748b',
    NO_CLARO: '#a78bfa'
  };

  readonly intervals: TimelineInterval[] = ['1h', '3h', '6h', '12h', '1d'];

  analysisType: StanceAnalysisType = 'post';
  interval: TimelineInterval = '1d';

  loadingDashboard = false;
  error = '';
  topicsError = '';

  summary: StanceSummary = this.emptySummary();
  timeline: StanceTimelineRow[] = [];
  sources: StanceSource[] = [];
  topicRanking: StanceTopic[] = [];
  totalEligibleTopics = 0;

  private dashboardSub?: Subscription;

  constructor(private api: ApiService) {}

  // El padre solo renderiza el componente para usuarios Pro / administradores;
  // las rutas del backend también validan el plan.
  ngOnChanges(_changes: SimpleChanges): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.dashboardSub?.unsubscribe();
  }

  private emptySummary(): StanceSummary {
    return {
      ...EMPTY_SUMMARY,
      distribution: { ...EMPTY_SUMMARY.distribution },
      percentages: { ...EMPTY_SUMMARY.percentages }
    };
  }

  private get effectiveUsers(): string[] {
    return (this.selectedUsers?.length
      ? this.selectedUsers
      : (this.users ?? []).map(user => String(user.idTweetUser)))
      .map(String)
      .filter(Boolean);
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private baseFilters(analysisType: StanceAnalysisType = this.analysisType): StanceFilters {
    const filters: StanceFilters = {
      analysisType,
      users: this.effectiveUsers,
      topic_ids: [...(this.selectedTopics ?? [])],
      search: this.searchText?.trim() || undefined,
      timeline_interval: this.interval
    };

    if (this.startDate) filters.start = this.formatDate(this.startDate);
    if (this.endDate) filters.end = this.formatDate(this.endDate);
    else if (this.fallbackEndToStart && this.startDate) {
      filters.end = this.formatDate(this.startDate);
    }

    const category = (this.categoria ?? '').trim();
    if (category && category.toLowerCase() !== 'none') {
      filters.categoria = category;
    }
    if (this.type_user) filters.type_user = this.type_user;

    return filters;
  }

  reload(): void {
    this.dashboardSub?.unsubscribe();
    this.error = '';
    this.topicsError = '';

    if (!this.startDate || !this.effectiveUsers.length) {
      this.loadingDashboard = false;
      this.summary = this.emptySummary();
      this.timeline = [];
      this.sources = [];
      this.topicRanking = [];
      this.totalEligibleTopics = 0;
      return;
    }

    this.loadingDashboard = true;
    const filters = this.baseFilters();

    // El ranking usa siempre stance POR TÓPICO, incluso cuando los indicadores
    // superiores están en modo POR PUBLICACIÓN. No mezclamos los resultados.
    const topicFilters: StanceFilters = {
      ...this.baseFilters('topic'),
      page: 1,
      limit: 10
    };

    this.dashboardSub = forkJoin({
      resumen: this.api.getStanceResumen(filters).pipe(catchError(() => of(null))),
      timeline: this.api.getStanceTimeline(filters).pipe(catchError(() => of(null))),
      fuentes: this.api.getStanceFuentes(filters).pipe(catchError(() => of(null))),
      topicos: this.api.getStanceTopicos(topicFilters).pipe(catchError(() => of(null)))
    }).subscribe({
      next: data => {
        this.summary = data.resumen?.summary ?? this.emptySummary();
        this.timeline = data.timeline?.timeline ?? [];
        this.sources = data.fuentes?.sources ?? [];
        this.topicRanking = data.topicos?.topics?.items ?? [];
        this.totalEligibleTopics = data.topicos?.topics?.total ?? 0;

        if (!data.topicos) {
          this.topicsError = 'No se pudo consultar el ranking de tópicos.';
        }
        if (!data.resumen || !data.timeline || !data.fuentes) {
          this.error = 'Algunos indicadores no pudieron cargarse. Intenta actualizar.';
        }
        this.loadingDashboard = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el análisis de posturas.';
        this.loadingDashboard = false;
      }
    });
  }

  setAnalysisType(type: StanceAnalysisType): void {
    if (this.analysisType === type) return;
    this.analysisType = type;
    this.reload();
  }

  changeInterval(): void {
    this.reload();
  }

  get maxTimeline(): number {
    return Math.max(1, ...this.timeline.map(row => Number(row.total) || 0));
  }

  get leadingStance(): { label: string; percentage: number } | null {
    if (!this.summary.processed) return null;
    const first = this.stances.reduce((best, candidate) =>
      this.summary.distribution[candidate] > this.summary.distribution[best]
        ? candidate
        : best
    , this.stances[0]);
    return {
      label: this.labels[first],
      percentage: Number(this.summary.percentages[first]) || 0
    };
  }

  topicTotal(topic: StanceTopic): number {
    return Number(topic.stance_summary?.total) || 0;
  }

  topicProcessed(topic: StanceTopic): number {
    return Number(topic.stance_summary?.processed) || 0;
  }

  trackByTopic(_index: number, topic: StanceTopic): number {
    return topic.topic_id;
  }
}
