import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

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

type TimelineDisplay = 'volume' | 'share';
type TopicSort = 'volume' | 'coverage' | 'favor' | 'contra';
type SourceSort = 'processed' | 'coverage' | 'favor' | 'contra';

const ZERO_DISTRIBUTION: Record<StanceValue, number> = {
  FAVOR: 0, CONTRA: 0, MIXTO: 0, NEUTRAL: 0, NO_CLARO: 0
};

@Component({
  selector: 'app-stance-comentarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stance-comentarios.component.html',
  styleUrls: ['./stance-comentarios.component.css']
})
export class StanceComentariosComponent implements OnInit, OnChanges, OnDestroy {
  // Conserva los filtros del componente padre y la firma de ApiService existente.
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;
  @Input() selectedUsers: string[] = [];
  @Input() selectedTopics: number[] = [];
  @Input() searchText = '';
  @Input() users: users[] = [];
  @Input() categoria = '';
  @Input() type_user: 'Medio' | 'Persona' | 'Entidad' | null = null;
  @Input() fallbackEndToStart = false;

  readonly stances: StanceValue[] = ['FAVOR', 'CONTRA', 'MIXTO', 'NEUTRAL', 'NO_CLARO'];
  readonly labels: Record<StanceValue, string> = {
    FAVOR: 'A favor',
    CONTRA: 'En contra',
    MIXTO: 'Mixto',
    NEUTRAL: 'Neutral',
    NO_CLARO: 'No claro'
  };
  readonly colors: Record<StanceValue, string> = {
    FAVOR: '#16a34a',
    CONTRA: '#e05252',
    MIXTO: '#e2a63a',
    NEUTRAL: '#8290a6',
    NO_CLARO: '#9276cb'
  };
  readonly intervals: TimelineInterval[] = ['1h', '3h', '6h', '12h', '1d'];
  readonly skeletonItems = [1, 2, 3, 4];

  analysisType: StanceAnalysisType = 'post';
  interval: TimelineInterval = '1d';
  timelineDisplay: TimelineDisplay = 'volume';
  topicSort: TopicSort = 'volume';
  sourceSort: SourceSort = 'processed';
  sourceQuery = '';
  topicQuery = '';
  expandedTopicId: number | null = null;

  loadingSummary = false;
  loadingSources = false;
  loadingTopics = false;
  loadingTimeline = false;
  error = '';
  topicsError = '';
  sourcesError = '';
  timelineError = '';
  lastUpdated: Date | null = null;

  summary: StanceSummary = this.emptySummary();
  timeline: StanceTimelineRow[] = [];
  sources: StanceSource[] = [];
  topicRanking: StanceTopic[] = [];
  totalEligibleTopics = 0;

  private summarySub?: Subscription;
  private sourcesSub?: Subscription;
  private topicsSub?: Subscription;
  private timelineSub?: Subscription;
  private filtersSub?: Subscription;
  private readonly filtersChanged$ = new Subject<void>();
  private initialized = false;
  private destroyed = false;
  private timelineMax = 1;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  // No se bloquean todos los paneles por la consulta más lenta.
  get loadingDashboard(): boolean {
    return this.loadingSummary || this.loadingSources || this.loadingTopics;
  }

