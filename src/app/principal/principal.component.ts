import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';
import { Component, LOCALE_ID, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { ApiService } from '../services/api.service';
import { DashboardActivityDay, HomePageResponse } from '../interfaces/homePage';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';

registerLocaleData(localeEsBo);

interface PrincipalStatsVM {
  totalHoy: number;
  positivas: number;
  neutras: number;
  negativas: number;
  categoriaTop: string;
  topEntidades: TopEntidadVM[];
  topicosDia: TopicDay[];
  topicosSemana: TopicWeek[];
}

export interface TopEntidadVM {
  entidad: string;
  total: number;
}

export interface TopicWeek {
  topic_id: number;
  topic_name: string;
  tweets_actual: number;
  tweets_anterior: number;
  tendencia: string;
  diferencia: string | number;
  porcentaje?: number;
}

export interface TopicDay {
  topic_id: number;
  topic_name: string;
  tweets_hoy: number;
  tweets_ayer: number;
  tendencia: string;
  diferencia: string | number;
  porcentaje?: number;
}

interface InsightVM {
  topic: TopicDay;
  delta: number;
}

@Component({
  selector: 'app-principal',
  templateUrl: './principal.component.html',
  styleUrls: ['../topics/topic-layout.css', './principal.component.css'],
  providers: [{ provide: LOCALE_ID, useValue: 'es-BO' }]
})
export class PrincipalComponent implements OnInit {

  todayLabel = '';
  private totalNuevosTopicos?: number;
  radarOverview?: { watches: number; pending: number };

  stats: PrincipalStatsVM = this.emptyStats();

  topicosDia: TopicDay[] = [];
  topicosSemana: TopicWeek[] = [];

  users: users[] = [];

  // =========================================================
  // GRÁFICA
  // =========================================================

  activity: DashboardActivityDay[] = [];
  selectedDay?: DashboardActivityDay;
  activityTotal = 0;
  activityScale = 1;
  dayPosts: NewsItem[] = [];
  dayPostsOpen = false;
  dayPostsLoading = false;
  dayPostsError = false;
  dayPostsPage = 1;
  readonly dayPostsPageSize = 5;
  private dayPostsRequest = 0;
  private readonly activityDate = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short'
  });

  // =========================================================
  // UI
  // =========================================================

  private readonly summaryDate = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'
  });

  cargando = false;
  error = '';
  readonly topicPreviewSize = 5;
  showAllTopics = false;

  activeTopicTab: 'dia' | 'semana' = 'dia';

  constructor(private apiService: ApiService) {}

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadUsers();
    this.apiService.getRadarOverview().subscribe({
      next: overview => { this.radarOverview = overview; },
      error: () => { this.radarOverview = undefined; }
    });
  }

  // =========================================================
  // USUARIOS
  // =========================================================

  loadUsers(): void {
    this.cargando = true;
    this.error = '';

    this.apiService.getUsers2('Medio').subscribe({

      next: (data) => {

        this.users = Array.isArray(data)
          ? data
          : [];

        if (this.users.length === 0) {
          this.cargando = false;
          this.todayLabel = '';
          return;
        }

        const ids = this.users.map(
          user => String(user.idTweetUser)
        );

        this.loadMainStats(ids);
      },

      error: () => {
        this.cargando = false;
        this.error = 'No se pudieron cargar los medios';
      }

    });
  }

  // =========================================================
  // CARGA PRINCIPAL
  // =========================================================

  private loadMainStats(users?: string[]): void {

    this.cargando = true;
    this.error = '';

    this.apiService
      .getMainPageStats(users)
      .pipe(
        finalize(() => {
          this.cargando = false;
        })
      )
      .subscribe({

        next: (res: HomePageResponse) => {
          const daily = res?.daily;

          this.todayLabel = daily?.fecha ?? '';
          this.totalNuevosTopicos = daily?.nuevos_topicos;

          const topicsDiaRaw = Array.isArray(daily?.topics_dia)
            ? daily.topics_dia
            : [];

          const topicsSemanaRaw = Array.isArray(daily?.topics_semana)
            ? daily.topics_semana
            : [];

          this.topicosDia = topicsDiaRaw.map((topic: any) => ({
            topic_id: this.toNumber(topic?.topic_id),
            topic_name: topic?.topic_name ?? 'Sin nombre',
            tweets_hoy: this.toNumber(topic?.tweets_hoy),
            tweets_ayer: this.toNumber(topic?.tweets_ayer),
            tendencia: topic?.tendencia ?? 'IGUAL',
            diferencia: topic?.diferencia ?? 0,
            porcentaje: this.toNumber(topic?.porcentaje)
          }));

          this.topicosSemana = topicsSemanaRaw.map((topic: any) => ({
            topic_id: this.toNumber(topic?.topic_id),
            topic_name: topic?.topic_name ?? 'Sin nombre',
            tweets_actual: this.toNumber(topic?.tweets_actual),
            tweets_anterior: this.toNumber(topic?.tweets_anterior),
            tendencia: topic?.tendencia ?? 'IGUAL',
            diferencia: topic?.diferencia ?? 0,
            porcentaje: this.toNumber(topic?.porcentaje)
          }));

          this.stats = {

            totalHoy: this.toNumber(
              daily?.total_noticias
            ),

            positivas: this.toNumber(
              daily?.sentimientos?.positivo
            ),

            neutras: this.toNumber(
              daily?.sentimientos?.neutro
            ),

            negativas: this.toNumber(
              daily?.sentimientos?.negativo
            ),

            categoriaTop:
              (daily?.top_categoria ?? '—').trim() || '—',

            topEntidades: Array.isArray(daily?.top_3_entidades)
              ? daily.top_3_entidades.map((entidad: any) => ({
                  entidad: entidad?.entidad ?? '—',
                  total: this.toNumber(entidad?.total)
                }))
              : [],

            topicosDia: this.topicosDia,

            topicosSemana: this.topicosSemana
          };

          const totalByDate = new Map((res.last_7_days ?? []).map(day => [day.fecha, day.total]));
          const today = Date.parse(this.todayLabel);
          const legacyDays = Number.isFinite(today)
            ? Array.from({ length: 7 }, (_, index) => {
                const fecha = new Date(today - (6 - index) * 86400000).toISOString().slice(0, 10);
                return { fecha, total: this.toNumber(totalByDate.get(fecha)), parcial: index === 6, temas: [] };
              })
            : [];
          this.setActivity(res.activity ?? legacyDays);
        },

        error: () => {

          this.error =
            'No se pudo cargar el resumen de hoy';

          this.todayLabel = '';

          this.stats = this.emptyStats();

          this.topicosDia = [];
          this.topicosSemana = [];

          this.setActivity([]);
        }

      });
  }

  // =========================================================
  // HERO / TEMA PRINCIPAL
  // =========================================================

  get temaPrincipal(): TopicDay | null {

    if (!this.topicosDia.length) {
      return null;
    }

    const temasValidos = this.topicosDia.filter(
      topic => !this.esTopicoEspecial(topic.topic_name)
    );

    if (!temasValidos.length) {
      return this.topicosDia[0];
    }

    return [...temasValidos].sort(
      (a, b) => b.tweets_hoy - a.tweets_hoy
    )[0];
  }

  // =========================================================
  // KPI
  // =========================================================

  get nuevosTopicosHoy(): number {
    return this.totalNuevosTopicos ?? this.topicosDia.filter(
      topic => topic.tendencia === 'NUEVO'
    ).length;
  }

  get newTopicParams() {
    return {
      vista: 'nuevos',
      fecha: this.todayLabel,
      medios: this.users.map(user => String(user.idTweetUser)).join(',')
    };
  }

  get totalSentimientos(): number {
    return (
      this.stats.positivas +
      this.stats.neutras +
      this.stats.negativas
    );
  }

  readonly sentiments = [
    { kind: 'positive', label: 'Positivo', key: 'positivas' },
    { kind: 'neutral', label: 'Neutro', key: 'neutras' },
    { kind: 'negative', label: 'Negativo', key: 'negativas' }
  ] as const;

  // =========================================================
  // ENTIDADES
  // =========================================================

  get topEntidades(): TopEntidadVM[] {

    return Array.isArray(this.stats?.topEntidades)
      ? this.stats.topEntidades
      : [];
  }

  get maxEntidadTotal(): number {

    if (!this.topEntidades.length) {
      return 1;
    }

    return Math.max(
      ...this.topEntidades.map(
        item => item.total
      ),
      1
    );
  }

  getEntidadWidth(total: number): number {
    return total / this.maxEntidadTotal * 100;
  }

  // =========================================================
  // TÓPICOS
  // =========================================================

  get topicsActivos(): Array<TopicDay | TopicWeek> {

    return this.activeTopicTab === 'dia'
      ? this.topicosDia
      : this.topicosSemana;
  }

  cambiarTabTopicos(
    tipo: 'dia' | 'semana'
  ): void {

    if (this.activeTopicTab !== tipo) {
      this.activeTopicTab = tipo;
      this.showAllTopics = false;
    }
  }

  getTopicActual(
    topic: TopicDay | TopicWeek
  ): number {

    if (this.isTopicDay(topic)) {
      return topic.tweets_hoy;
    }

    return topic.tweets_actual;
  }

  getTopicAnterior(
    topic: TopicDay | TopicWeek
  ): number {

    if (this.isTopicDay(topic)) {
      return topic.tweets_ayer;
    }

    return topic.tweets_anterior;
  }

  private isTopicDay(
    topic: TopicDay | TopicWeek
  ): topic is TopicDay {

    return 'tweets_hoy' in topic;
  }

  // =========================================================
  // INSIGHTS
  // =========================================================

  get insights(): InsightVM[] {
    return this.topicosDia
      .filter(topic => !this.esTopicoEspecial(topic.topic_name) &&
        Math.max(topic.tweets_hoy, topic.tweets_ayer) >= 5 &&
        topic.tweets_hoy !== topic.tweets_ayer)
      .map(topic => ({ topic, delta: topic.tweets_hoy - topic.tweets_ayer }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
  }

  private setActivity(days: DashboardActivityDay[]): void {
    this.activity = days;
    this.activityTotal = days.reduce((total, day) => total + day.total, 0);
    this.activityScale = Math.max(1, ...days.map(day => day.total));
    this.selectActivityDay(days.find(day => day.fecha === this.todayLabel) ?? days[days.length - 1]);
  }

  formatSummaryDate(date: string): string {
    return this.summaryDate.format(new Date(date));
  }

  formatActivityDate(date: string): string {
    return this.activityDate.format(new Date(date));
  }

  selectActivityDay(day?: DashboardActivityDay): void {
    this.selectedDay = day;
    this.dayPostsRequest++;
    this.dayPostsOpen = false;
    this.dayPostsLoading = false;
    this.dayPostsError = false;
    this.dayPostsPage = 1;
    this.dayPosts = [];
  }

  loadDayPosts(page = 1): void {
    const day = this.selectedDay;
    if (!day?.total) return;

    const request = ++this.dayPostsRequest;
    this.dayPostsOpen = true;
    this.dayPostsLoading = true;
    this.dayPostsError = false;
    this.dayPostsPage = page;
    this.dayPosts = [];
    this.apiService.getDashboardDayPosts(
      day.fecha, this.users.map(user => String(user.idTweetUser)), page, this.dayPostsPageSize
    ).subscribe({
      next: response => {
        if (request !== this.dayPostsRequest) return;
        this.dayPosts = response.resultado ?? [];
        this.dayPostsLoading = false;
      },
      error: () => {
        if (request !== this.dayPostsRequest) return;
        this.dayPostsError = true;
        this.dayPostsLoading = false;
      }
    });
  }

  closeDayPosts(): void {
    this.selectActivityDay(this.selectedDay);
  }

  get hasMoreDayPosts(): boolean {
    return this.dayPosts.length === this.dayPostsPageSize &&
      this.dayPostsPage * this.dayPostsPageSize < (this.selectedDay?.total ?? 0);
  }

  private emptyStats(): PrincipalStatsVM {

    return {
      totalHoy: 0,
      positivas: 0,
      neutras: 0,
      negativas: 0,
      categoriaTop: '—',
      topEntidades: [],
      topicosDia: [],
      topicosSemana: []
    };
  }

  private toNumber(
    value: unknown
  ): number {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  absPercent(value: number): number {
    return Math.abs(value);
  }

  private esTopicoEspecial(
    name: string
  ): boolean {

    return (
      name?.startsWith('__') &&
      name?.endsWith('__')
    );
  }

  trackByIndex = (
    index: number
  ): number => index;

  trackByTopic = (
    _: number,
    topic: TopicDay | TopicWeek
  ): number => topic.topic_id;

  // =========================================================
  // NAVEGACIÓN
  // =========================================================

  topicDetailParams(date: string | null) {
    const medios = this.users.map(user => String(user.idTweetUser)).join(',');
    return date ? { fecha: date, medios } : { periodo: 'todo', medios };
  }
}
