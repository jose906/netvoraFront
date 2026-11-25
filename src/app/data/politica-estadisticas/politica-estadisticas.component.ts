import { formatStatisticsRange } from '../../estadisticas/statistics-insights';
import type { StatisticsInsightsComponent } from '../../estadisticas/statistics-insights.component';
import { statisticsBreakdownBars, statisticsChartOptions, statisticsRankingValues } from '../statistics-chart';
import { DashboardEvidenceComponent } from '../dashboard-evidence/dashboard-evidence.component';
import { DashboardSelection } from '../../interfaces/dashboard-evidence';
import { ElementRef, EventEmitter, Output } from '@angular/core';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  OnDestroy
} from '@angular/core';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { BaseChartDirective } from 'ng2-charts';
import { NETVORA_PALETTE, exportCanvasWithWhiteBg } from '../../utils/helpers';
import { users } from '../../interfaces/users';
import { UserRole } from '../../services/authz.service';
import { AccountService } from '../../services/account.service';
type TimelineInterval = '1h' | '3h' | '6h' | '12h' | '1d';
type EntItem = { entidad: string; total: number };
type TopUserItem = { usuario: string; total: number };
type UserIndiceItem = {
  TweetUser: string;
  pos: number;
  neg: number;
  total: number;
  indice: number; // 0..1 o 0..100 (lo normalizamos abajo)
};
type IndiceSentItem = {
  user: string;
  positivos: number;
  negativos: number;
  total: number;
  indice: number; // 0..1
};
interface TopicEntity {
  topic_id: number;
  topic_name: string;
  entidad: string;
  total: number;
}
type TopicEntityType =
  | 'persona'
  | 'organizacion'
  | 'locacion';