  // Refresca explícitamente la vista, incluso cuando una respuesta del servicio
  // se resuelve fuera de NgZone (o la app utiliza detección de cambios zoneless).
  private applyAsync(update: () => void): void {
    if (this.destroyed) return;
    this.ngZone.run(() => {
      update();
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    // Agrupa cambios consecutivos del padre (por ejemplo, al escribir una búsqueda).
    this.filtersSub = this.filtersChanged$.pipe(debounceTime(250))
      .subscribe(() => this.applyAsync(() => this.reload()));
    this.reload();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    // Angular llama ngOnChanges antes de ngOnInit en la primera renderización.
    if (this.initialized) this.filtersChanged$.next();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.filtersSub?.unsubscribe();
    this.summarySub?.unsubscribe();
    this.sourcesSub?.unsubscribe();
    this.topicsSub?.unsubscribe();
    this.timelineSub?.unsubscribe();
  }

  private emptySummary(): StanceSummary {
    return {
      total: 0,
      processed: 0,
      pending: 0,
      not_applicable: 0,
      coverage_percent: 0,
      avg_confidence: null,
      distribution: { ...ZERO_DISTRIBUTION },
      percentages: { ...ZERO_DISTRIBUTION }
    };
  }

  private get effectiveUsers(): string[] {
    // Cuando el usuario no ha seleccionado cuentas explícitamente, se usan todas
    // las recibidas del padre, igual que en el componente original.
    const ids = this.selectedUsers?.length
      ? this.selectedUsers
      : (this.users ?? []).map(user => String(user.idTweetUser));
    return [...new Set(ids.map(String).filter(Boolean))];
  }

  get isReady(): boolean {
    return !!this.startDate && this.effectiveUsers.length > 0;
  }

  get selectionMessage(): string {
    if (!this.startDate) return 'Selecciona una fecha de inicio en los filtros superiores.';
    if (!this.effectiveUsers.length) return 'Selecciona al menos una cuenta o espera a que se cargue la lista de fuentes.';
    return '';
  }

  get periodLabel(): string {
    if (!this.startDate) return 'Sin período seleccionado';
    const start = this.formatDate(this.startDate);
    const end = this.endDate
      ? this.formatDate(this.endDate)
      : (this.fallbackEndToStart ? start : 'fin no especificado');
    return start === end ? start : `${start} — ${end}`;
  }

  get sourceCount(): number {
    return this.effectiveUsers.length;
  }

  private formatDate(date: Date): string {
    // Usa la fecha de calendario local, evitando toISOString() y su salto UTC.
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
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
    if (category && category.toLowerCase() !== 'none') filters.categoria = category;
    if (this.type_user) filters.type_user = this.type_user;
    return filters;
  }

  reload(refreshTopics = true): void {
    this.summarySub?.unsubscribe();
    this.sourcesSub?.unsubscribe();
    this.timelineSub?.unsubscribe();
    if (refreshTopics) this.topicsSub?.unsubscribe();

    this.error = '';
    this.sourcesError = '';
    this.timelineError = '';
    this.lastUpdated = null;
    this.expandedTopicId = null;
    this.summary = this.emptySummary();
    this.sources = [];
    this.timeline = [];
    this.timelineMax = 1;
    this.loadingSummary = false;
    this.loadingSources = false;
    this.loadingTimeline = false;

    // El ranking por tópico es independiente del selector Post / Tópico.
    // No se vuelve a consultar al alternar únicamente ese selector.
    if (refreshTopics) {
      this.topicsError = '';
      this.topicRanking = [];
      this.totalEligibleTopics = 0;
      this.loadingTopics = false;
    }

    if (!this.isReady) {
      // Si no hay filtros válidos, no debe quedar un ranking anterior visible.
      this.topicsSub?.unsubscribe();
      this.topicsError = '';
      this.topicRanking = [];
      this.totalEligibleTopics = 0;
      this.loadingTopics = false;
      return;
    }

    const filters = this.baseFilters();
    this.loadingSummary = true;
    this.loadingSources = true;

    // Cada sección se muestra al terminar SU petición, sin forkJoin.
    // El resumen ya no espera a un ranking de tópicos potencialmente costoso.
    this.summarySub = this.api.getStanceResumen(filters).subscribe({
      next: data => this.applyAsync(() => {
        this.summary = data?.summary ?? this.emptySummary();
        this.loadingSummary = false;
        this.lastUpdated = new Date();
      }),
      error: () => this.applyAsync(() => {
        this.error = 'No se pudo cargar el resumen. Vuelve a intentar la consulta.';
        this.loadingSummary = false;
      })
    });

    this.sourcesSub = this.api.getStanceFuentes(filters).subscribe({
      next: data => this.applyAsync(() => {
        this.sources = data?.sources ?? [];
        this.loadingSources = false;
        this.lastUpdated = new Date();
      }),
      error: () => this.applyAsync(() => {
        this.sourcesError = 'No se pudo cargar el desglose por fuente.';
        this.loadingSources = false;
      })
    });

    if (refreshTopics) {
      this.loadingTopics = true;
      const topicFilters: StanceFilters = {
        ...this.baseFilters('topic'),
        page: 1,
        limit: 10
      };
      this.topicsSub = this.api.getStanceTopicos(topicFilters).subscribe({
        next: data => this.applyAsync(() => {
          this.topicRanking = data?.topics?.items ?? [];
          this.totalEligibleTopics = data?.topics?.total ?? 0;
          this.loadingTopics = false;
          this.lastUpdated = new Date();
        }),
        error: () => this.applyAsync(() => {
          this.topicsError = 'No se pudo cargar el ranking por tópico.';
          this.loadingTopics = false;
        })
      });
    }

    this.loadTimeline();
  }

  setAnalysisType(type: StanceAnalysisType): void {
    if (this.analysisType === type) return;
    this.analysisType = type;
    this.reload(false); // reutiliza el ranking por tópico ya cargado
  }

  changeInterval(): void {
    // No vuelve a pedir resumen, fuentes ni tópicos: solo la línea temporal.
    this.loadTimeline();
  }

  loadTimeline(): void {
    this.timelineSub?.unsubscribe();
    this.timeline = [];
    this.timelineMax = 1;
    this.timelineError = '';
    this.loadingTimeline = false;
    if (!this.isReady) return;

    this.loadingTimeline = true;
    this.timelineSub = this.api.getStanceTimeline(this.baseFilters()).subscribe({
      next: data => this.applyAsync(() => {
        this.timeline = data?.timeline ?? [];
        // El máximo se calcula una vez, no una vez por cada barra renderizada.
        this.timelineMax = Math.max(1, ...this.timeline.map(row => Number(row.total) || 0));
        this.loadingTimeline = false;
      }),
      error: () => this.applyAsync(() => {
        this.timelineError = 'No se pudo cargar la evolución temporal.';
        this.loadingTimeline = false;
      })
    });
  }

  get maxTimeline(): number {
    return this.timelineMax;
  }

  timelineBarWidth(row: StanceTimelineRow): number {
    if (this.timelineDisplay === 'share') return Number(row.total) > 0 ? 100 : 0;
    return 100 * (Number(row.total) || 0) / this.maxTimeline;
  }

  timelineStanceWidth(row: StanceTimelineRow, stance: StanceValue): number {
    return Number(row.total) > 0
      ? 100 * (Number(row[stance]) || 0) / Number(row.total)
      : 0;
  }

  get leadingStance(): { key: StanceValue; label: string; percentage: number } | null {
    if (!this.summary.processed) return null;
    const first = this.stances.reduce((best, candidate) =>
      this.summary.distribution[candidate] > this.summary.distribution[best]
        ? candidate
        : best,
    this.stances[0]);
    return {
      key: first,
      label: this.labels[first],
      percentage: Number(this.summary.percentages[first]) || 0
    };
  }

  get sortedTopics(): StanceTopic[] {
    const query = this.topicQuery.trim().toLocaleLowerCase('es');
    const found = this.topicRanking.filter(topic =>
      !query || `${topic.topic_name} ${topic.main_target ?? ''}`.toLocaleLowerCase('es').includes(query)
    );
    return found.sort((a, b) => {
      const score = (topic: StanceTopic): number => {
        switch (this.topicSort) {
          case 'coverage': return Number(topic.stance_summary?.coverage_percent) || 0;
          case 'favor': return Number(topic.stance_summary?.percentages?.FAVOR) || 0;
          case 'contra': return Number(topic.stance_summary?.percentages?.CONTRA) || 0;
          default: return this.topicTotal(topic);
        }
      };
      return score(b) - score(a) || this.topicTotal(b) - this.topicTotal(a);
    });
  }

  get filteredSources(): StanceSource[] {
    const query = this.sourceQuery.trim().toLocaleLowerCase('es');
    return this.sources
      .filter(source => !query || String(source.source_name ?? '').toLocaleLowerCase('es').includes(query))
      .sort((a, b) => {
        const score = (source: StanceSource): number => {
          const sum = source.stance_summary;
          switch (this.sourceSort) {
            case 'coverage': return Number(sum?.coverage_percent) || 0;
            case 'favor': return Number(sum?.percentages?.FAVOR) || 0;
            case 'contra': return Number(sum?.percentages?.CONTRA) || 0;
            default: return Number(sum?.processed) || 0;
          }
        };
        return score(b) - score(a) ||
          String(a.source_name).localeCompare(String(b.source_name), 'es');
      });
  }

  toggleTopic(topicId: number): void {
    this.expandedTopicId = this.expandedTopicId === topicId ? null : topicId;
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

  trackBySource(_index: number, source: StanceSource): string {
    return String(source.source_name);
  }

  trackByStance(_index: number, stance: StanceValue): string {
    return stance;
  }

  trackByTimeline(index: number, row: StanceTimelineRow): string {
    return `${row.date}:${index}`;
  }
}
