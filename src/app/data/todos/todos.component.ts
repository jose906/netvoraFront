
import {
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';

import {
  Observable,
  Subscription,
  from,
  of
} from 'rxjs';

import {
  catchError,
  finalize,
  map,
  mergeMap
} from 'rxjs/operators';

import {
  ChartData,
  ChartOptions,
  ChartType
} from 'chart.js';

import { ApiService } from '../../services/api.service';
import {
  StatsResponse,
  EmergingTopicItem
} from '../../interfaces/data/mainDashboard';

import {
  NETVORA_PALETTE,
  exportCanvasWithWhiteBg
} from '../../utils/helpers';

import { users } from '../../interfaces/users';
import { Router } from '@angular/router';
import { UserRole } from '../../services/authz.service';
import { AccountService } from '../../services/account.service';
import { AccountMeResponse } from '../../interfaces/me';

// =========================================================
// TIPOS
// =========================================================

type TimelineInterval = '1h' | '3h' | '6h' | '12h' | '1d';

type SectionKey =
  | 'resumen'
  | 'timeline'
  | 'medios'
  | 'topicos'
  | 'entidades';

interface StatsFilters {
  start: string;
  end?: string;
  users: string[];
  search?: string;
  topic_ids: number[];
  timeline_interval: TimelineInterval;
}

type EntItem = {
  entidad: string;
  total: number;
};

type MediaPostItem = {
  id: string;
  usuario: string;
  total: number;
};

// =========================================================
// COMPONENTE
// =========================================================

@Component({
  selector: 'app-todos',
  templateUrl: './todos.component.html',
  styleUrls: ['./todos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodosComponent implements OnInit, OnChanges, OnDestroy {

  // =======================================================
  // INPUTS
  // =======================================================

  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;
  @Input() selectedUsers: string[] = [];
  @Input() searchText = '';
  @Input() users: users[] = [];
  @Input() selectedTopics: number[] = [];

  // =======================================================
  // INTERVALOS INDEPENDIENTES
  // =======================================================

  timelineInterval: TimelineInterval = '1h';

  topicTimelineInterval: TimelineInterval = '1h';

  loadingTopicTimeline = false;

  private topicTimelineSubscription?: Subscription;
  private topicTimelineVersion = 0;

  // =======================================================
  // ESTADOS DE CARGA
  // =======================================================

  loadingResumen = true;
loadingTimeline = true;
loadingMedios = true;
loadingTopicos = true;
loadingEntidades = true;
loadingComentarios = false;

  get cargandoDashboard(): boolean {
    return this.loadingResumen ||
      this.loadingTimeline ||
      this.loadingMedios ||
      this.loadingTopicos ||
      this.loadingTopicTimeline ||
      this.loadingEntidades ||
      this.loadingComentarios;
  }

  get cargandoVistaComentarios(): boolean {
    return this.canViewReplies &&
      !!this.lastFilters &&
      (!this.mainFinished || this.loadingComentarios);
  }

  readonly Math = Math;

  // =======================================================
  // ESTADOS GENERALES
  // =======================================================

  loading = false;
  errorMsg = '';

  errorsPorSeccion: Record<string, string> = {};

  private currentResponse: Partial<StatsResponse> = {};

  private mainSubscription?: Subscription;
  private timelineSubscription?: Subscription;
  private commentsSubscription?: Subscription;
  private accessSubscription?: Subscription;

  private loadId = 0;
  private timelineVersion = 0;

  private mainFinished = false;
  private commentsRequestedForLoad = -1;

  private lastFilters: StatsFilters | null = null;

  // =======================================================
  // ACCESO A COMENTARIOS
  // =======================================================

  accessLoading = true;
  currentRole: UserRole = 'viewer';
  subscriptionPlan = '';
  subscriptionStatus = '';
  canViewReplies = false;

  // =======================================================
  // KPIS
  // =======================================================

  totalPosts = 0;
  totalReplies = 0;

  totalRepliesNegativo = 0;
  totalRepliesNeutro = 0;
  totalRepliesPositivo = 0;

  // =======================================================
  // RESUMEN DE COMENTARIOS
  // =======================================================

  repliesNegativePercent = 0;
  repliesNeutralPercent = 0;
  repliesPositivePercent = 0;

  repliesDominantSentiment = 'Sin datos';
  repliesDominantPercent = 0;

  // =======================================================
  // RESUMEN DE ANÁLISIS
  // =======================================================

  analysisTopTopic = '';
  analysisTopTopicTotal = 0;

  analysisMostPositiveTopic = '';
  analysisMostNegativeTopic = '';

  analysisPositivePercent = 0;
  analysisNegativePercent = 0;
  analysisNeutralPercent = 0;

  // =======================================================
  // ENTIDADES
  // =======================================================

  topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];

  // =======================================================
  // COMPARACIÓN DE PERÍODOS
  // =======================================================

  postsChange: number | null = null;

  previousPosts = 0;
  previousPeriodStart = '';
  previousPeriodEnd = '';

  // =======================================================
  // MEDIOS / SHARE OF VOICE
  // =======================================================

  postsByMedia: MediaPostItem[] = [];

  mediaTotalPosts = 0;
  media_total_posts?: number;

  topMediaName = '—';
  topMediaPosts = 0;

  topMediaShare = 0;
  top3MediaShare = 0;
  top5MediaShare = 0;

  postsByMediaData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Publicaciones',
      data: [],
      backgroundColor: NETVORA_PALETTE.accent,
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 26
    }]
  };

  readonly postsByMediaOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: {
      duration: 500
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: context => {
            const value = Number(context.raw || 0);

            const percentage = this.mediaTotalPosts > 0
              ? (value / this.mediaTotalPosts) * 100
              : 0;

            return [
              `${value.toLocaleString()} publicaciones`,
              `${percentage.toFixed(1)}% del volumen de medios`
            ];
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
          color: 'rgba(15,23,42,0.05)'
        },
        ticks: {
          precision: 0,
          color: '#64748b',
          callback: value => Number(value).toLocaleString()
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
          },
          callback: (_value, index) => {
            const media = this.postsByMedia[index];
            return media ? `@${media.usuario}` : '';
          }
        }
      }
    }
  };

  // =======================================================
  // GRÁFICOS GENERALES
  // =======================================================

  sentimentChartType: ChartType = 'doughnut';
  categoriesChartType: ChartType = 'bar';

  readonly sentimentTypeOptions: ChartType[] = [
    'doughnut',
    'pie',
    'bar'
  ];

  readonly categoriesTypeOptions: ChartType[] = [
    'bar',
    'doughnut',
    'pie'
  ];

  viewModeReplies: 'table' | 'chart' = 'table';

  sentimentData: ChartData<'doughnut' | 'pie' | 'bar'> = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{
      label: 'Sentimientos',
      data: [0, 0, 0],
      backgroundColor: [
        NETVORA_PALETTE.sentiment.negativo,
        NETVORA_PALETTE.sentiment.neutro,
        NETVORA_PALETTE.sentiment.positivo
      ],
      borderWidth: 0
    }]
  };

  categoriesData: ChartData<'doughnut' | 'pie' | 'bar'> = {
    labels: [],
    datasets: [{
      label: 'Categorías',
      data: [],
      backgroundColor: NETVORA_PALETTE.categories,
      borderWidth: 0
    }]
  };

  readonly commonCardChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        enabled: true
      }
    }
  };

  // =======================================================
  // TIMELINE
  // =======================================================

  readonly timelineIntervals: {
    value: TimelineInterval;
    label: string;
  }[] = [
    { value: '1h', label: '1 hora' },
    { value: '3h', label: '3 horas' },
    { value: '6h', label: '6 horas' },
    { value: '12h', label: '12 horas' },
    { value: '1d', label: 'Días' }
  ];

  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Publicaciones',
      data: [],
      borderColor: NETVORA_PALETTE.accent,
      backgroundColor: 'rgba(109,40,217,0.08)',
      tension: 0.35,
      fill: true,
      pointRadius: 2,
      pointBackgroundColor: NETVORA_PALETTE.accent,
      pointHoverRadius: 4,
      borderWidth: 2
    }]
  };

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        enabled: true
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0
        }
      },
      y: {
        beginAtZero: true
      }
    }
  };

  activityTotal = 0;
  activityAverage = 0;
  activityPeak = 0;
  activityPeakDate = '';
  activityVariation: number | null = null;

  // =======================================================
  // TÓPICOS
  // =======================================================

  currentEmergingTopics: EmergingTopicItem[] = [];

  topTopicsData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Publicaciones',
      data: [],
      backgroundColor: NETVORA_PALETTE.accent,
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 26
    }]
  };

  readonly topTopicsOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: {
      duration: 500
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: context =>
            `${Number(context.raw || 0).toLocaleString()} publicaciones`
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
          color: 'rgba(15,23,42,0.05)'
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
  };

  topicsTimelineData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  readonly topicsTimelineOptions: ChartOptions<'line'> = {
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
          label: context =>
            `${context.dataset.label}: ${Number(context.raw ?? 0).toLocaleString()} publicaciones`
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
          color: 'rgba(15,23,42,0.05)'
        },
        ticks: {
          precision: 0,
          color: '#64748b'
        }
      }
    }
  };

  // =======================================================
  // TÓPICOS EMERGENTES
  // =======================================================

  emergingTopicsData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Crecimiento',
      data: [],
      backgroundColor: '#6d28d9',
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 26
    }]
  };

  readonly emergingTopicsOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: {
      duration: 500
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: items => {
            if (!items.length) return '';
            const item = this.currentEmergingTopics[items[0].dataIndex];
            return item?.topic_name || '';
          },
          label: context => {
            const item = this.currentEmergingTopics[context.dataIndex];
            if (!item) return '';

            return [
              `Actual: ${Number(item.total_actual || 0).toLocaleString()}`,
              `Anterior: ${Number(item.total_anterior || 0).toLocaleString()}`,
              `Crecimiento: +${Number(item.diferencia || 0).toLocaleString()}`
            ];
          },
          afterLabel: context => {
            const item = this.currentEmergingTopics[context.dataIndex];
            if (!item) return '';

            if (item.tendencia === 'NUEVO') {
              return 'Estado: NUEVO';
            }

            if (item.porcentaje == null) return '';

            const p = Number(item.porcentaje);
            return `Variación: ${p > 0 ? '+' : ''}${p.toLocaleString()}%`;
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
          color: 'rgba(15,23,42,0.05)'
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
  };

  // =======================================================
  // SENTIMIENTO POR TÓPICO
  // =======================================================

  topicSentimentData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  readonly topicSentimentOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: {
      duration: 450
    },
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
          boxWidth: 7,
          boxHeight: 7,
          padding: 16,
          color: '#64748b',
          font: {
            size: 10
          }
        }
      },
      tooltip: {
        callbacks: {
          label: context =>
            `${context.dataset.label}: ${Number(context.raw || 0).toFixed(1)}%`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        min: 0,
        max: 100,
        border: {
          display: false
        },
        grid: {
          color: 'rgba(15,23,42,0.05)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 9
          },
          callback: value => `${value}%`
        }
      },
      y: {
        stacked: true,
        border: {
          display: false
        },
        grid: {
          display: false
        },
        ticks: {
          color: '#475569',
          font: {
            size: 10
          }
        }
      }
    }
  };

  // =======================================================
  // COMENTARIOS
  // =======================================================

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

  readonly repliesChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    animation: {
      duration: 450
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 7,
          boxHeight: 7,
          padding: 16,
          color: '#64748b',
          font: {
            size: 10
          }
        }
      },
      tooltip: {
        callbacks: {
          label: context => {
            const value = Number(context.raw || 0);
            const data = context.dataset.data as number[];
            const total = data.reduce(
              (sum, item) => sum + Number(item || 0),
              0
            );

            const percentage = total > 0
              ? (value / total) * 100
              : 0;

            return `${context.label}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;
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
  };

  // =======================================================
  // CONSTRUCTOR
  // =======================================================

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private accountService: AccountService
  ) {}

  // =======================================================
  // CICLO DE VIDA
  // =======================================================

  ngOnInit(): void {
    this.loadAccess();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const dataChanged = [
      'startDate',
      'endDate',
      'users',
      'selectedUsers',
      'searchText',
      'selectedTopics'
    ].some(key => !!changes[key]);

    if (dataChanged) {
      this.cargarDatos();
    }
  }

  ngOnDestroy(): void {
    this.loadId++;
    this.topicTimelineVersion++;
    this.cancelPendingRequests();
    this.accessSubscription?.unsubscribe();
  }

  // =======================================================
  // PERMISOS DE COMENTARIOS
  // =======================================================

  private loadAccess(): void {

    this.accessLoading = true;

    this.accessSubscription = this.accountService.me().subscribe({

      next: (response: AccountMeResponse) => {

        const user = response?.user;
        const subscription = response?.subscription;

        this.currentRole =
          (user?.role as UserRole) || 'viewer';

        this.subscriptionPlan = String(
          subscription?.plan?.name || ''
        ).trim().toLowerCase();

        this.subscriptionStatus = String(
          subscription?.status || ''
        ).trim().toLowerCase();

        this.canViewReplies =
          this.currentRole === 'admin' ||
          (
            this.subscriptionPlan === 'pro' &&
            this.subscriptionStatus === 'activa'
          );

        this.accessLoading = false;

        this.cargarComentariosSiCorresponde();
        this.cdr.markForCheck();
      },

      error: () => {

        this.currentRole = 'viewer';
        this.subscriptionPlan = '';
        this.subscriptionStatus = '';
        this.canViewReplies = false;
        this.accessLoading = false;

        this.cdr.markForCheck();
      }

    });
  }

  // =======================================================
  // CONSTRUIR FILTROS
  // =======================================================

  private buildFilters(): StatsFilters | null {

    if (!this.startDate) return null;

    const usersToSend = this.selectedUsers.length > 0
      ? this.selectedUsers.map(String)
      : (this.users ?? []).map(
          u => String(u.idTweetUser)
        );

    if (!usersToSend.length) return null;

    const body: StatsFilters = {
      start: this.toYMD(this.startDate),
      users: usersToSend,
      topic_ids: [...this.selectedTopics],
      timeline_interval: this.timelineInterval
    };

    if (this.endDate) {
      body.end = this.toYMD(this.endDate);
    }

    const search = this.searchText?.trim();

    if (search) {
      body.search = search;
    }

    return body;
  }

  // =======================================================
  // CANCELAR SOLICITUDES ANTERIORES
  // =======================================================

  private cancelPendingRequests(): void {

    this.mainSubscription?.unsubscribe();
    this.timelineSubscription?.unsubscribe();
    this.commentsSubscription?.unsubscribe();
    this.topicTimelineSubscription?.unsubscribe();

    this.mainSubscription = undefined;
    this.timelineSubscription = undefined;
    this.commentsSubscription = undefined;
    this.topicTimelineSubscription = undefined;
  }

  // =======================================================
  // LOADING INDEPENDIENTE
  // =======================================================

  private setSectionLoading(
    section: SectionKey,
    value: boolean
  ): void {

    switch (section) {

      case 'resumen':
        this.loadingResumen = value;
        break;

      case 'timeline':
        this.loadingTimeline = value;
        break;

      case 'medios':
        this.loadingMedios = value;
        break;

      case 'topicos':
        this.loadingTopicos = value;
        break;

      case 'entidades':
        this.loadingEntidades = value;
        break;
    }

    this.loading = this.loadingResumen;
  }

  // =======================================================
  // FUSIONAR RESPUESTAS
  // =======================================================

  private mergeResponse(
    part: Partial<StatsResponse>
  ): void {

    this.currentResponse = {
      ...this.currentResponse,
      ...part
    };

    this.mapResponse(
      this.currentResponse as StatsResponse
    );
  }

  // =======================================================
  // CARGA GENERAL DEL DASHBOARD
  // =======================================================

  public cargarDatos(): void {

    const filters = this.buildFilters();

    const id = ++this.loadId;

    ++this.timelineVersion;
    ++this.topicTimelineVersion;

    this.cancelPendingRequests();

    this.lastFilters = filters;
    this.mainFinished = false;
    this.commentsRequestedForLoad = -1;

    this.errorsPorSeccion = {};
    this.errorMsg = '';

    this.currentResponse = {};
    this.loadingTopicTimeline = false;
    this.mapResponse({} as StatsResponse);

   if (!filters) {

  this.loading = false;
  this.loadingResumen = true;
  this.loadingTimeline = true;
  this.loadingMedios = true;
  this.loadingTopicos = true;
  this.loadingTopicTimeline = true;
  this.loadingEntidades = true;
  this.loadingComentarios = false;

  this.errorMsg = '';

  this.cdr.markForCheck();
  return;
}

    this.loadingResumen = true;
    this.loadingTimeline = true;
    this.loadingMedios = true;
    this.loadingTopicos = true;
    this.loadingTopicTimeline = this.topicTimelineInterval !== '1d';
    this.loadingEntidades = true;
    this.loadingComentarios = false;
    this.loading = true;

    this.cdr.markForCheck();

    // =====================================================
    // CASO 1: HAY TÓPICOS SELECCIONADOS
    // =====================================================

    if (filters.topic_ids.length > 0) {

      const expectedTimelineVersion =
        this.timelineVersion;

      this.mainSubscription = this.api
        .getAllData(filters)
        .pipe(
          finalize(() => {

            if (id !== this.loadId) return;

            this.loadingResumen = false;

            if (
              expectedTimelineVersion ===
              this.timelineVersion
            ) {
              this.loadingTimeline = false;
            }

            this.loadingMedios = false;
            this.loadingTopicos = false;
            this.loadingEntidades = false;

            this.loading = false;
            this.mainFinished = true;

            this.cargarSoloTimelineTopicos();
            this.cdr.markForCheck();
          })
        )
        .subscribe({

          next: res => {

            if (id !== this.loadId) return;

            if (
              expectedTimelineVersion !==
              this.timelineVersion
            ) {

              const {
                time_line_detail,
                ...rest
              } = res as StatsResponse & {
                time_line_detail?: unknown;
              };

              this.mergeResponse(
                rest as Partial<StatsResponse>
              );

            } else {

              this.mergeResponse(res);
            }

            this.cdr.markForCheck();
          },

          error: err => {

            if (id !== this.loadId) return;

            console.error(
              '[Todos] Estadísticas filtradas',
              err
            );

            this.errorMsg =
              'No se pudo cargar el dashboard.';

            this.cdr.markForCheck();
          }

        });

      return;
    }

    // =====================================================
    // CASO 2: ENDPOINTS INDEPENDIENTES
    // =====================================================

    const jobs: Array<{
      section: SectionKey;
      request: () => Observable<Partial<StatsResponse>>;
    }> = [

      {
        section: 'resumen',
        request: () =>
          this.api.getStatsResumen(filters)
      },

      {
        section: 'timeline',
        request: () =>
          this.api.getStatsTimeline(filters)
      },

      {
        section: 'medios',
        request: () =>
          this.api.getStatsMedios(filters)
      },

      {
        section: 'topicos',
        request: () =>
          this.api.getStatsTopicos(filters)
      },

      {
        section: 'entidades',
        request: () =>
          this.api.getStatsEntidades(filters)
      }

    ];

    const expectedTimelineVersion =
      this.timelineVersion;

    this.mainSubscription = from(jobs)
      .pipe(

        mergeMap(

          job => job.request().pipe(

            map(response => ({
              section: job.section,
              response,
              failed: false
            })),

            catchError(err => {

              console.error(
                `[Todos] ${job.section}`,
                err
              );

              return of({
                section: job.section,
                response:
                  null as Partial<StatsResponse> | null,
                failed: true
              });

            })

          ),

          2
        ),

        finalize(() => {

          if (id !== this.loadId) return;

          this.mainFinished = true;

          this.loadingResumen = false;

          if (
            expectedTimelineVersion ===
            this.timelineVersion
          ) {
            this.loadingTimeline = false;
          }

          this.loadingMedios = false;
          this.loadingTopicos = false;
          this.loadingEntidades = false;
          this.loading = false;

          this.cargarComentariosSiCorresponde();
          this.cargarSoloTimelineTopicos();

          this.cdr.markForCheck();
        })

      )
      .subscribe({

        next: ({
          section,
          response,
          failed
        }) => {

          if (id !== this.loadId) return;

          if (
            section === 'timeline' &&
            expectedTimelineVersion !==
              this.timelineVersion
          ) {
            return;
          }

          this.setSectionLoading(section, false);

          if (failed || response === null) {

            this.errorsPorSeccion[section] =
              `No se pudo cargar ${section}.`;

            if (section === 'resumen') {
              this.errorMsg =
                'No se pudo cargar el resumen del dashboard.';
            }

          } else {

            this.mergeResponse(response);
          }

          this.cdr.markForCheck();
        }

      });
  }

  // =======================================================
  // CAMBIO DE INTERVALO DEL TIMELINE
  // =======================================================

  onTimelineIntervalChange(
    interval: TimelineInterval
  ): void {

    if (this.timelineInterval === interval) return;

    this.timelineInterval = interval;

    this.cargarSoloTimeline();
  }

  // =======================================================
  // CARGAR SOLO TIMELINE
  // =======================================================

  public cargarSoloTimeline(): void {

    const filters = this.buildFilters();

    if (!filters) return;

    const id = this.loadId;
    const version = ++this.timelineVersion;

    this.timelineSubscription?.unsubscribe();

    this.loadingTimeline = true;

    delete (this.currentResponse as any).time_line_detail;

    this.mapResponse(
      this.currentResponse as StatsResponse
    );

    this.cdr.markForCheck();

    this.timelineSubscription = this.api
      .getStatsTimeline(filters)
      .pipe(

        finalize(() => {

          if (
            id !== this.loadId ||
            version !== this.timelineVersion
          ) {
            return;
          }

          this.loadingTimeline = false;
          this.cdr.markForCheck();
        })

      )
      .subscribe({

        next: res => {

          if (
            id !== this.loadId ||
            version !== this.timelineVersion
          ) {
            return;
          }

          this.mergeResponse(res);

          delete this.errorsPorSeccion['timeline'];

          this.cdr.markForCheck();
        },

        error: err => {

          if (
            id !== this.loadId ||
            version !== this.timelineVersion
          ) {
            return;
          }

          console.error(
            '[Todos] Timeline',
            err
          );

          this.errorsPorSeccion['timeline'] =
            'No se pudo cargar el timeline.';

          this.cdr.markForCheck();
        }

      });
  }

  // =======================================================
  // CAMBIAR INTERVALO: EVOLUCIÓN DE TÓPICOS
  // =======================================================

  onTopicTimelineIntervalChange(
    interval: TimelineInterval
  ): void {

    if (this.topicTimelineInterval === interval) return;

    this.topicTimelineInterval = interval;
    ++this.topicTimelineVersion;

    this.topicTimelineSubscription?.unsubscribe();
    this.topicTimelineSubscription = undefined;

    delete (this.currentResponse as any).topics_timeline_detail;

    if (interval === '1d') {

      this.loadingTopicTimeline = false;

      this.mapResponse(
        this.currentResponse as StatsResponse
      );

    } else if (this.mainFinished) {

      this.cargarSoloTimelineTopicos();

    } else {

      this.loadingTopicTimeline = true;

      this.mapResponse(
        this.currentResponse as StatsResponse
      );
    }

    this.cdr.markForCheck();
  }

  // =======================================================
  // CONSULTAR SOLO EVOLUCIÓN HORARIA DE LOS 5 TÓPICOS
  // =======================================================

  public cargarSoloTimelineTopicos(): void {

    const filters = this.buildFilters();

    if (!filters || !this.mainFinished) return;

    const version = ++this.topicTimelineVersion;
    const id = this.loadId;

    this.topicTimelineSubscription?.unsubscribe();
    this.topicTimelineSubscription = undefined;

    delete (this.currentResponse as any).topics_timeline_detail;

    if (this.topicTimelineInterval === '1d') {

      this.loadingTopicTimeline = false;

      this.mapResponse(
        this.currentResponse as StatsResponse
      );

      this.cdr.markForCheck();
      return;
    }

    const daily = (this.currentResponse as any).topics_timeline;
    const totals = new Map<number, number>();

    if (Array.isArray(daily)) {

      for (const row of daily) {

        const topicId = Number(row.topic_id);

        if (
          !Number.isSafeInteger(topicId) ||
          topicId <= 0
        ) {
          continue;
        }

        totals.set(
          topicId,
          (totals.get(topicId) ?? 0) +
            Number(row.total ?? 0)
        );
      }
    }

    const topIds = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topicId]) => topicId);

    if (topIds.length === 0) {

      this.loadingTopicTimeline = false;

      this.mapResponse(
        this.currentResponse as StatsResponse
      );

      this.cdr.markForCheck();
      return;
    }

    this.loadingTopicTimeline = true;

    this.mapResponse(
      this.currentResponse as StatsResponse
    );

    this.cdr.markForCheck();

    this.topicTimelineSubscription = this.api
      .getStatsTopicsTimeline({
        ...filters,
        topic_ids: topIds,
        timeline_interval: this.topicTimelineInterval
      })
      .pipe(
        finalize(() => {

          if (
            id !== this.loadId ||
            version !== this.topicTimelineVersion
          ) {
            return;
          }

          this.loadingTopicTimeline = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: response => {

          if (
            id !== this.loadId ||
            version !== this.topicTimelineVersion
          ) {
            return;
          }

          this.mergeResponse(
            response as Partial<StatsResponse>
          );

          delete this.errorsPorSeccion['topics_timeline'];
          this.cdr.markForCheck();
        },

        error: err => {

          if (
            id !== this.loadId ||
            version !== this.topicTimelineVersion
          ) {
            return;
          }

          console.error(
            '[Todos] Evolución horaria de tópicos',
            err
          );

          this.errorsPorSeccion['topics_timeline'] =
            'No se pudo cargar la evolución horaria de tópicos.';

          this.cdr.markForCheck();
        }
      });
  }

  // =======================================================
  // CARGAR COMENTARIOS
  // =======================================================

  private cargarComentariosSiCorresponde(): void {

    if (
      !this.mainFinished ||
      this.accessLoading ||
      !this.canViewReplies
    ) {
      return;
    }

    const filters = this.lastFilters;

    if (!filters) return;

    if (filters.topic_ids.length > 0) return;

    if (
      this.commentsRequestedForLoad ===
      this.loadId
    ) {
      return;
    }

    const id = this.loadId;

    this.commentsRequestedForLoad = id;
    this.loadingComentarios = true;

    this.cdr.markForCheck();

    this.commentsSubscription = this.api
      .getStatsComentarios(filters)
      .pipe(

        finalize(() => {

          if (id !== this.loadId) return;

          this.loadingComentarios = false;
          this.cdr.markForCheck();
        })

      )
      .subscribe({

        next: res => {

          if (id !== this.loadId) return;

          this.mergeResponse(res);
          this.cdr.markForCheck();
        },

        error: err => {

          if (id !== this.loadId) return;

          console.error(
            '[Todos] Comentarios',
            err
          );

          this.errorsPorSeccion['comentarios'] =
            'No se pudieron cargar los comentarios.';

          this.cdr.markForCheck();
        }

      });
  }

  // =======================================================
  // MAPEO DE RESPUESTAS
  // =======================================================

  private mapResponse(res: StatsResponse): void {

    // =====================================================
    // KPIS
    // =====================================================

    this.totalPosts =
      Number(res?.posts?.total_posts ?? 0);

    this.totalReplies =
      Number(res?.total_replies?.total ?? 0);

    this.totalRepliesNegativo =
      Number(res?.total_replies?.negativo ?? 0);

    this.totalRepliesNeutro =
      Number(res?.total_replies?.neutro ?? 0);

    this.totalRepliesPositivo =
      Number(res?.total_replies?.positivo ?? 0);

    // =====================================================
    // COMENTARIOS
    // =====================================================

    const repliesTotal =
      this.totalRepliesNegativo +
      this.totalRepliesNeutro +
      this.totalRepliesPositivo;

    if (repliesTotal > 0) {

      this.repliesNegativePercent = Math.round(
        this.totalRepliesNegativo / repliesTotal * 100
      );

      this.repliesNeutralPercent = Math.round(
        this.totalRepliesNeutro / repliesTotal * 100
      );

      this.repliesPositivePercent = Math.round(
        this.totalRepliesPositivo / repliesTotal * 100
      );

      const sentiments = [
        {
          name: 'Negativo',
          value: this.totalRepliesNegativo,
          percent: this.repliesNegativePercent
        },
        {
          name: 'Neutral',
          value: this.totalRepliesNeutro,
          percent: this.repliesNeutralPercent
        },
        {
          name: 'Positivo',
          value: this.totalRepliesPositivo,
          percent: this.repliesPositivePercent
        }
      ];

      const dominant = sentiments.reduce(
        (max, item) =>
          item.value > max.value ? item : max
      );

      this.repliesDominantSentiment = dominant.name;
      this.repliesDominantPercent = dominant.percent;

    } else {

      this.repliesNegativePercent = 0;
      this.repliesNeutralPercent = 0;
      this.repliesPositivePercent = 0;

      this.repliesDominantSentiment = 'Sin datos';
      this.repliesDominantPercent = 0;
    }

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

    // =====================================================
    // MEDIOS
    // =====================================================

    const postsByMedia = Array.isArray(
      res?.posts_by_media
    ) ? res.posts_by_media : [];

    this.postsByMedia = postsByMedia
      .map((item: any) => ({
        id: String(item.id ?? ''),
        usuario: String(
          item.usuario ?? 'Sin nombre'
        ),
        total: Number(item.total ?? 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    this.postsByMediaData = {
      labels: this.postsByMedia.map(
        item => `@${item.usuario}`
      ),
      datasets: [{
        label: 'Publicaciones',
        data: this.postsByMedia.map(
          item => item.total
        ),
        backgroundColor: NETVORA_PALETTE.accent,
        borderRadius: 7,
        borderSkipped: false,
        barThickness: 22,
        maxBarThickness: 26
      }]
    };

    // =====================================================
    // SHARE OF VOICE
    // =====================================================

    this.mediaTotalPosts = Number(
      res?.media_total_posts ?? 0
    );

    const topMedia = this.postsByMedia[0];

    if (topMedia) {

      this.topMediaName = `@${topMedia.usuario}`;
      this.topMediaPosts = topMedia.total;

      this.topMediaShare =
        this.mediaTotalPosts > 0
          ? topMedia.total / this.mediaTotalPosts * 100
          : 0;

    } else {

      this.topMediaName = '—';
      this.topMediaPosts = 0;
      this.topMediaShare = 0;
    }

    const top3Total = this.postsByMedia
      .slice(0, 3)
      .reduce(
        (sum, item) => sum + item.total,
        0
      );

    const top5Total = this.postsByMedia
      .slice(0, 5)
      .reduce(
        (sum, item) => sum + item.total,
        0
      );

    this.top3MediaShare =
      this.mediaTotalPosts > 0
        ? top3Total / this.mediaTotalPosts * 100
        : 0;

    this.top5MediaShare =
      this.mediaTotalPosts > 0
        ? top5Total / this.mediaTotalPosts * 100
        : 0;

    // =====================================================
    // COMPARACIÓN DE PERÍODOS
    // =====================================================

    const comparison = res?.comparison;

    this.postsChange =
      comparison?.posts?.change !== undefined
        ? comparison.posts.change
        : null;

    this.previousPosts = Number(
      comparison?.posts?.previous ?? 0
    );

    this.previousPeriodStart =
      comparison?.period?.previous_start ?? '';

    this.previousPeriodEnd =
      comparison?.period?.previous_end ?? '';

    // =====================================================
    // ENTIDADES
    // =====================================================

    this.topLocacion =
      (res?.locacion ?? []).slice(0, 3);

    this.topOrganizacion =
      (res?.organizacion ?? []).slice(0, 3);

    this.topPersona =
      (res?.persona ?? []).slice(0, 3);

    // =====================================================
    // TOP TÓPICOS Y EVOLUCIÓN
    // =====================================================

    const topicTimeline = Array.isArray(
      res?.topics_timeline
    ) ? res.topics_timeline : [];

    const topicMap = new Map<number, {
      topic_id: number;
      topic_name: string;
      total: number;
    }>();

    topicTimeline.forEach((item: any) => {

      const topicId = Number(item.topic_id);

      if (!topicMap.has(topicId)) {

        topicMap.set(topicId, {
          topic_id: topicId,
          topic_name: String(
            item.topic_name || 'Sin nombre'
          ),
          total: 0
        });
      }

      const topic = topicMap.get(topicId);

      if (topic) {
        topic.total += Number(item.total || 0);
      }
    });

    const topTopics = Array.from(
      topicMap.values()
    )
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (topTopics.length > 0) {

      this.analysisTopTopic =
        topTopics[0].topic_name;

      this.analysisTopTopicTotal =
        topTopics[0].total;

    } else {

      this.analysisTopTopic = '';
      this.analysisTopTopicTotal = 0;
    }

    this.topTopicsData = {
      labels: topTopics.map(
        item => this.truncateTopic(
          item.topic_name,
          58
        )
      ),
      datasets: [{
        label: 'Publicaciones',
        data: topTopics.map(
          item => item.total
        ),
        backgroundColor: NETVORA_PALETTE.accent,
        borderRadius: 7,
        borderSkipped: false,
        barThickness: 22,
        maxBarThickness: 26
      }]
    };

    // =====================================================
    // EVOLUCIÓN DE TÓPICOS: DIARIA U HORARIA
    // =====================================================

    const topicDetail =
      (res as any)?.topics_timeline_detail;

    const topicRows: any[] =
      this.topicTimelineInterval === '1d'
        ? topicTimeline
        : Array.isArray(topicDetail)
          ? topicDetail
          : [];

    const fechas: string[] = Array.from(
      new Set<string>(
        topicRows.map(
          (item: any) => String(item.fecha)
        )
      )
    );

    fechas.sort(
      (a, b) =>
        new Date(a).getTime() -
        new Date(b).getTime()
    );

    const timelineTopics = Array.from(
      topicMap.values()
    )
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const topicColors = [
      '#6d28d9',
      '#2563eb',
      '#059669',
      '#ea580c',
      '#dc2626'
    ];

    this.topicsTimelineData = {

      labels: fechas.map(
        fecha => this.formatTopicTimelineLabel(
          fecha,
          this.topicTimelineInterval
        )
      ),

      datasets: (topicRows.length ? timelineTopics : []).map(
        (topic, index) => {

          const data = fechas.map(fecha => {

            const item = topicRows.find(
              (row: any) =>
                Number(row.topic_id) === topic.topic_id &&
                String(row.fecha) === fecha
            );

            return item
              ? Number(item.total ?? 0)
              : 0;
          });

          const color = topicColors[
            index % topicColors.length
          ];

          
return {
  label: this.truncateTopic(
    topic.topic_name,
    38
  ),
  data,

  // Color de la línea
  borderColor: color,
  backgroundColor: color,

  // Los puntos usan el mismo color que su línea
  pointBackgroundColor: color,
  pointBorderColor: '#ffffff',
  pointBorderWidth: 1.5,

  // Color al pasar el mouse
  pointHoverBackgroundColor: color,
  pointHoverBorderColor: '#ffffff',
  pointHoverBorderWidth: 2,

  // Apariencia
  tension: 0.35,
  fill: false,
  pointRadius: 3,
  pointHoverRadius: 5,
  borderWidth: 2
};


        }
      )
    };

    // =====================================================
    // TÓPICOS EMERGENTES
    // =====================================================

    const emergingTopics = Array.isArray(
      res?.emerging_topics
    ) ? res.emerging_topics : [];

    this.currentEmergingTopics = emergingTopics;

    this.emergingTopicsData = {

      labels: emergingTopics.map(
        (item: any) =>
          this.truncateTopic(
            String(item.topic_name || 'Sin nombre'),
            55
          )
      ),

      datasets: [{
        label: 'Crecimiento',
        data: emergingTopics.map(
          (item: any) =>
            Number(item.diferencia || 0)
        ),
        backgroundColor: '#6d28d9',
        borderRadius: 7,
        borderSkipped: false,
        barThickness: 22,
        maxBarThickness: 26
      }]
    };

    // =====================================================
    // SENTIMIENTO POR TÓPICO
    // =====================================================

    const topicSentiment = Array.isArray(
      res?.topic_sentiment
    ) ? res.topic_sentiment : [];

    let positiveTotal = 0;
    let neutralTotal = 0;
    let negativeTotal = 0;

    let mostPositive: any = null;
    let mostNegative: any = null;

    let mostPositivePercent = -1;
    let mostNegativePercent = -1;

    topicSentiment.forEach((item: any) => {

      const positivos = Number(item.positivos || 0);
      const neutrales = Number(item.neutrales || 0);
      const negativos = Number(item.negativos || 0);

      const total =
        positivos + neutrales + negativos;

      positiveTotal += positivos;
      neutralTotal += neutrales;
      negativeTotal += negativos;

      if (total <= 0) return;

      const positivePercent =
        positivos / total * 100;

      const negativePercent =
        negativos / total * 100;

      if (positivePercent > mostPositivePercent) {
        mostPositivePercent = positivePercent;
        mostPositive = item;
      }

      if (negativePercent > mostNegativePercent) {
        mostNegativePercent = negativePercent;
        mostNegative = item;
      }
    });

    const sentimentGrandTotal =
      positiveTotal +
      neutralTotal +
      negativeTotal;

    if (sentimentGrandTotal > 0) {

      this.analysisPositivePercent = Math.round(
        positiveTotal / sentimentGrandTotal * 100
      );

      this.analysisNeutralPercent = Math.round(
        neutralTotal / sentimentGrandTotal * 100
      );

      this.analysisNegativePercent = Math.round(
        negativeTotal / sentimentGrandTotal * 100
      );

    } else {

      this.analysisPositivePercent = 0;
      this.analysisNeutralPercent = 0;
      this.analysisNegativePercent = 0;
    }

    this.analysisMostPositiveTopic =
      mostPositive?.topic_name || '';

    this.analysisMostNegativeTopic =
      mostNegative?.topic_name || '';

    const topicPercentage = (
      item: any,
      field: 'positivos' | 'neutrales' | 'negativos'
    ): number => {

      const positivos = Number(item.positivos || 0);
      const neutrales = Number(item.neutrales || 0);
      const negativos = Number(item.negativos || 0);

      const total =
        positivos + neutrales + negativos;

      return total > 0
        ? Number(item[field] || 0) / total * 100
        : 0;
    };

    this.topicSentimentData = {

      labels: topicSentiment.map(
        (item: any) =>
          this.truncateTopic(
            String(item.topic_name || 'Sin nombre'),
            45
          )
      ),

      datasets: [
        {
          label: 'Positivo',
          data: topicSentiment.map(
            (item: any) =>
              topicPercentage(item, 'positivos')
          ),
          backgroundColor: '#16a34a',
          borderRadius: 0,
          borderSkipped: false
        },
        {
          label: 'Neutral',
          data: topicSentiment.map(
            (item: any) =>
              topicPercentage(item, 'neutrales')
          ),
          backgroundColor: '#94a3b8',
          borderRadius: 0,
          borderSkipped: false
        },
        {
          label: 'Negativo',
          data: topicSentiment.map(
            (item: any) =>
              topicPercentage(item, 'negativos')
          ),
          backgroundColor: '#dc2626',
          borderRadius: 0,
          borderSkipped: false
        }
      ]
    };

    // =====================================================
    // TIMELINE / ACTIVIDAD
    // =====================================================

    const tl = res?.time_line ?? [];

    const timelineRows = tl.map((x: any) => ({
      fecha: String(x.fecha ?? ''),
      total: Number(x.total ?? 0)
    }));

    this.activityTotal = timelineRows.reduce(
      (sum, item) => sum + item.total,
      0
    );

    this.activityAverage = timelineRows.length
      ? Math.round(
          this.activityTotal / timelineRows.length
        )
      : 0;

    const peakItem = timelineRows.reduce(
      (max, item) =>
        item.total > max.total
          ? item
          : max,
      {
        fecha: '',
        total: 0
      }
    );

    this.activityPeak = peakItem.total;

    this.activityPeakDate = peakItem.fecha
      ? this.formatTimelineLabel(peakItem.fecha)
      : '';

    if (timelineRows.length >= 2) {

      const current =
        timelineRows[timelineRows.length - 1].total;

      const previous =
        timelineRows[timelineRows.length - 2].total;

      if (previous > 0) {

        this.activityVariation =
          (current - previous) / previous * 100;

      } else if (current > 0) {

        this.activityVariation = 100;

      } else {

        this.activityVariation = 0;
      }

    } else {

      this.activityVariation = null;
    }

    // =====================================================
    // TIMELINE CONFIGURABLE
    // =====================================================

    const detail =
      (res as any)?.time_line_detail;

    const hasHourlyDetail =
      this.timelineInterval !== '1d' &&
      Array.isArray(detail);

    const graphicRows: {
      fecha: string;
      total: number;
    }[] = hasHourlyDetail
      ? detail.map((x: any) => ({
          fecha: String(x.fecha ?? ''),
          total: Number(x.total ?? 0)
        }))
      : timelineRows;

    const graphicPeak = graphicRows.reduce(
      (max, item) => Math.max(max, item.total),
      0
    );

    this.timelineData = {

      labels: graphicRows.map(
        item =>
          this.formatActivityTimelineLabel(item.fecha)
      ),

      datasets: [{
        label: 'Publicaciones',
        data: graphicRows.map(
          item => item.total
        ),
        borderColor: NETVORA_PALETTE.accent,
        backgroundColor: 'rgba(109,40,217,0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: graphicRows.map(
          item => item.total === graphicPeak ? 5 : 2
        ),
        pointHoverRadius: 6,
        pointBackgroundColor: NETVORA_PALETTE.accent,
        pointBorderColor: '#ffffff',
        pointBorderWidth: graphicRows.map(
          item => item.total === graphicPeak ? 2 : 0
        )
      }]
    };

    // =====================================================
    // SENTIMIENTOS
    // =====================================================

    const s =
      res?.sentimientos?.posts_per_sentiment ??
      ({} as any);

    const neg = Number(s.negativo || 0);
    const neu = Number(s.neutro || 0);
    const pos = Number(s.positivo || 0);

    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{
        label: 'Sentimientos',
        data: [neg, neu, pos],
        backgroundColor: [
          NETVORA_PALETTE.sentiment.negativo,
          NETVORA_PALETTE.sentiment.neutro,
          NETVORA_PALETTE.sentiment.positivo
        ],
        borderWidth: 0
      }]
    };

    // =====================================================
    // CATEGORÍAS
    // =====================================================

    const pc =
      res?.posts_categories?.posts_per_category ??
      ({} as any);

    const catLabels = Object.keys(pc);

    const catData = catLabels.map(
      k => Number(pc[k] || 0)
    );

    this.categoriesData = {
      labels: catLabels,
      datasets: [{
        label: 'Categorías',
        data: catData,
        backgroundColor: NETVORA_PALETTE.categories,
        borderWidth: 0
      }]
    };

    this.cdr.markForCheck();
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private toYMD(d: Date): string {

    const year = d.getFullYear();

    const month = String(
      d.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      d.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatActivityTimelineLabel(
    fecha: string
  ): string {

    const day = this.formatTimelineLabel(fecha);

    if (this.timelineInterval === '1d') {
      return day;
    }

    const time = fecha.match(
      /[T ](\d{2}):(\d{2})/
    );

    return time
      ? `${day} ${time[1]}:${time[2]}`
      : day;
  }

  private formatTimelineLabel(
    fecha: string
  ): string {

    if (!fecha) return '';

    const cleanDate = fecha.includes('T')
      ? fecha.split('T')[0]
      : fecha.split(' ')[0];

    const parts = cleanDate.split('-');

    if (parts.length !== 3) {
      return fecha;
    }

    const [, month, day] = parts;

    return `${day}/${month}`;
  }

  private formatTopicTimelineLabel(
    fecha: string,
    interval: TimelineInterval = this.topicTimelineInterval
  ): string {

    const match = String(fecha).match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/
    );

    if (!match) return fecha;

    const label = `${match[3]}/${match[2]}`;

    return interval === '1d' || !match[4]
      ? label
      : `${label} ${match[4]}:${match[5]}`;
  }

  private truncateTopic(
    text: string,
    maxLength: number
  ): string {

    if (!text) return 'Sin nombre';

    return text.length > maxLength
      ? `${text.substring(0, maxLength)}…`
      : text;
  }

  // =========================================================
  // VARIACIÓN DE ACTIVIDAD
  // =========================================================

  get activityVariationPositive(): boolean {
    return (this.activityVariation ?? 0) > 0;
  }

  get activityVariationNegative(): boolean {
    return (this.activityVariation ?? 0) < 0;
  }

  get activityVariationText(): string {

    if (this.activityVariation == null) {
      return 'Sin comparación';
    }

    const value = Math.abs(
      this.activityVariation
    );

    if (this.activityVariation > 0) {
      return `+${value.toFixed(1)}%`;
    }

    if (this.activityVariation < 0) {
      return `-${value.toFixed(1)}%`;
    }

    return '0%';
  }

  // =========================================================
  // EXPORTAR GRÁFICO INDIVIDUAL
  // =========================================================

  downloadChart(event: Event): void {

    const chartContainer = (
      event.target as HTMLElement
    ).closest('.chart');

    const canvas = chartContainer?.querySelector(
      'canvas'
    ) as HTMLCanvasElement | null;

    if (!canvas) return;

    const link = document.createElement('a');

    link.href = exportCanvasWithWhiteBg(canvas);
    link.download = `grafico-${Date.now()}.png`;

    link.click();
  }

  // =========================================================
  // EXPORTAR TODOS LOS GRÁFICOS
  // =========================================================

  public downloadAllCharts(): void {

    const canvases = document.querySelectorAll(
      '.chart canvas'
    ) as NodeListOf<HTMLCanvasElement>;

    if (!canvases.length) return;

    canvases.forEach((canvas, index) => {

      const link = document.createElement('a');

      link.href = exportCanvasWithWhiteBg(canvas);

      link.download =
        `grafico-${index + 1}-${Date.now()}.png`;

      link.click();
    });
  }

  // =========================================================
  // ABRIR DETALLE DEL TÓPICO
  // =========================================================

  openTopic(topic: EmergingTopicItem): void {

    const topicId = Number(topic?.topic_id);

    if (!topicId) return;

    this.router.navigate(
      ['/topics', topicId],
      {
        state: {
          topic_id: topicId,
          topic_name: topic.topic_name,
          startDate: this.startDate,
          endDate: this.endDate,
          selectedUsers:
            this.selectedUsers.length > 0
              ? [...this.selectedUsers]
              : (this.users ?? []).map(
                  user => String(user.idTweetUser)
                ),
          searchText: this.searchText
        }
      }
    );
  }

  // =========================================================
  // PORCENTAJE DE ENTIDADES
  // =========================================================

  getEntityPercent(
    items: EntItem[],
    total: number
  ): number {

    if (!items?.length) return 0;

    const max = Math.max(
      ...items.map(
        item => Number(item.total || 0)
      )
    );

    if (max <= 0) return 0;

    return Math.max(
      4,
      Math.round(
        Number(total || 0) / max * 100
      )
    );
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  formatRank(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  trackByEntidad = (
    _: number,
    item: { entidad: string }
  ) => item.entidad;

}