@Component({
  selector: 'app-politica-estadisticas',
  templateUrl: './politica-estadisticas.component.html',
  styleUrls: ['./politica-estadisticas.component.css', '../dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoliticaEstadisticasComponent implements OnChanges, OnDestroy {
  @Input() insights?: StatisticsInsightsComponent;

  readonly breakdownBars = statisticsBreakdownBars;
  readonly rankingPlugins = [statisticsRankingValues];
  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;
  @Input() selectedUsers: string[] = [];
  @Input() categoria!: string;
  @Input() searchText: string = '';
  @Input() users: users[] = [];
  @Input() selectedTopics: number[] = [];
  
loading = false;
errorMsg = '';
  filterMessage = '';

errorsPorSeccion: Record<string, string> = {};




  // Estados de carga requeridos por el HTML.
  get cargandoDashboard(): boolean { return this.loading; }
  get loadingResumen(): boolean { return this.loading; }
  get loadingTopicos(): boolean { return this.loading; }
  get loadingTimeline(): boolean { return this.loading; }
  get loadingEntidades(): boolean { return this.loading; }
  get loadingFuentes(): boolean { return this.loading; }
  get loadingCruces(): boolean { return this.loading; }
  get cargandoVistaComentarios(): boolean { return this.loading; }
  // ===== KPI =====
  totalPosts = 0;
// Comparación con período anterior
previousPosts: number | null = null;
readonly formatRange = formatStatisticsRange;
previousPeriodStart = '';
previousPeriodEnd = '';
readonly Math = Math;
topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];
  totalReplies = 0;
    totalRepliesNegativo = 0;
  totalRepliesNeutro = 0;
  totalRepliesPositivo = 0;
// =========================================================
// ENTIDADES POR TÓPICO
// =========================================================
entitiesByTopicPersona: TopicEntity[] = [];
entitiesByTopicOrganizacion: TopicEntity[] = [];
entitiesByTopicLocacion: TopicEntity[] = [];
selectedTopicEntityType: TopicEntityType = 'persona';
  // ===== Top users list =====
  topUsers: TopUserItem[] = [];
  // ===== Extra: Índice por usuario =====
  userIndice: UserIndiceItem[] = [];
  // ===== Share of Voice por medio =====
postsByMedia: Array<{ usuario: string; total: number }> = [];
mediaTotalPosts = 0;
mediaLeader = '';
mediaLeaderPosts = 0;
mediaLeaderShare = 0;
mediaTop3Share = 0;
mediaTop5Share = 0;
  // ===== Chart selectors =====
  sentimentChartType: ChartType = 'doughnut';
  readonly sentimentTypeOptions: ChartType[] = ['doughnut', 'pie', 'bar'];
  viewModeReplies: 'table' | 'chart' = 'table';
  // ===== Timeline =====
  @ViewChild(BaseChartDirective) timelineChart?: BaseChartDirective;

  timelineInterval: TimelineInterval = '1h';
  topicTimelineInterval: TimelineInterval = '1h';
  loadingTopicTimeline = false;
  private topicTimelineSubscription?: Subscription;
  private topicTimelineVersion = 0;
  private topicTimelineDailyRows: any[] = [];
  private topicTimelineTopIds: number[] = [];
  private topicTimelineNames = new Map<number, string>();
  private dashboardRequestVersion = 0;
  private dashboardSubscriptions: Subscription[] = [];
  private dashboardResponse: any = {};
  private timelineSubscription?: Subscription;
  private timelineRequestVersion = 0;
  private pendingSections = 0;
  readonly timelineIntervals: { value: TimelineInterval; label: string }[] = [
    { value: '1h', label: '1 hora' },
    { value: '3h', label: '3 horas' },
    { value: '6h', label: '6 horas' },
    { value: '12h', label: '12 horas' },
    { value: '1d', label: 'Días' }
  ];

  onTimelineIntervalChange(interval: TimelineInterval): void {
    if (this.timelineInterval === interval) return;
    this.timelineInterval = interval;
    this.cargarSoloTimelinePublicaciones();
  }

  onTopicTimelineIntervalChange(interval: TimelineInterval): void {
    if (this.topicTimelineInterval === interval) return;
    this.topicTimelineInterval = interval;
    this.cargarSoloTimelineTopicos();
  }

  private actualizarGraficaEvolucionTopicos(rows: any[]): void {
    const fechas = Array.from(new Set(
      rows.map(row => String(row.fecha ?? '')).filter(Boolean)
    )).sort();

    const colors = ['#6d28d9', '#2563eb', '#059669', '#ea580c', '#dc2626'];
    const valores = new Map<string, number>();

    for (const row of rows) {
      const id = Number(row.topic_id);
      const fecha = String(row.fecha ?? '');
      const key = `${id}|${fecha}`;
      valores.set(key, (valores.get(key) ?? 0) + Number(row.total ?? 0));
    }

    this.topicsTimelineData = {
      labels: fechas.map(fecha => {
        const day = this.formatTimelineLabelUTC(fecha);
        if (this.topicTimelineInterval === '1d') return day;
        const match = fecha.match(/[T ](\d{2}):(\d{2})/);
        return match ? `${day} ${match[1]}:${match[2]}` : day;
      }),
      datasets: this.topicTimelineTopIds.map((id, index) => {
        const color = colors[index % colors.length];
        return {
          label: this.truncateTopic(this.topicTimelineNames.get(id) ?? `Tópico ${id}`, 38),
          data: fechas.map(fecha => valores.get(`${id}|${fecha}`) ?? 0),
          borderColor: color,
          backgroundColor: color,
          tension: 0.25,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2
        };
      })
    };
  }

  public cargarSoloTimelineTopicos(): void {
    const version = ++this.topicTimelineVersion;
    this.topicTimelineSubscription?.unsubscribe();
    this.topicTimelineSubscription = undefined;

    if (!this.startDate || this.topicTimelineTopIds.length === 0) {
      this.loadingTopicTimeline = false;
      this.topicsTimelineData = { labels: [], datasets: [] };
      this.cdr.markForCheck();
      return;
    }

    if (this.topicTimelineInterval === '1d') {
      this.loadingTopicTimeline = false;
      this.actualizarGraficaEvolucionTopicos(this.topicTimelineDailyRows);
      this.cdr.markForCheck();
      return;
    }

    const body: any = {
      start: this.toYMD(this.startDate),
      users: this.getUsersToSend(),
      categoria: this.categoria || '',
      type_user: 'Medio',
      topic_ids: [...this.topicTimelineTopIds],
      timeline_interval: this.topicTimelineInterval
    };

    if (this.endDate) body.end = this.toYMD(this.endDate);
    if (this.searchText?.trim()) body.search = this.searchText.trim();

    this.loadingTopicTimeline = true;
    delete this.errorsPorSeccion['topics_timeline'];
    this.cdr.markForCheck();

    this.topicTimelineSubscription = this.apiService.getCategoryTopicsTimeline(body).subscribe({
      next: (response: any) => {
        if (version !== this.topicTimelineVersion) return;
        const rows = Array.isArray(response?.topics_timeline_detail)
          ? response.topics_timeline_detail : [];
        this.actualizarGraficaEvolucionTopicos(rows);
        this.loadingTopicTimeline = false;
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        if (version !== this.topicTimelineVersion) return;
        console.error('[Política] Error en evolución horaria de tópicos', error);
        this.errorsPorSeccion['topics_timeline'] =
          'No se pudo cargar la evolución horaria de tópicos.';
        this.loadingTopicTimeline = false;
        this.cdr.markForCheck();
      }
    });
  }

  @ViewChild(DashboardEvidenceComponent) private evidence?: DashboardEvidenceComponent;
  evidenceTopics: { topic_id: number; topic_name: string }[] = [];
  sentimentShare = false;
  private readonly sentimentShareOptions: ChartOptions<'bar'> = statisticsChartOptions<'bar'>({
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    scales: {
      x: { stacked: true, min: 0, max: 100, ticks: { callback: value => value + '%' } },
      y: { stacked: true }
    },
    plugins: { tooltip: { callbacks: {
      label: item => `${item.dataset.label}: ${Number(item.raw).toFixed(1)}%`
    } } }
  });

  get toneOptions(): ChartOptions<'bar'> {
    return this.sentimentShare ? this.sentimentShareOptions : this.sentVsUserOptions;
  }

  private sharesSource?: ChartData<'bar'>;
  private sharesData?: ChartData<'bar'>;

  get toneData(): ChartData<'bar'> {
    if (!this.sentimentShare) return this.sentVsUserData;
    if (this.sharesSource !== this.sentVsUserData || !this.sharesData) {
      const source = this.sentVsUserData;
      const totals = (source.labels ?? []).map((_, index) =>
        source.datasets.reduce((sum, dataset) => sum + Number(dataset.data[index] ?? 0), 0));
      this.sharesData = { ...source, datasets: source.datasets.map(dataset => ({
        ...dataset, data: dataset.data.map((count, index) =>
          totals[index] ? Number(count) / totals[index] * 100 : 0)
      })) };
      this.sharesSource = source;
    }
    return this.sharesData;
  }

  exploreTopic(index: number): void {
    const topic = this.evidenceTopics[index];
    if (topic?.topic_id) this.evidence?.openFromRanking({ topicId: topic.topic_id, label: topic.topic_name });
  }

  exploreAccount(name: unknown): void {
    const account = this.users.find(user => user.TweetUser === name);
    if (account) this.evidence?.openFromRanking({ sourceId: String(account.idTweetUser), label: account.TweetUser });
  }

  activityEvidenceRows: { fecha: string; total: number }[] = [];
  @Output() applyDashboardSelection = new EventEmitter<DashboardSelection>();

  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [{ label: 'Publicaciones', data: [],
       borderColor: NETVORA_PALETTE.timeline.line,
          backgroundColor: NETVORA_PALETTE.timeline.fill,
          pointBackgroundColor: NETVORA_PALETTE.timeline.point,
            tension: 0.25,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 4,
            borderWidth: 2
     }]
  };
  topTopicsData: ChartData<'bar'> = {
  labels: [],
  datasets: [
    {
      label: 'Publicaciones',
      data: [],
      backgroundColor: '#6d28d9',
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 26
    }
  ]
};
topicsTimelineData: ChartData<'line'> = {
  labels: [],
  datasets: []
};
// ===== Publicaciones por medio =====
postsByMediaChartData: ChartData<'bar'> = {
  labels: [],
  datasets: [
    {
      label: 'Publicaciones',
      data: []
    }
  ]
};
postsByMediaChartOptions: ChartOptions<'bar'> = statisticsChartOptions<'bar'>({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const value = Number(context.raw ?? 0);
          const share = this.mediaTotalPosts > 0
            ? (value / this.mediaTotalPosts) * 100
            : 0;
          return `${value.toLocaleString()} publicaciones · ${share.toFixed(1)}%`;
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        precision: 0
      },
      grid: {
        display: false
      }
    },
    y: {
      grid: {
        display: false
      }
    }
  }
});
readonly topicsTimelineOptions: ChartOptions<'line'> = statisticsChartOptions<'line'>({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 18,
        boxWidth: 8,
        boxHeight: 8
      }
    },
    tooltip: {
      enabled: true,
      callbacks: {
        label: (context) => {
          const value = Number(context.raw ?? 0);
          return `${context.dataset.label}: ${value.toLocaleString()} publicaciones`;
        }
      }
    }
  },
  scales: {
    x: {
      border: {
        display: false
      },
      grid: {
        display: false
      },
      ticks: {
        color: '#64748b',
        maxRotation: 0
      }
    },
    y: {
      beginAtZero: true,
      border: {
        display: false
      },
      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },
      ticks: {
        precision: 0,
        color: '#64748b'
      }
    }
  }
});
topicsByUserData: ChartData<'bar'> = {
  labels: [],
  datasets: []
};
readonly topicsByUserOptions: ChartOptions<'bar'> = statisticsChartOptions<'bar'>({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 18,
        boxWidth: 8,
        boxHeight: 8
      }
    },
    tooltip: {
      enabled: true,
      callbacks: {
        label: (context) => {
          const value = Number(context.raw ?? 0);
          return `${context.dataset.label}: ${value.toLocaleString()} publicaciones`;
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      stacked: false,
      border: {
        display: false
      },
      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },
      ticks: {
        precision: 0,
        color: '#64748b'
      }
    },
    y: {
      stacked: false,
      border: {
        display: false
      },
      grid: {
        display: false
      },
      ticks: {
        color: '#334155',
        font: {
          size: 12,
          weight: 600
        }
      }
    }
  }
});
  readonly lineOptions: ChartOptions<'line'> = statisticsChartOptions<'line'>({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true
      }
    },
    scales: {
      x: {
        border: {
          display: false
        },
        grid: {
          display: false
        },
        ticks: {
          color: '#64748b',
          maxRotation: 0
        }
      },
      y: {
        beginAtZero: true,
        border: {
          display: false
        },
        grid: {
          color: 'rgba(15, 23, 42, 0.05)'
        },
        ticks: {
          precision: 0,
          color: '#64748b'
        }
      }
    }
  });
  // ===== Sentimientos (tipo variable) =====
  sentimentData: ChartData = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{ label: 'Publicaciones', data: [0, 0, 0] }]
  };
  readonly commonOptions: ChartOptions = statisticsChartOptions({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } }
  });
   repliesChartData: ChartData<'doughnut'> = {
  labels: ['Negativo', 'Neutro', 'Positivo'],
  datasets: [{
    data: [0, 0, 0],
    backgroundColor: [
      NETVORA_PALETTE.sentiment.negativo,
      NETVORA_PALETTE.sentiment.neutro,
      NETVORA_PALETTE.sentiment.positivo
    ],
    borderWidth: 0
  }]
};
readonly topTopicsOptions: ChartOptions<'bar'> = statisticsChartOptions<'bar'>({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  animation: {
    duration: 500
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      enabled: true,
      callbacks: {
        label: (context) => {
          const value = Number(context.raw ?? 0);
          return `${value.toLocaleString()} publicaciones`;
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      border: {
        display: false
      },
      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },
      ticks: {
        precision: 0,
        color: '#64748b'
      }
    },
    y: {
      border: {
        display: false
      },
      grid: {
        display: false
      },
      ticks: {
        color: '#334155',
        font: {
          size: 12,
          weight: 600
        }
      }
    }
  }
});
 readonly repliesChartOptions: ChartOptions<'doughnut'> = statisticsChartOptions<'doughnut'>({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          boxWidth: 8,
          boxHeight: 8
        }
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context) => {
            const value = Number(context.raw ?? 0);
            const total =
              this.totalRepliesNegativo +
              this.totalRepliesNeutro +
              this.totalRepliesPositivo;
            const percent = total > 0
              ? (value / total) * 100
              : 0;
            return `${context.label}: ${value.toLocaleString()} (${percent.toFixed(1)}%)`;
          }
        }
      }
    },
    elements: {
      arc: {
        borderWidth: 0,
        hoverOffset: 5
      }
    }
  });
  // ===== SentVsUser (bar apilado) =====
  sentVsUserData: ChartData<'bar'> = {
    labels: [],
    datasets: [
    {
      label: 'Negativo',
      data: [],
      backgroundColor: NETVORA_PALETTE.sentVsUser.negativo,
      borderWidth: 0,
      borderRadius: 6
    },
    {
      label: 'Neutro',
      data: [],
      backgroundColor: NETVORA_PALETTE.sentVsUser.neutro,
      borderWidth: 0,
      borderRadius: 6
    },
    {
      label: 'Positivo',
      data: [],
      backgroundColor: NETVORA_PALETTE.sentVsUser.positivo,
      borderWidth: 0,
      borderRadius: 6
    }
  ]
  };
  sentVsUserOptions: ChartOptions<'bar'> = statisticsChartOptions<'bar'>({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: {
      x: { stacked: true, ticks: { maxRotation: 0 } },
      y: { stacked: true, beginAtZero: true }
    }
  });
  // wordCloud
  wordcloudRequested = false;
  private wordcloudSubscription?: Subscription;
  wordcloudUrl: string | null = null;
  loadingWordcloud = false;
  // ===== Extra: Índice de sentimiento por usuario =====
