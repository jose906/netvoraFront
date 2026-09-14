import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Router } from '@angular/router';

import { ApiService } from '../services/api.service';
import { HomePageResponse } from '../interfaces/homePage';
import { users } from '../interfaces/users';

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

interface WeekBar {
  x: number;
  w: number;
  y: number;
  h: number;
  v: number;
  fecha: string;
  cls: 'pos' | 'neg' | 'zero';
}

interface InsightVM {
  icon: 'up' | 'down' | 'new' | 'neutral';
  title: string;
  description: string;
}

@Component({
  selector: 'app-principal',
  templateUrl: './principal.component.html',
  styleUrls: ['./principal.component.css']
})
export class PrincipalComponent implements OnInit {

  todayLabel = '';

  stats: PrincipalStatsVM = this.emptyStats();

  last7Days: HomePageResponse['last_7_days'] = [];

  topicosDia: TopicDay[] = [];
  topicosSemana: TopicWeek[] = [];

  users: users[] = [];

  // =========================================================
  // GRÁFICA
  // =========================================================

  weekBars: WeekBar[] = [];
  weekLabels: string[] = [];

  weekZeroY = 20;

  weekDomainMin = 0;
  weekDomainMax = 0;

  weekMax = 0;
  weekMin = 0;
  weekAvg = 0;

  // =========================================================
  // UI
  // =========================================================

  cargando = false;
  error = '';

  showNoUsersModal = false;

  showTopicsModal = false;
  tipoTopicosModal: 'dia' | 'semana' = 'dia';