indiceSent: IndiceSentItem[] = [];
// Chart (horizontal bar)
userIndiceChartData: ChartData<'bar'> = { labels: [], datasets: [{ label: 'Índice (%)', data: [] }] };
userIndiceChartOptions: ChartOptions<'bar'> = statisticsChartOptions<'bar'>({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: true },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = Number(ctx.raw ?? 0);
          return `Índice: ${v.toFixed(1)}%`;
        }
      }
    }
  },
  scales: {
    x: {
      min: -100,
      max: 100,
      ticks: { callback: (v) => `${v}%` }
    },
    y: { ticks: { autoSkip: false } }
  }
});
  // ===== Acceso a comentarios =====
  accessLoading = true;
  currentRole: UserRole = 'viewer';
  subscriptionPlan = '';
  subscriptionStatus = '';
  get canViewReplies(): boolean {
    if (this.currentRole === 'admin') {
      return true;
    }
    return (
      this.subscriptionStatus === 'activa' &&
      this.subscriptionPlan.trim().toLowerCase() === 'pro'
    );
  }
  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private accountService: AccountService
  ) {
    this.loadAccess();
  }
  private accessSubscription?: Subscription;

  private loadAccess(): void {
  this.accessLoading = true;
  this.accessSubscription = this.accountService.me().subscribe({
    next: (res: any) => {
      const role = String(
        res?.user?.role || 'viewer'
      ).toLowerCase();
      this.currentRole =
        role === 'admin'
          ? 'admin'
          : 'viewer';
      this.subscriptionPlan = String(
        res?.subscription?.plan?.name ??
        res?.subscription?.plan ??
        ''
      )
        .trim()
        .toLowerCase();
      this.subscriptionStatus = String(
        res?.subscription?.status ?? ''
      )
        .trim()
        .toLowerCase();
      this.accessLoading = false;
      this.cdr.markForCheck();
    },
    error: () => {
      this.currentRole = 'viewer';
      this.subscriptionPlan = '';
      this.subscriptionStatus = '';
      this.accessLoading = false;
      this.cdr.markForCheck();
    }
  });
}
  ngOnChanges(changes: SimpleChanges): void {
  const startChanged = !!changes['startDate'];
  const endChanged = !!changes['endDate'];
  const usersChanged = !!changes['users'];
  const selChanged = !!changes['selectedUsers'];
  const searchChanged = !!changes['searchText'];
  const catChanged = !!changes['categoria'];
  const topicsChanged = !!changes['selectedTopics'];
  if (startChanged || endChanged || usersChanged || selChanged || searchChanged || catChanged || topicsChanged) {
    this.cargarDatos();
    this.resetWordcloud();
  }
}
ngOnDestroy(): void {
  this.accessSubscription?.unsubscribe();
  ++this.dashboardRequestVersion;
  ++this.timelineRequestVersion;
  this.dashboardSubscriptions.forEach(subscription => subscription.unsubscribe());
  this.timelineSubscription?.unsubscribe();
  ++this.topicTimelineVersion;
  this.topicTimelineSubscription?.unsubscribe();
  this.topicTimelineSubscription = undefined;
  this.resetWordcloud();
}
private getUsersToSend(): string[] {
    if (this.selectedUsers?.length) {
      return this.selectedUsers
        .map(String)
        .filter(Boolean);
    }
    return (this.users ?? [])
      .map((user) => String(user.idTweetUser))
      .filter(Boolean);
  }
 public cargarDatos(): void {
    const version = ++this.dashboardRequestVersion;
    ++this.timelineRequestVersion;
    ++this.topicTimelineVersion;
    this.dashboardSubscriptions.forEach(subscription => subscription.unsubscribe());
    this.dashboardSubscriptions = [];
    this.timelineSubscription?.unsubscribe();
    this.topicTimelineSubscription?.unsubscribe();
    this.dashboardResponse = {};
    this.errorsPorSeccion = {};
    this.loadingTopicTimeline = false;
    this.topicTimelineTopIds = [];
    this.topicTimelineDailyRows = [];
    this.topicsTimelineData = { labels: [], datasets: [] };

    this.mapResponse({}, '');
    const usersToSend = this.getUsersToSend();
    this.filterMessage = '';
    this.errorMsg = '';
    if (!this.startDate || !usersToSend.length) {
      this.loading = false;
      this.pendingSections = 0;
      this.filterMessage = 'Selecciona un período y al menos una fuente en los filtros.';
      this.cdr.markForCheck();
      return;
    }

    const body: any = {
      start: this.toYMD(this.startDate),
      users: usersToSend,
      categoria: this.categoria || '',
      type_user: 'Medio',
      topic_ids: [...this.selectedTopics],
      timeline_interval: this.timelineInterval
    };
    if (this.endDate) body.end = this.toYMD(this.endDate);
    if (this.searchText?.trim()) body.search = this.searchText.trim();

    const sections = body.topic_ids.length
      ? [{ name: 'topicos', call: () => this.apiService.getCategoriesData(body) }]
      : [
      { name: 'resumen', call: () => this.apiService.getCategoryResumen(body) },
      { name: 'timeline', call: () => this.apiService.getCategoryTimeline(body) },
      { name: 'fuentes', call: () => this.apiService.getCategoryFuentes(body) },
      { name: 'topicos', call: () => this.apiService.getCategoryTopicos(body) },
      { name: 'entidades', call: () => this.apiService.getCategoryEntidades(body) },
      { name: 'cruces', call: () => this.apiService.getCategoryCruces(body) },
      { name: 'comentarios', call: () => this.apiService.getCategoryComentarios(body) }
    ];

    this.pendingSections = sections.length;
    this.loading = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    for (const section of sections) {
      const subscription = section.call().subscribe({
        next: (res: any) => {
          if (version !== this.dashboardRequestVersion) return;
          this.dashboardResponse = { ...this.dashboardResponse, ...res };
          this.mapResponse(this.dashboardResponse, section.name);
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          if (version !== this.dashboardRequestVersion) return;
          console.error(`[Política] Error en ${section.name}`, error);
          this.errorsPorSeccion[section.name] = `No se pudo cargar ${section.name}.`;
          this.pendingSections--;
          this.loading = this.pendingSections > 0;
          this.cdr.markForCheck();
        },
        complete: () => {
          if (version !== this.dashboardRequestVersion) return;
          this.pendingSections--;
          this.loading = this.pendingSections > 0;
          this.cdr.markForCheck();
        }
      });
      this.dashboardSubscriptions.push(subscription);
    }
  }

  private cargarSoloTimelinePublicaciones(): void {
    if (!this.startDate || !this.getUsersToSend().length) return;
    const version = ++this.timelineRequestVersion;
    const dashboardVersion = this.dashboardRequestVersion;
    this.timelineSubscription?.unsubscribe();
    const body: any = {
      start: this.toYMD(this.startDate),
      users: this.getUsersToSend(),
      categoria: this.categoria || '',
      type_user: 'Medio',
      topic_ids: [...this.selectedTopics],
      timeline_interval: this.timelineInterval
    };
    if (this.endDate) body.end = this.toYMD(this.endDate);
    if (this.searchText?.trim()) body.search = this.searchText.trim();
    this.timelineSubscription = this.apiService.getCategoryTimeline(body).subscribe({
      next: (res: any) => {
        if (version !== this.timelineRequestVersion || dashboardVersion !== this.dashboardRequestVersion) return;
        this.dashboardResponse = { ...this.dashboardResponse, ...res };
        this.mapResponse(this.dashboardResponse, 'timeline');
      },
      error: (error: any) => {
        if (version !== this.timelineRequestVersion || dashboardVersion !== this.dashboardRequestVersion) return;
        console.error('[Política] Error en timeline', error);
        this.errorsPorSeccion['timeline'] = 'No se pudo cargar la evolución de publicaciones.';
        this.cdr.markForCheck();
      }
    });
  }

  private mapResponse(res: any, section: string): void {
    // Total posts
    this.totalPosts = res?.total_posts?.total_posts ?? 0;
    this.totalReplies = res?.total_replies?.total ?? 0;
    this.totalRepliesNegativo = res?.total_replies?.negativo ?? 0;
    this.totalRepliesNeutro = res?.total_replies?.neutro ?? 0;
    this.totalRepliesPositivo = res?.total_replies?.positivo ?? 0; 
    // Comparación de publicaciones
    const previousPosts = Number(res?.comparison?.posts?.previous ?? NaN);
    this.previousPosts = Number.isFinite(previousPosts) ? previousPosts : null;
    this.previousPeriodStart =
      String(res?.comparison?.period?.previous_start ?? '');
    this.previousPeriodEnd =
      String(res?.comparison?.period?.previous_end ?? '');
    // Entidades principales
    this.topLocacion = (res?.locacion ?? []).slice(0, 10);
    this.topOrganizacion = (res?.organizacion ?? []).slice(0, 10);
    this.topPersona = (res?.persona ?? []).slice(0, 10);
    // Serie diaria y serie detallada separadas: el backend conserva time_line.
    const dailyRows = Array.isArray(res?.time_line) ? res.time_line : [];
    const detailedRows = Array.isArray(res?.time_line_detail) ? res.time_line_detail : null;
    const timelineRows: any[] =
      this.timelineInterval !== '1d' && detailedRows !== null
        ? detailedRows
        : dailyRows;

    const graphicPeak = timelineRows.reduce(
      (max: number, item: any) => Math.max(max, Number(item.total ?? 0)), 0
    );
    this.activityEvidenceRows = timelineRows.map(row => ({ fecha: String(row.fecha ?? ''), total: Number(row.total ?? 0) }));
    this.timelineData = {
      labels: timelineRows.map((x: any) =>
        this.formatActivityTimelineLabel(String(x.fecha ?? ''))
      ),
      datasets: [
        {
          label: 'Publicaciones',
          data: timelineRows.map((x: any) => Number(x.total ?? 0)),
          tension: 0.25,
          fill: false,
          pointRadius: timelineRows.map((x: any) =>
            graphicPeak > 0 && Number(x.total ?? 0) === graphicPeak ? 5 : 2
          ),
          borderColor: NETVORA_PALETTE.timeline.line,
          backgroundColor: NETVORA_PALETTE.timeline.fill,
          pointBackgroundColor: NETVORA_PALETTE.timeline.point,
          pointHoverRadius: 4,
          borderWidth: 2
        }
      ]
    };
    this.repliesChartData = {
  labels: ['Negativo', 'Neutro', 'Positivo'],
  datasets: [{
    data: [
      this.totalRepliesNegativo,
      this.totalRepliesNeutro,
      this.totalRepliesPositivo
    ],
    backgroundColor: [
      NETVORA_PALETTE.sentiment.negativo,
      NETVORA_PALETTE.sentiment.neutro,
      NETVORA_PALETTE.sentiment.positivo
    ],
    borderWidth: 0
  }]
};
// =========================================================
// TOP TÓPICOS DE LA CATEGORÍA
// =========================================================
const topTopics = Array.isArray(res?.top_topics)
  ? res.top_topics
  : [];
this.evidenceTopics = topTopics.map((topic: any) => ({
      topic_id: Number(topic.topic_id), topic_name: String(topic.topic_name)
    }));
    this.topTopicsData = {
  labels: topTopics.map((item: any) =>
    this.truncateTopic(
      String(item.topic_name || 'Sin nombre'),
      55
    )
  ),
  datasets: [
    {
      label: 'Publicaciones',
      data: topTopics.map((item: any) =>
        Number(item.total || 0)
      ),
      backgroundColor: '#6d28d9',
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 26
    }
  ]
};
// =========================================================
// EVOLUCIÓN DE TÓPICOS DE LA CATEGORÍA
// =========================================================
if (section === 'topicos') {
this.topicTimelineSubscription?.unsubscribe();
this.topicTimelineSubscription = undefined;
++this.topicTimelineVersion;

this.topicTimelineDailyRows = Array.isArray(res?.topics_timeline)
  ? res.topics_timeline : [];

this.topicTimelineNames.clear();
const totals = new Map<number, number>();

for (const row of this.topicTimelineDailyRows) {
  const id = Number(row.topic_id);
  if (!Number.isSafeInteger(id) || id <= 0) continue;
  this.topicTimelineNames.set(id, String(row.topic_name || `Tópico ${id}`));
  totals.set(id, (totals.get(id) ?? 0) + Number(row.total ?? 0));
}

this.topicTimelineTopIds = [...totals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([id]) => id);

this.cargarSoloTimelineTopicos();
}
// =========================================================
// TÓPICOS POR MEDIO / USUARIO
// =========================================================
const topicsByUser = Array.isArray(res?.topics_by_user)
  ? res.topics_by_user
  : [];
// Obtener tópicos únicos
const topicMapByUser = new Map<number, string>();
topicsByUser.forEach((item: any) => {
  const topicId = Number(item.topic_id);
  if (!topicMapByUser.has(topicId)) {
    topicMapByUser.set(
      topicId,
      String(item.topic_name || 'Sin nombre')
    );
  }
});
const topics = Array.from(
  topicMapByUser.entries()
).map(([topic_id, topic_name]) => ({
  topic_id,
  topic_name
}));
// Obtener usuarios únicos
const userMap = new Map<string, string>();
topicsByUser.forEach((item: any) => {
  const userId = String(item.user_id ?? '');
  if (!userMap.has(userId)) {
    userMap.set(
      userId,
      String(item.usuario || 'Sin nombre')
    );
  }
});
const topicUsers = Array.from(
  userMap.entries()
).map(([user_id, usuario]) => ({
  user_id,
  usuario
}));
// Colores para los distintos medios/usuarios
const userColors = [
  '#6d28d9',
  '#2563eb',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#0891b2',
  '#9333ea',
  '#4f46e5'
];
// Construir gráfica
this.topicsByUserData = {
  labels: topics.map((topic) =>
    this.truncateTopic(
      topic.topic_name,
      45
    )
  ),
  datasets: topicUsers.map((user, index) => {
    const data = topics.map((topic) => {
      const item = topicsByUser.find(
        (row: any) =>
          Number(row.topic_id) === topic.topic_id &&
          String(row.user_id ?? '') === user.user_id
      );
      return item
        ? Number(item.total ?? 0)
        : 0;
    });
    const color =
      userColors[index % userColors.length];
    return {
      label: user.usuario,
      data,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 0,
      borderRadius: 4,
      borderSkipped: false
    };
  })
};
// =========================================================
// ENTIDADES POR TÓPICO
// =========================================================
this.entitiesByTopicPersona = Array.isArray(
  res?.entities_by_topic_persona
)
  ? res.entities_by_topic_persona.map((item: any) => ({
      topic_id: Number(item.topic_id),
      topic_name: String(item.topic_name || 'Sin nombre'),
      entidad: String(item.entidad || 'Sin nombre'),
      total: Number(item.total || 0)
    }))
  : [];
this.entitiesByTopicOrganizacion = Array.isArray(
  res?.entities_by_topic_organizacion
)
  ? res.entities_by_topic_organizacion.map((item: any) => ({
      topic_id: Number(item.topic_id),
      topic_name: String(item.topic_name || 'Sin nombre'),
      entidad: String(item.entidad || 'Sin nombre'),
      total: Number(item.total || 0)
    }))
  : [];
this.entitiesByTopicLocacion = Array.isArray(
  res?.entities_by_topic_locacion
)
  ? res.entities_by_topic_locacion.map((item: any) => ({
      topic_id: Number(item.topic_id),
      topic_name: String(item.topic_name || 'Sin nombre'),
      entidad: String(item.entidad || 'Sin nombre'),
      total: Number(item.total || 0)
    }))
  : [];
    // Sentimientos
    const s = res?.sentiment?.posts_per_sentiment ?? {};
    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{
        label: 'Publicaciones',
        data: [Number(s.negativo || 0), Number(s.neutro || 0), Number(s.positivo || 0)],
        backgroundColor: [
        NETVORA_PALETTE.sentiment.negativo,
        NETVORA_PALETTE.sentiment.neutro,
        NETVORA_PALETTE.sentiment.positivo
      ],
      borderWidth: 0
      }]
    };
    // Top users list
    this.topUsers = (res?.top_users ?? []).map((u: any) => ({
      usuario: u.usuario,
      total: Number(u.total ?? 0)
    }));
    // SentVsUser (stacked bar)
    const svu = res?.SentVsUser ?? {};
    const users = Object.keys(svu);
    const negArr = users.map((u) => Number(svu[u]?.negativo ?? 0));
    const neuArr = users.map((u) => Number(svu[u]?.neutro ?? 0));
    const posArr = users.map((u) => Number(svu[u]?.positivo ?? 0));
    this.sentVsUserData = {
      labels: users,
      datasets: [
    {
      label: 'Negativo',
      data: negArr,
      backgroundColor: NETVORA_PALETTE.sentVsUser.negativo,
      borderWidth: 0,
      borderRadius: 6
    },
    {
      label: 'Neutro',
      data: neuArr,
      backgroundColor: NETVORA_PALETTE.sentVsUser.neutro,
      borderWidth: 0,
      borderRadius: 6
    },
    {
      label: 'Positivo',
      data: posArr,
      backgroundColor: NETVORA_PALETTE.sentVsUser.positivo,
      borderWidth: 0,
      borderRadius: 6
    }
  ]
    };
      // Extra: Índice por usuario (tabla)
  const rawIndice = Array.isArray(res?.indice_sentimiento)
  ? res.indice_sentimiento
  : (Array.isArray(res?.indice) ? res.indice : []);
  this.userIndice = rawIndice.map((x: any) => ({
  TweetUser: String(x.user ?? x.TweetUser ?? ''),
  pos: Number(x.positivos ?? x.pos ?? 0),
  neg: Number(x.negativos ?? x.neg ?? 0),
  total: Number(x.total ?? 0),
  indice: this.normalizeIndiceSigned(Number(x.indice_sentimiento ?? x.indice ?? 0)),
}))
.sort((a: UserIndiceItem, b: UserIndiceItem) => b.total - a.total);
// ===== Índice de sentimiento por usuario (viene como strings) =====
const rawIdx = Array.isArray(res?.indice_sentimiento) ? res.indice_sentimiento : (Array.isArray(res?.indice) ? res.indice : []);
// 👆 ajusta el nombre si tu backend lo manda con otra key (ej: res.indice_sentimiento_users)
this.indiceSent = rawIdx.map((x: any) => ({
  user: String(x.user ?? ''),
  positivos: Number(x.positivos ?? 0),
  negativos: Number(x.negativos ?? 0),
  total: Number(x.total ?? 0),
  indice: Number(x.indice_sentimiento ?? 0) // 👈 NO normalices aquí
}));
// filtro recomendado: evita outliers por bajo volumen (opcional)
const MIN_TOTAL = 3; // cambia a 10 o 30 si quieres más robusto
const filtered = this.indiceSent.filter(x => x.total >= MIN_TOTAL);
// orden: por índice desc (ranking)
const sorted = [...filtered].sort((a, b) => b.indice - a.indice);
// top N
const TOP = 12;
const top = sorted.slice(0, TOP);
// arma chart
this.userIndiceChartData = {
  labels: top.map(x => x.user),
  datasets: [
    {
      label: 'Índice (%)',
      data: top.map(x => +(this.normalizeIndiceSigned(x.indice) * 100).toFixed(1)),
      backgroundColor: NETVORA_PALETTE.indice.positivo,
      borderRadius: 8,
      borderWidth: 0
    }
  ]
};
// =====================================================
// SHARE OF VOICE POR MEDIO
// =====================================================
this.postsByMedia = Array.isArray(res?.posts_by_media)
  ? res.posts_by_media.map((item: any) => ({
      usuario: String(item?.usuario ?? ''),
      total: Number(item?.total ?? 0)
    })).sort((a: { total: number }, b: { total: number }) => b.total - a.total)
  : [];
this.mediaTotalPosts = Number(
  res?.media_total_posts ?? 0
);
// Medio líder
const leader = this.postsByMedia[0];
this.mediaLeader = leader?.usuario ?? '';
this.mediaLeaderPosts = leader?.total ?? 0;
this.mediaLeaderShare = this.mediaTotalPosts > 0
  ? (this.mediaLeaderPosts / this.mediaTotalPosts) * 100
  : 0;
// Concentración Top 3
const top3Total = this.postsByMedia
  .slice(0, 3)
  .reduce(
    (sum, item) => sum + item.total,
    0
  );
this.mediaTop3Share = this.mediaTotalPosts > 0
  ? (top3Total / this.mediaTotalPosts) * 100
  : 0;
// Concentración Top 5
const top5Total = this.postsByMedia
  .slice(0, 5)
  .reduce(
    (sum, item) => sum + item.total,
    0
  );
this.mediaTop5Share = this.mediaTotalPosts > 0
  ? (top5Total / this.mediaTotalPosts) * 100
  : 0;
  // =====================================================
// GRÁFICA — PUBLICACIONES POR MEDIO
// =====================================================
this.postsByMediaChartData = {
  labels: this.postsByMedia.map(
    item => item.usuario
  ),
  datasets: [
    {
      label: 'Publicaciones',
      data: this.postsByMedia.map(
        item => item.total
      )
    }
  ]
};
// opcional: para tabla muestra más (ordenada por total desc o índice desc)
this.indiceSent = [...filtered].sort((a, b) => b.total - a.total);
    // ✅ Fuerza repaint del chart (OnPush + ng2-charts)
    queueMicrotask(() => {
      this.timelineChart?.update();
    });
    this.cdr.markForCheck();
  }
  // ===== Downloads =====
 downloadChart(event: Event): void {
    const button = event.currentTarget as HTMLElement;
    const chartContainer = button.closest(
      '.chart, .analysis-card, .activity-chart, .explore-main-card, .explore-secondary-card, .replies-chart-panel'
    );
    const canvas = chartContainer?.querySelector(
      'canvas'
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = exportCanvasWithWhiteBg(canvas);
    link.download = `grafico-${Date.now()}.png`;
    link.click();
  }
  public downloadAllCharts(): void {
    const canvases = this.host.nativeElement.querySelectorAll<HTMLCanvasElement>('canvas');
    if (!canvases.length) return;
    canvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.href = exportCanvasWithWhiteBg(canvas);
      link.download = `grafico-${index + 1}-${Date.now()}.png`;
      link.click();
    });
  }
  trackByEntidad = (_: number, item: { entidad: string }) => item.entidad;
  trackByUser = (_: number, item: { usuario: string }) => item.usuario;
  // ===== Helpers =====
  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // 🔥 Fix: formatear usando UTC para que no “reste un día” en Bolivia (UTC-4)
  private formatTimelineLabelUTC(fecha: string): string {
    if (!fecha) return '';
    const cleanDate = fecha.includes('T')
      ? fecha.split('T')[0]
      : fecha.split(' ')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) {
      const dt = new Date(fecha);
      if (Number.isNaN(dt.getTime())) return fecha;
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    }
    const [, month, day] = parts;
    return `${day}/${month}`;
  }
  private formatActivityTimelineLabel(fecha: string): string {
    const daily = this.formatTimelineLabelUTC(fecha);
    if (this.timelineInterval === '1d') return daily;
    const match = fecha.match(/[T ](\d{2}):(\d{2})/);
    return match ? `${daily} ${match[1]}:${match[2]}` : daily;
  }

  private resetWordcloud(): void {
    this.wordcloudSubscription?.unsubscribe();
    if (this.wordcloudUrl) URL.revokeObjectURL(this.wordcloudUrl);
    this.wordcloudUrl = null;
    this.wordcloudRequested = false;
    this.loadingWordcloud = false;
  }

  loadWordcloud(): void {
  if (!this.startDate) return;
  const usersToSend = this.getUsersToSend();
  if (!usersToSend.length) {
    this.wordcloudUrl = null;
    return;
  }
  this.wordcloudRequested = true;
    this.loadingWordcloud = true;
  this.cdr.markForCheck();
  const body = {
    start: this.toYMD(this.startDate),
    end: this.endDate ? this.toYMD(this.endDate) : undefined,
    categoria: this.categoria,
    tipo_cuenta: 'Medio',
    users: usersToSend,
    search: this.searchText?.trim() || '',
    topic_ids: [...this.selectedTopics]
  };
  this.wordcloudSubscription = this.apiService.getWordcloud(body).subscribe({
    next: (resp) => {
      const blob = resp.body as Blob;
      if (blob?.type?.includes('application/json')) {
                this.wordcloudUrl = null;
        this.loadingWordcloud = false;
        this.cdr.markForCheck();
        return;
      }
      if (!blob || blob.size === 0) {
        this.wordcloudUrl = null;
        this.loadingWordcloud = false;
        this.cdr.markForCheck();
        return;
      }
      if (this.wordcloudUrl) URL.revokeObjectURL(this.wordcloudUrl);
      this.wordcloudUrl = URL.createObjectURL(blob);
      this.loadingWordcloud = false;
      this.cdr.markForCheck();
    },
    error: () => {
      if (this.wordcloudUrl) URL.revokeObjectURL(this.wordcloudUrl);
      this.wordcloudUrl = null;
      this.loadingWordcloud = false;
      this.cdr.markForCheck();
    }
  });
}
calcUserBar(total: number): number {
  if (!this.topUsers?.length) return 0;
  const max = Math.max(...this.topUsers.map(x => x.total || 0), 1);
  return Math.round((total / max) * 100);
}
private normalizeIndiceSigned(v: number): number {
  if (!Number.isFinite(v)) return 0;
  // si viene como porcentaje (-100..100), pásalo a (-1..1)
  if (Math.abs(v) > 1) v = v / 100;
  // clamp a [-1, 1]
  return Math.max(-1, Math.min(1, v));
}
formatIndice(v: number): string {
  const n = this.normalizeIndiceSigned(v) * 100;
  return `${n.toFixed(0)}%`;
}
calcIndiceBar(v: number): number {
  return Math.round(Math.abs(this.normalizeIndiceSigned(v)) * 100);
}
private truncateTopic(text: string, maxLength: number): string {
  if (!text) return 'Sin nombre';
  return text.length > maxLength
    ? `${text.substring(0, maxLength)}…`
    : text;
}
get selectedEntitiesByTopic(): TopicEntity[] {
  switch (this.selectedTopicEntityType) {
    case 'organizacion':
      return this.entitiesByTopicOrganizacion;
    case 'locacion':
      return this.entitiesByTopicLocacion;
    case 'persona':
    default:
      return this.entitiesByTopicPersona;
  }
}
get groupedEntitiesByTopic(): {
  topic_id: number;
  topic_name: string;
  total: number;
  entities: TopicEntity[];
}[] {
  const grouped = new Map<
    number,
    {
      topic_id: number;
      topic_name: string;
      total: number;
      entities: TopicEntity[];
    }
  >();
  this.selectedEntitiesByTopic.forEach((item) => {
    if (!grouped.has(item.topic_id)) {
      grouped.set(item.topic_id, {
        topic_id: item.topic_id,
        topic_name: item.topic_name,
        total: 0,
        entities: []
      });
    }
    const topic = grouped.get(item.topic_id)!;
    topic.entities.push(item);
    topic.total += item.total;
  });
  return Array.from(grouped.values())
    .map((topic) => ({
      ...topic,
      entities: topic.entities.sort(
        (a, b) => b.total - a.total
      )
    }))
    .sort(
      (a, b) => b.total - a.total
    );
}
trackByIndiceUser = (_: number, item: UserIndiceItem) => item.TweetUser;
}