  activeTopicTab: 'dia' | 'semana' = 'dia';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadUsers();
  }

  // =========================================================
  // USUARIOS
  // =========================================================

  loadUsers(): void {

    this.apiService.getUsers2('Medio').subscribe({

      next: (data) => {

        this.users = Array.isArray(data)
          ? data
          : [];

        if (this.users.length === 0) {
          this.showNoUsersModal = true;
          return;
        }

        const ids = this.users.map(
          user => String(user.idTweetUser)
        );

        this.loadMainStats(ids);
      },

      error: () => {
        this.error = 'No se pudieron cargar los usuarios.';
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

          this.last7Days = Array.isArray(res?.last_7_days)
            ? res.last_7_days
            : [];

          this.buildWeekBarChart(this.last7Days);
        },

        error: () => {

          this.error =
            'No se pudo cargar el resumen de hoy.';

          this.todayLabel = '';

          this.stats = this.emptyStats();

          this.topicosDia = [];
          this.topicosSemana = [];

          this.last7Days = [];

          this.resetWeekChart();
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

  get heroTrendText(): string {

    const topic = this.temaPrincipal;

    if (!topic) {
      return 'Sin actividad disponible';
    }

    switch (topic.tendencia) {

      case 'SUBIO':
        return topic.porcentaje
          ? `Subió ${this.formatPercent(topic.porcentaje)}%`
          : 'Está creciendo';

      case 'BAJO':
        return topic.porcentaje
          ? `Bajó ${this.formatPercent(topic.porcentaje)}%`
          : 'Está disminuyendo';

      case 'NUEVO':
        return 'Nuevo tema detectado';

      default:
        return 'Actividad estable';
    }
  }

  // =========================================================
  // KPI
  // =========================================================

  get nuevosTopicosHoy(): number {
    return this.topicosDia.filter(
      topic => topic.tendencia === 'NUEVO'
    ).length;
  }

  get totalSentimientos(): number {
    return (
      this.stats.positivas +
      this.stats.neutras +
      this.stats.negativas
    );
  }

  get porcentajePositivo(): number {
    return this.getSentimentPercentage(
      this.stats.positivas
    );
  }

  get porcentajeNeutro(): number {
    return this.getSentimentPercentage(
      this.stats.neutras
    );
  }

  get porcentajeNegativo(): number {
    return this.getSentimentPercentage(
      this.stats.negativas
    );
  }

  get sentimientoDominante(): string {

    const values = [
      {
        label: 'Positivo',
        value: this.stats.positivas
      },
      {
        label: 'Neutral',
        value: this.stats.neutras
      },
      {
        label: 'Negativo',
        value: this.stats.negativas
      }
    ];

    values.sort(
      (a, b) => b.value - a.value
    );

    if (!values[0]?.value) {
      return 'Sin datos';
    }

    return values[0].label;
  }

  get sentimientoDominantePorcentaje(): number {

    return Math.max(
      this.porcentajePositivo,
      this.porcentajeNeutro,
      this.porcentajeNegativo
    );
  }

  private getSentimentPercentage(
    value: number
  ): number {

    if (!this.totalSentimientos) {
      return 0;
    }

    return Math.round(
      (value / this.totalSentimientos) * 100
    );
  }

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
    return Math.max(
      8,
      (total / this.maxEntidadTotal) * 100
    );
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

    this.activeTopicTab = tipo;
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

  getTopicAnteriorLabel(): string {
    return this.activeTopicTab === 'dia'
      ? 'ayer'
      : 'semana anterior';
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

    const items: InsightVM[] = [];

    const topicUp = this.topicosDia
      .filter(
        topic =>
          topic.tendencia === 'SUBIO' &&
          !this.esTopicoEspecial(topic.topic_name)
      )
      .sort(
        (a, b) =>
          (b.porcentaje ?? 0) -
          (a.porcentaje ?? 0)
      )[0];

    if (topicUp) {

      items.push({
        icon: 'up',
        title: `${topicUp.topic_name} está creciendo`,
        description: topicUp.porcentaje
          ? `La actividad aumentó ${this.formatPercent(topicUp.porcentaje)}% respecto a ayer.`
          : `Registra más publicaciones que ayer.`
      });
    }

    const topicNew = this.topicosDia.find(
      topic =>
        topic.tendencia === 'NUEVO' &&
        !this.esTopicoEspecial(topic.topic_name)
    );

    if (topicNew) {

      items.push({
        icon: 'new',
        title: `Nuevo tema: ${topicNew.topic_name}`,
        description:
          `Apareció hoy con ${topicNew.tweets_hoy} publicaciones detectadas.`
      });
    }

    const topicDown = this.topicosDia
      .filter(
        topic =>
          topic.tendencia === 'BAJO' &&
          !this.esTopicoEspecial(topic.topic_name)
      )
      .sort(
        (a, b) =>
          (b.porcentaje ?? 0) -
          (a.porcentaje ?? 0)
      )[0];

    if (topicDown && items.length < 3) {

      items.push({
        icon: 'down',
        title: `${topicDown.topic_name} pierde actividad`,
        description: topicDown.porcentaje
          ? `La conversación disminuyó ${this.formatPercent(topicDown.porcentaje)}% respecto a ayer.`
          : `Registra menos actividad que ayer.`
      });
    }

    if (items.length < 3) {

      items.push({
        icon: 'neutral',
        title: `${this.sentimientoDominante} es el tono predominante`,
        description:
          `${this.sentimientoDominantePorcentaje}% de las publicaciones analizadas corresponden al sentimiento dominante.`
      });
    }

    return items.slice(0, 3);
  }

  // =========================================================
  // GRÁFICA
  // =========================================================

  private buildWeekBarChart(
    days: HomePageResponse['last_7_days']
  ): void {

    const safeDays =
      Array.isArray(days)
        ? days
        : [];

    if (!safeDays.length) {
      this.resetWeekChart();
      return;
    }

    this.weekLabels = safeDays.map(
      day => day.fecha ?? '—'
    );

    const values = safeDays.map(
      day => this.toNumber(day.indice)
    );

    const maxV = Math.max(...values);
    const minV = Math.min(...values);

    const avgV =
      values.reduce(
        (acc, value) => acc + value,
        0
      ) / values.length;

    this.weekMax = maxV;
    this.weekMin = minV;
    this.weekAvg = avgV;

    const domainMin = Math.min(
      minV,
      0
    );

    const domainMax = Math.max(
      maxV,
      0
    );

    this.weekDomainMin = domainMin;
    this.weekDomainMax = domainMax;

    const yTop = 6;
    const yBot = 34;

    const yRange =
      yBot - yTop;

    const denom =
      domainMax - domainMin === 0
        ? 1
        : domainMax - domainMin;

    const mapY = (
      value: number
    ): number => {

      const t =
        (value - domainMin) / denom;

      return +(
        yBot -
        t * yRange
      ).toFixed(2);
    };

    const zeroY = mapY(0);

    this.weekZeroY = zeroY;

    const n = values.length;

    const gap = 2;

    const totalGap =
      gap * (n + 1);

    const width =
      Math.max(
        6,
        (100 - totalGap) / n
      );

    const bars: WeekBar[] = [];

    for (let i = 0; i < n; i++) {

      const value = values[i];

      const valueY = mapY(value);

      const y = Math.min(
        zeroY,
        valueY
      );

      let height = Math.abs(
        zeroY - valueY
      );

      // Hace visible un valor 0
      if (height === 0) {
        height = 0.7;
      }

      const x = +(
        gap +
        i * (width + gap)
      ).toFixed(2);

      const cls: WeekBar['cls'] =
        value > 0
          ? 'pos'
          : value < 0
            ? 'neg'
            : 'zero';

      bars.push({
        x,
        w: +width.toFixed(2),
        y,
        h: +height.toFixed(2),
        v: value,
        fecha:
          this.weekLabels[i] || '—',
        cls
      });
    }

    this.weekBars = bars;
  }

  get weekTrendDescription(): string {

    if (!this.weekBars.length) {
      return 'Todavía no hay suficientes datos.';
    }

    const first =
      this.weekBars[0]?.v ?? 0;

    const last =
      this.weekBars[
        this.weekBars.length - 1
      ]?.v ?? 0;

    const diff =
      last - first;

    if (diff > 0.05) {
      return 'La percepción general mejoró durante los últimos 7 días.';
    }

    if (diff < -0.05) {
      return 'La percepción general se volvió más negativa durante los últimos 7 días.';
    }

    return 'La percepción general se mantuvo relativamente estable durante los últimos 7 días.';
  }

  get weekStatus(): string {

    if (this.weekAvg > 0.1) {
      return 'Tendencia positiva';
    }

    if (this.weekAvg < -0.1) {
      return 'Tendencia negativa';
    }

    return 'Tendencia estable';
  }

  // =========================================================
  // HELPERS
  // =========================================================

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

  private formatPercent(
    value: number
  ): string {

    return Math.abs(value)
      .toFixed(0);
  }

  private esTopicoEspecial(
    name: string
  ): boolean {

    return (
      name?.startsWith('__') &&
      name?.endsWith('__')
    );
  }

  private resetWeekChart(): void {

    this.weekBars = [];
    this.weekLabels = [];

    this.weekZeroY = 20;

    this.weekDomainMin = 0;
    this.weekDomainMax = 0;

    this.weekMax = 0;
    this.weekMin = 0;
    this.weekAvg = 0;
  }

  trackByIndex = (
    index: number
  ): number => index;

  trackByTopic = (
    _: number,
    topic: TopicDay | TopicWeek
  ): number => topic.topic_id;

  trackByBar = (
    _: number,
    bar: WeekBar
  ): string =>
    `${bar.x}-${bar.v}-${bar.fecha}`;

  // =========================================================
  // NAVEGACIÓN
  // =========================================================

  irAUsuarios(): void {
    this.router.navigate(['/settings']);
  }

  abrirTopicos(
    tipo: 'dia' | 'semana'
  ): void {

    this.tipoTopicosModal = tipo;
    this.showTopicsModal = true;
  }

  cerrarTopicos(): void {
    this.showTopicsModal = false;
  }

  irATopico(
    topic: TopicDay | TopicWeek
  ): void {

    this.router.navigate(
      ['/topics', topic.topic_id],
      {
        state: {
          topic_id: topic.topic_id,
          topic_name: topic.topic_name
        }
      }
    );
  }
}