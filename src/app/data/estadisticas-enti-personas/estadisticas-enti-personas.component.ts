import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  OnDestroy
} from '@angular/core';

import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { Observable, Subscription, from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { BaseChartDirective } from 'ng2-charts';
import {
  NETVORA_PALETTE,
  exportCanvasWithWhiteBg
} from '../../utils/helpers';
import { users } from '../../interfaces/users';
import { AccountService } from '../../services/account.service';

type TimelineInterval = '1h' | '3h' | '6h' | '12h' | '1d';

type CategorySection =
  | 'resumen'
  | 'timeline'
  | 'fuentes'
  | 'topicos'
  | 'entidades'
  | 'cruces';

interface CategoryFilters {
  start: string;
  end: string;
  users: string[];
  type_user: string;
  topic_ids: number[];
  timeline_interval: TimelineInterval;
  search?: string;
  categoria?: string;
  entidad?: string;
}

type TimelineRow = {
  fecha: string;
  total: number;
};

type EntItem = {
  entidad: string;
  total: number;
};

type TopUserItem = {
  usuario: string;
  total: number;
};

type UserIndiceItem = {
  TweetUser: string;
  pos: number;
  neg: number;
  total: number;
  indice: number;
};

type IndiceSentItem = {
  user: string;
  positivos: number;
  negativos: number;
  total: number;
  indice: number;
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
  selector: 'app-estadisticas-enti-personas',
  templateUrl: './estadisticas-enti-personas.component.html',
  styleUrl: './estadisticas-enti-personas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstadisticasEntiPersonasComponent
  implements OnInit, OnChanges, OnDestroy {

  // =====================================================
  // INPUTS
  // =====================================================

  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;

  @Input() selectedUsers: string[] = [];
  @Input() categoria: string = 'none';
  @Input() users: users[] = [];

  @Input() type_user: string = 'Persona';
  @Input() searchText: string = '';

  @Input() entidad: string = 'none';
  @Input() selectedTopics: number[] = [];

  @ViewChild(BaseChartDirective)
  timelineChart?: BaseChartDirective;

  // =====================================================
  // ESTADOS GENERALES
  // =====================================================

  loading = true;
errorMsg = '';

loadingResumen = true;
loadingTimeline = true;
loadingFuentes = true;
loadingTopicos = true;
loadingEntidades = true;
loadingCruces = true;
loadingComentarios = false;

  errorsPorSeccion: Record<string, string> = {};

  private currentResponse: Record<string, any> = {};

  private mainSubscription?: Subscription;
  private timelineSubscription?: Subscription;
  private topicTimelineSubscription?: Subscription;
  private topicTimelineVersion = 0;
  private topicTimelineDailyRows: any[] = [];
  private topicTimelineTopIds: number[] = [];
  private topicTimelineNames = new Map<number, string>();
  topicTimelineInterval: TimelineInterval = '1h';
  loadingTopicTimeline = false;
  private commentsSubscription?: Subscription;
  private accessSubscription?: Subscription;
  private wordcloudSubscription?: Subscription;

  private loadId = 0;
  private timelineVersion = 0;
  private wordcloudVersion = 0;

  private mainFinished = false;
  private commentsRequestedForLoad = -1;

  private lastFilters: CategoryFilters | null = null;

  get cargandoDashboard(): boolean {
    return (
      this.loadingResumen ||
      this.loadingTimeline ||
      this.loadingFuentes ||
      this.loadingTopicos ||
      this.loadingEntidades ||
      this.loadingCruces ||
      this.loadingComentarios
    );
  }

  get cargandoVistaComentarios(): boolean {
    return (
      this.canViewReplies &&
      !!this.lastFilters &&
      (!this.mainFinished || this.loadingComentarios)
    );
  }

  // =====================================================
  // KPI
  // =====================================================

  totalPosts = 0;

  postsChange: number | null = null;
  previousPosts = 0;
  previousPeriodStart = '';
  previousPeriodEnd = '';

  readonly Math = Math;

  // =====================================================
  // PUBLICACIONES POR CUENTA + SHARE OF VOICE
  // =====================================================

  postsByAccount: Array<{
    usuario: string;
    total: number;
  }> = [];

  accountTotalPosts = 0;

  accountLeader = '';
  accountLeaderPosts = 0;
  accountLeaderShare = 0;

  accountTop3Share = 0;
  accountTop5Share = 0;

  // =====================================================
  // ENTIDADES
  // =====================================================

  topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];

  // =====================================================
  // COMENTARIOS
  // =====================================================

  totalReplies = 0;
  totalRepliesNegativo = 0;
  totalRepliesNeutro = 0;
  totalRepliesPositivo = 0;

  viewModeReplies: 'table' | 'chart' = 'table';

  // =====================================================
  // ENTIDADES POR TÓPICO
  // =====================================================

  entitiesByTopicPersona: TopicEntity[] = [];
  entitiesByTopicOrganizacion: TopicEntity[] = [];
  entitiesByTopicLocacion: TopicEntity[] = [];

  selectedTopicEntityType: TopicEntityType = 'persona';

  // =====================================================
  // TOP USUARIOS
  // =====================================================

  topUsers: TopUserItem[] = [];

  // =====================================================
  // SELECTORES DE GRÁFICOS
  // =====================================================

  sentimentChartType: ChartType = 'doughnut';

  readonly sentimentTypeOptions: ChartType[] = [
    'doughnut',
    'pie',
    'bar'
  ];

  // =====================================================
  // TIMELINE
  // =====================================================

  timelineInterval: TimelineInterval = '1h';

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

  onTimelineIntervalChange(
    interval: TimelineInterval
  ): void {

    if (this.timelineInterval === interval) {
      return;
    }

    this.timelineInterval = interval;

    const filters = this.buildFilters();

    this.cargarSoloTimeline();
  }

  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Publicaciones',
      data: [],
      tension: 0.35,
      fill: false,
      pointRadius: 2,
      borderColor: NETVORA_PALETTE.timeline.line,
      backgroundColor: NETVORA_PALETTE.timeline.fill,
      pointBackgroundColor: NETVORA_PALETTE.timeline.point,
      pointHoverRadius: 4,
      borderWidth: 2
    }]
  };

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        ticks: { maxRotation: 0 }
      },
      y: {
        beginAtZero: true
      }
    }
  };

  // =====================================================
  // TOP TÓPICOS
  // =====================================================

  topTopicsData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Publicaciones',
      data: [],
      backgroundColor: '#6d28d9',
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
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: context => {
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

  // =====================================================
  // PUBLICACIONES POR CUENTA
  // =====================================================

  postsByAccountChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Publicaciones',
      data: []
    }]
  };

  readonly postsByAccountChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: context => {

            const value = Number(context.raw ?? 0);

            const share =
              this.accountTotalPosts > 0
                ? (value / this.accountTotalPosts) * 100
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
  };

  // =====================================================
  // EVOLUCIÓN DE TÓPICOS
  // =====================================================

  onTopicTimelineIntervalChange(interval: TimelineInterval): void {
    if (this.topicTimelineInterval === interval) return;
    this.topicTimelineInterval = interval;
    ++this.topicTimelineVersion;
    this.topicTimelineSubscription?.unsubscribe();
    if (interval === '1d') {
      this.loadingTopicTimeline = false;
      this.actualizarGraficaEvolucionTopicos(this.topicTimelineDailyRows);
    } else {
      this.cargarSoloTimelineTopicos();
    }
    this.cdr.markForCheck();
  }

  private actualizarGraficaEvolucionTopicos(rows: any[]): void {
    const fechas = [...new Set(rows.map(r => String(r.fecha ?? '')))]
      .filter(Boolean).sort();
    const colors = ['#6d28d9', '#2563eb', '#059669', '#ea580c', '#dc2626'];
    const values = new Map<string, number>();
    rows.forEach(row => {
      const key = `${Number(row.topic_id)}|${String(row.fecha)}`;
      values.set(key, (values.get(key) ?? 0) + Number(row.total ?? 0));
    });
    this.topicsTimelineData = {
      labels: fechas.map(fecha => this.formatActivityTimelineLabel(
        fecha, this.topicTimelineInterval !== '1d')),
      datasets: this.topicTimelineTopIds.map((id, i) => ({
        label: this.truncateTopic(this.topicTimelineNames.get(id) ?? `Tópico ${id}`, 38),
        data: fechas.map(fecha => values.get(`${id}|${fecha}`) ?? 0),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length],
        pointBackgroundColor: colors[i % colors.length],
        tension: 0.35,
        fill: false,
        pointRadius: 3,
        borderWidth: 2
      }))
    };
  }

  private cargarSoloTimelineTopicos(): void {
    const filters = this.buildFilters();
    const id = this.loadId;
    const version = ++this.topicTimelineVersion;
    this.topicTimelineSubscription?.unsubscribe();
    if (!filters || !this.topicTimelineTopIds.length) {
      this.loadingTopicTimeline = false;
      this.topicsTimelineData = { labels: [], datasets: [] };
      this.cdr.markForCheck();
      return;
    }
    this.loadingTopicTimeline = true;
    this.topicTimelineSubscription = this.apiService.getCategoryTopicsTimeline({
      start: filters.start,
      end: filters.end,
      users: filters.users,
      categoria: filters.categoria ?? 'none',
      type_user: filters.type_user,
      search: filters.search,
      topic_ids: [...this.topicTimelineTopIds],
      timeline_interval: this.topicTimelineInterval
    }).pipe(finalize(() => {
      if (id !== this.loadId || version !== this.topicTimelineVersion) return;
      this.loadingTopicTimeline = false;
      this.cdr.markForCheck();
    })).subscribe({
      next: (res: any) => {
        if (id !== this.loadId || version !== this.topicTimelineVersion) return;
        this.actualizarGraficaEvolucionTopicos(
          Array.isArray(res?.topics_timeline_detail) ? res.topics_timeline_detail : []
        );
        this.cdr.markForCheck();
      },
      error: err => {
        if (id !== this.loadId || version !== this.topicTimelineVersion) return;
        console.error('[Personas/Entidades] Evolución tópicos', err);
        this.errorsPorSeccion['topicos_timeline'] = 'No se pudo cargar la evolución de tópicos.';
        this.cdr.markForCheck();
      }
    });
  }

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
          label: context => {

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
          color: 'rgba(15,23,42,0.05)'
        },
        ticks: {
          precision: 0,
          color: '#64748b'
        }
      }
    }
  };

  // =====================================================
  // TÓPICOS POR USUARIO
  // =====================================================

  topicsByUserData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  readonly topicsByUserOptions: ChartOptions<'bar'> = {
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
          padding: 16,
          boxWidth: 8,
          boxHeight: 8
        }
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: context => {

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
          color: 'rgba(15,23,42,0.05)'
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
  };

  // =====================================================
  // COMENTARIOS: GRÁFICO
  // =====================================================

  readonly repliesChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    animation: false,
    hover: {
      mode: 'nearest'
    },
    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        enabled: true
      }
    },
    elements: {
      arc: {
        borderWidth: 0,
        hoverOffset: 6
      }
    }
  };

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

  // =====================================================
  // SENTIMIENTOS GENERALES
  // =====================================================

  sentimentData: ChartData = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{
      label: 'Sentimientos',
      data: [0, 0, 0]
    }]
  };

  readonly commonOptions: ChartOptions = {
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

  // =====================================================
  // SENTIMIENTO POR USUARIO
  // =====================================================

  sentVsUserData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Negativo',
        data: [],
        backgroundColor:
          NETVORA_PALETTE.sentVsUser.negativo,
        borderWidth: 0,
        borderRadius: 6
      },
      {
        label: 'Neutro',
        data: [],
        backgroundColor:
          NETVORA_PALETTE.sentVsUser.neutro,
        borderWidth: 0,
        borderRadius: 6
      },
      {
        label: 'Positivo',
        data: [],
        backgroundColor:
          NETVORA_PALETTE.sentVsUser.positivo,
        borderWidth: 0,
        borderRadius: 6
      }
    ]
  };

  sentVsUserOptions: ChartOptions<'bar'> = {
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
        stacked: true,
        ticks: {
          maxRotation: 0
        }
      },
      y: {
        stacked: true,
        beginAtZero: true
      }
    }
  };

  // =====================================================
  // ÍNDICE DE SENTIMIENTO
  // =====================================================

  userIndice: UserIndiceItem[] = [];

  userIndiceChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Índice',
      data: []
    }]
  };

  userIndiceChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        callbacks: {
          label: ctx => {

            const value = Number(ctx.raw ?? 0);

            return `Índice: ${value.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        min: -100,
        max: 100,
        ticks: {
          callback: value => `${value}%`
        }
      },
      y: {
        ticks: {
          autoSkip: false
        }
      }
    }
  };

  indiceSent: IndiceSentItem[] = [];

  // =====================================================
  // WORDCLOUD
  // =====================================================

  wordcloudUrl: string | null = null;
  loadingWordcloud = false;

  // =====================================================
  // ACCESO A COMENTARIOS
  // =====================================================

  accessLoading = true;

  currentRole = 'viewer';
  subscriptionPlan = '';
  subscriptionStatus = '';

  get canViewReplies(): boolean {

    if (this.currentRole === 'admin') {
      return true;
    }

    return (
      this.subscriptionStatus === 'activa' &&
      this.subscriptionPlan === 'pro'
    );
  }

  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private accountService: AccountService
  ) {}

  // =====================================================
  // CICLO DE VIDA
  // =====================================================

  ngOnInit(): void {

    // El padre puede entregar usuarios después.
    // ngOnChanges controla la carga inicial.

    this.loadAccess();
  }

  ngOnDestroy(): void {

    ++this.loadId;
    ++this.timelineVersion;
    ++this.wordcloudVersion;
    ++this.topicTimelineVersion;

    this.cancelPendingRequests();

    this.accessSubscription?.unsubscribe();
    this.wordcloudSubscription?.unsubscribe();

    if (this.wordcloudUrl) {
      URL.revokeObjectURL(this.wordcloudUrl);
      this.wordcloudUrl = null;
    }
  }

  // =====================================================
  // PERMISOS
  // =====================================================

  private loadAccess(): void {

    this.accessLoading = true;

    this.accessSubscription = this.accountService
      .me()
      .subscribe({

        next: (res: any) => {

          const role = String(
            res?.user?.role || 'viewer'
          ).trim().toLowerCase();

          this.currentRole =
            role === 'admin' ? 'admin' : 'viewer';

          this.subscriptionPlan = String(
            res?.subscription?.plan?.name ??
            res?.subscription?.plan ??
            ''
          ).trim().toLowerCase();

          this.subscriptionStatus = String(
            res?.subscription?.status ?? ''
          ).trim().toLowerCase();

          this.accessLoading = false;

          this.cargarComentariosSiCorresponde();

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

  // =====================================================
  // CAMBIOS EN LOS FILTROS
  // =====================================================

  ngOnChanges(changes: SimpleChanges): void {

    const changed = [
      'startDate',
      'endDate',
      'users',
      'selectedUsers',
      'searchText',
      'type_user',
      'categoria',
      'entidad',
      'selectedTopics'
    ].some(key => !!changes[key]);

    if (!changed) {
      return;
    }

    this.cargarDatos();
    this.loadWordcloud();
  }

  // =====================================================
  // USUARIOS PARA LAS CONSULTAS
  // =====================================================

  private getUsersToSend(): string[] {

    if (this.selectedUsers?.length) {
      return this.selectedUsers
        .map(String)
        .filter(Boolean);
    }

    return (this.users ?? [])
      .map(user => String(user.idTweetUser))
      .filter(Boolean);
  }

  // =====================================================
  // CONSTRUIR FILTROS
  // =====================================================

  private buildFilters(): CategoryFilters | null {

    if (!this.startDate) {
      return null;
    }

    const selected = this.getUsersToSend();

    if (!selected.length) {
      return null;
    }

    const filters: CategoryFilters = {
      start: this.toYMD(this.startDate),
      end: this.toYMD(
        this.endDate ?? this.startDate
      ),
      users: selected,
      type_user: this.type_user || 'Persona',
      topic_ids: [...(this.selectedTopics ?? [])],
      timeline_interval: this.timelineInterval
    };

    const search = (this.searchText ?? '').trim();

    if (search) {
      filters.search = search;
    }

    // Respetar el valor 'none'.

    const cat = (this.categoria ?? '').trim();

    if (
      cat &&
      cat.toLowerCase() !== 'none'
    ) {
      filters.categoria = cat;
    }

    const ent = (this.entidad ?? '').trim();

    if (
      ent &&
      ent.toLowerCase() !== 'none'
    ) {
      filters.entidad = ent;
    }

    return filters;
  }

  // =====================================================
  // FILTROS QUE NECESITAN ENDPOINT ORIGINAL
  // =====================================================

  private usaEndpointOriginal(
    filters: CategoryFilters
  ): boolean {

    // Los endpoints independientes no aplican todavía
    // el filtro específico de entidad.
    // Tampoco todos aceptan topic_ids.

    return (
      filters.topic_ids.length > 0 ||
      !!filters.entidad
    );
  }

  // =====================================================
  // CANCELAR PETICIONES
  // =====================================================

  private cancelPendingRequests(): void {

    this.mainSubscription?.unsubscribe();
    this.timelineSubscription?.unsubscribe();
    this.topicTimelineSubscription?.unsubscribe();
    this.commentsSubscription?.unsubscribe();

    this.mainSubscription = undefined;
    this.timelineSubscription = undefined;
    this.topicTimelineSubscription = undefined;
    this.commentsSubscription = undefined;
  }

  // =====================================================
  // CARGA POR SECCIÓN
  // =====================================================

  private setSectionLoading(
    section: CategorySection,
    value: boolean
  ): void {

    switch (section) {

      case 'resumen':
        this.loadingResumen = value;
        break;

      case 'timeline':
        this.loadingTimeline = value;
        break;

      case 'fuentes':
        this.loadingFuentes = value;
        break;

      case 'topicos':
        this.loadingTopicos = value;
        break;

      case 'entidades':
        this.loadingEntidades = value;
        break;

      case 'cruces':
        this.loadingCruces = value;
        break;
    }

    this.loading =
      this.loadingResumen ||
      this.loadingTimeline ||
      this.loadingFuentes ||
      this.loadingTopicos ||
      this.loadingEntidades ||
      this.loadingCruces;
  }

  // =====================================================
  // FUSIONAR RESPUESTAS
  // =====================================================

  private mergeResponse(
    part: Record<string, any>
  ): void {

    this.currentResponse = {
      ...this.currentResponse,
      ...part
    };

    this.mapResponse(this.currentResponse);
  }

  // =====================================================
  // CARGA GENERAL DE DATOS
  // =====================================================

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
    if (filters?.entidad || filters?.topic_ids.length) {
      this.errorMsg = 'Aviso: algunos endpoints separados todavía no aplican los filtros de entidad o tópicos seleccionados.';
    }

    this.currentResponse = {};
    this.topicTimelineDailyRows = [];
    this.topicTimelineTopIds = [];
    this.topicTimelineNames.clear();
    this.loadingTopicTimeline = false;

    this.mapResponse({});

    // ===================================================
    // SIN FILTROS VÁLIDOS
    // ===================================================

    if (!filters) {

  this.loading = true;
  this.loadingResumen = true;
  this.loadingTimeline = true;
  this.loadingFuentes = true;
  this.loadingTopicos = true;
  this.loadingEntidades = true;
  this.loadingCruces = true;
  this.loadingComentarios = false;

  this.errorMsg = '';

  this.cdr.markForCheck();

  return;
}

    // ===================================================
    // ACTIVAR CARGAS
    // ===================================================

    this.loadingResumen = true;
    this.loadingTimeline = true;
    this.loadingFuentes = true;
    this.loadingTopicos = true;
    this.loadingEntidades = true;
    this.loadingCruces = true;
    this.loadingComentarios = false;

    this.loading = true;

    this.cdr.markForCheck();

    const expectedTimelineVersion =
      this.timelineVersion;

    // ===================================================
    // ENDPOINTS INDEPENDIENTES
    // ===================================================

    const jobs: Array<{
      section: CategorySection;
      request: () => Observable<any>;
    }> = [
      {
        section: 'resumen',
        request: () =>
          this.apiService.getCategoryResumen(filters)
      },
      {
        section: 'timeline',
        request: () =>
          this.apiService.getCategoryTimeline(filters)
      },
      {
        section: 'fuentes',
        request: () =>
          this.apiService.getCategoryFuentes(filters)
      },
      {
        section: 'topicos',
        request: () =>
          this.apiService.getCategoryTopicos(filters)
      },
      {
        section: 'entidades',
        request: () =>
          this.apiService.getCategoryEntidades(filters)
      },
      {
        section: 'cruces',
        request: () =>
          this.apiService.getCategoryCruces(filters)
      }
    ];

    // Máximo dos solicitudes HTTP simultáneas.

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
                `[Personas/Entidades] ${job.section}`,
                err
              );

              return of({
                section: job.section,
                response: null,
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

          this.loadingFuentes = false;
          this.loadingTopicos = false;
          this.loadingEntidades = false;
          this.loadingCruces = false;

          this.loading = false;

          this.cargarComentariosSiCorresponde();

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

          // Evitar respuesta de timeline antiguo.

          if (
            section === 'timeline' &&
            expectedTimelineVersion !==
              this.timelineVersion
          ) {
            return;
          }

          this.setSectionLoading(section, false);

          if (failed || !response) {

            this.errorsPorSeccion[section] =
              `No se pudo cargar ${section}.`;

            if (section === 'resumen') {
              this.errorMsg =
                'No se pudo cargar el resumen.';
            }

          } else {

            this.mergeResponse(response);

            delete this.errorsPorSeccion[section];
          }

          this.cdr.markForCheck();
        }
      });
  }

  // =====================================================
  // CARGAR SOLO EL TIMELINE
  // =====================================================

  public cargarSoloTimeline(): void {

    const filters = this.buildFilters();

    if (!filters) return;

    const id = this.loadId;
    const version = ++this.timelineVersion;

    this.timelineSubscription?.unsubscribe();

    this.loadingTimeline = true;

    delete this.currentResponse['time_line_detail'];
    delete this.currentResponse['time_line'];

    this.mapResponse(this.currentResponse);

    this.cdr.markForCheck();

    this.timelineSubscription = this.apiService
      .getCategoryTimeline(filters)
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
            '[Personas/Entidades] Timeline',
            err
          );

          this.errorsPorSeccion['timeline'] =
            'No se pudo cargar la línea de tiempo.';

          this.cdr.markForCheck();
        }
      });
  }

  // =====================================================
  // COMENTARIOS PRO
  // =====================================================

  private cargarComentariosSiCorresponde(): void {

    if (
      !this.mainFinished ||
      this.accessLoading ||
      !this.canViewReplies
    ) {
      return;
    }

    const filters = this.lastFilters;

    if (!filters) {
      return;
    }

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

    this.commentsSubscription = this.apiService
      .getCategoryComentarios(filters)
      .pipe(

        finalize(() => {

          if (id !== this.loadId) return;

          this.loadingComentarios = false;

          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: (res: any) => {

          if (id !== this.loadId) return;

          this.mergeResponse(res);

          delete this.errorsPorSeccion['comentarios'];

          this.cdr.markForCheck();
        },

        error: err => {

          if (id !== this.loadId) return;

          console.error(
            '[Personas/Entidades] Comentarios',
            err
          );

          this.errorsPorSeccion['comentarios'] =
            'No se pudieron cargar los comentarios.';

          this.cdr.markForCheck();
        }
      });
  }

  // =====================================================
  // MAPEAR RESPUESTA
  // =====================================================

  private mapResponse(res: any): void {

    // ===================================================
    // KPI
    // ===================================================

    this.totalPosts =
      res?.total_posts?.total_posts ??
      res?.total_posts ??
      0;

    this.totalReplies =
      res?.total_replies?.total ?? 0;

    this.totalRepliesNegativo =
      res?.total_replies?.negativo ?? 0;

    this.totalRepliesNeutro =
      res?.total_replies?.neutro ?? 0;

    this.totalRepliesPositivo =
      res?.total_replies?.positivo ?? 0;

    // ===================================================
    // ENTIDADES
    // ===================================================

    this.topLocacion = this.normalizeArray(
      res?.locacion
    ).slice(0, 10);

    this.topOrganizacion = this.normalizeArray(
      res?.organizacion
    ).slice(0, 10);

    this.topPersona = this.normalizeArray(
      res?.persona
    ).slice(0, 10);

    // ===================================================
    // PUBLICACIONES POR CUENTA
    // ===================================================

    this.postsByAccount = Array.isArray(
      res?.posts_by_account
    )
      ? res.posts_by_account.map((item: any) => ({
          usuario: String(
            item?.usuario ?? ''
          ),
          total: Number(
            item?.total ?? 0
          )
        }))
      : [];

    this.postsByAccount.sort(
      (a, b) => b.total - a.total
    );

    this.accountTotalPosts = Number(
      res?.account_total_posts ?? 0
    );

    // ===================================================
    // CUENTA LÍDER
    // ===================================================

    const accountLeader = this.postsByAccount[0];

    this.accountLeader =
      accountLeader?.usuario ?? '';

    this.accountLeaderPosts =
      accountLeader?.total ?? 0;

    this.accountLeaderShare =
      this.accountTotalPosts > 0
        ? (
            this.accountLeaderPosts /
            this.accountTotalPosts
          ) * 100
        : 0;

    // ===================================================
    // TOP 3
    // ===================================================

    const accountTop3Total =
      this.postsByAccount
        .slice(0, 3)
        .reduce(
          (sum, item) => sum + item.total,
          0
        );

    this.accountTop3Share =
      this.accountTotalPosts > 0
        ? (
            accountTop3Total /
            this.accountTotalPosts
          ) * 100
        : 0;

    // ===================================================
    // TOP 5
    // ===================================================

    const accountTop5Total =
      this.postsByAccount
        .slice(0, 5)
        .reduce(
          (sum, item) => sum + item.total,
          0
        );

    this.accountTop5Share =
      this.accountTotalPosts > 0
        ? (
            accountTop5Total /
            this.accountTotalPosts
          ) * 100
        : 0;

    // ===================================================
    // GRÁFICO POR CUENTA
    // ===================================================

    this.postsByAccountChartData = {
      labels: this.postsByAccount.map(
        item => item.usuario
      ),
      datasets: [{
        label: 'Publicaciones',
        data: this.postsByAccount.map(
          item => item.total
        )
      }]
    };

    // ===================================================
    // TÓPICOS PRINCIPALES
    // ===================================================

    const topTopics = Array.isArray(
      res?.top_topics
    )
      ? res.top_topics
      : [];

    this.topTopicsData = {
      labels: topTopics.map((item: any) =>
        this.truncateTopic(
          String(item.topic_name || 'Sin nombre'),
          55
        )
      ),
      datasets: [{
        label: 'Publicaciones',
        data: topTopics.map(
          (item: any) => Number(item.total || 0)
        ),
        backgroundColor: '#6d28d9',
        borderRadius: 7,
        borderSkipped: false,
        barThickness: 22,
        maxBarThickness: 26
      }]
    };

    // ===================================================
    // EVOLUCIÓN DE TÓPICOS
    // ===================================================

    if (Array.isArray(res?.topics_timeline)) {
      this.topicTimelineDailyRows = res.topics_timeline;
      const totals = new Map<number, number>();
      const top = Array.isArray(res?.top_topics) ? res.top_topics : [];
      for (const item of top) {
        const id = Number(item.topic_id);
        if (!Number.isFinite(id)) continue;
        totals.set(id, Number(item.total ?? 0));
        this.topicTimelineNames.set(id, String(item.topic_name || `Tópico ${id}`));
      }
      for (const row of this.topicTimelineDailyRows) {
        const id = Number(row.topic_id);
        if (!Number.isFinite(id)) continue;
        if (!totals.has(id)) totals.set(id, 0);
        if (!this.topicTimelineNames.has(id)) {
          this.topicTimelineNames.set(id, String(row.topic_name || `Tópico ${id}`));
        }
      }
      this.topicTimelineTopIds = [...totals.keys()]
        .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
        .slice(0, 5);
      if (this.topicTimelineInterval === '1d') {
        this.actualizarGraficaEvolucionTopicos(this.topicTimelineDailyRows);
      } else {
        this.cargarSoloTimelineTopicos();
      }
    }

    // ===================================================
    // COMPARACIÓN DE PUBLICACIONES
    // ===================================================

    this.postsChange =
      res?.comparison?.posts?.change ?? null;

    this.previousPosts = Number(
      res?.comparison?.posts?.previous ?? 0
    );

    this.previousPeriodStart = String(
      res?.comparison?.period?.previous_start ?? ''
    );

    this.previousPeriodEnd = String(
      res?.comparison?.period?.previous_end ?? ''
    );



    // ===================================================
    // TÓPICOS POR USUARIO
    // ===================================================

    const topicsByUser = Array.isArray(
      res?.topics_by_user
    )
      ? res.topics_by_user
      : [];

    const topicsMap = new Map<
      number,
      {
        topic_id: number;
        topic_name: string;
      }
    >();

    topicsByUser.forEach((item: any) => {

      const topicId = Number(item.topic_id);

      if (!topicsMap.has(topicId)) {
        topicsMap.set(topicId, {
          topic_id: topicId,
          topic_name: String(
            item.topic_name || 'Sin nombre'
          )
        });
      }
    });

    const topics = Array.from(
      topicsMap.values()
    );

    const usersMap = new Map<
      number,
      {
        user_id: number;
        usuario: string;
      }
    >();

    topicsByUser.forEach((item: any) => {

      const userId = Number(item.user_id);

      if (!usersMap.has(userId)) {
        usersMap.set(userId, {
          user_id: userId,
          usuario: String(
            item.usuario || 'Sin nombre'
          )
        });
      }
    });

    const topicUsers = Array.from(
      usersMap.values()
    );

    const userColors = [
      '#6d28d9',
      '#2563eb',
      '#059669',
      '#ea580c',
      '#dc2626',
      '#0891b2',
      '#9333ea',
      '#475569'
    ];

    this.topicsByUserData = {
      labels: topics.map(topic =>
        this.truncateTopic(
          topic.topic_name,
          45
        )
      ),
      datasets: topicUsers.map(
        (user, index) => {

          const data = topics.map(topic => {

            const item = topicsByUser.find(
              (row: any) =>
                Number(row.topic_id) === topic.topic_id &&
                Number(row.user_id) === user.user_id
            );

            return item
              ? Number(item.total ?? 0)
              : 0;
          });

          return {
            label: user.usuario,
            data,
            backgroundColor:
              userColors[index % userColors.length],
            borderRadius: 5,
            borderSkipped: false,
            barThickness: 9,
            maxBarThickness: 12
          };
        }
      )
    };

    // ===================================================
    // ENTIDADES POR TÓPICO
    // ===================================================

    this.entitiesByTopicPersona = Array.isArray(
      res?.entities_by_topic_persona
    )
      ? res.entities_by_topic_persona.map(
          (item: any) => ({
            topic_id: Number(item.topic_id),
            topic_name: String(
              item.topic_name || 'Sin nombre'
            ),
            entidad: String(
              item.entidad || 'Sin nombre'
            ),
            total: Number(
              item.total || 0
            )
          })
        )
      : [];

    this.entitiesByTopicOrganizacion = Array.isArray(
      res?.entities_by_topic_organizacion
    )
      ? res.entities_by_topic_organizacion.map(
          (item: any) => ({
            topic_id: Number(item.topic_id),
            topic_name: String(
              item.topic_name || 'Sin nombre'
            ),
            entidad: String(
              item.entidad || 'Sin nombre'
            ),
            total: Number(
              item.total || 0
            )
          })
        )
      : [];

    this.entitiesByTopicLocacion = Array.isArray(
      res?.entities_by_topic_locacion
    )
      ? res.entities_by_topic_locacion.map(
          (item: any) => ({
            topic_id: Number(item.topic_id),
            topic_name: String(
              item.topic_name || 'Sin nombre'
            ),
            entidad: String(
              item.entidad || 'Sin nombre'
            ),
            total: Number(
              item.total || 0
            )
          })
        )
      : [];

    // ===================================================
    // TIMELINE
    // ===================================================

    const tl = Array.isArray(res?.time_line)
      ? res.time_line
      : Array.isArray(res?.timeline)
        ? res.timeline
        : [];

    const dailyRows: TimelineRow[] = tl.map(
      (x: any) => ({
        fecha: String(x.fecha ?? ''),
        total: Number(x.total ?? 0)
      })
    );

    const detail = res?.time_line_detail;

    const hasHourlyData =
      this.timelineInterval !== '1d' &&
      Array.isArray(detail);

    const graphicRows: TimelineRow[] =
      hasHourlyData
        ? detail.map((x: any) => ({
            fecha: String(x.fecha ?? ''),
            total: Number(x.total ?? 0)
          }))
        : dailyRows;

    this.timelineData = {
      labels: graphicRows.map(
        x => this.formatActivityTimelineLabel(
          x.fecha,
          hasHourlyData
        )
      ),
      datasets: [{
        label: hasHourlyData
          ? 'Publicaciones por intervalo'
          : 'Publicaciones por día',
        data: graphicRows.map(
          x => x.total
        ),
        tension: 0.35,
        fill: false,
        pointRadius:
          graphicRows.length > 80 ? 0 : 2,
        borderColor:
          NETVORA_PALETTE.timeline.line,
        backgroundColor:
          NETVORA_PALETTE.timeline.fill,
        pointBackgroundColor:
          NETVORA_PALETTE.timeline.point,
        pointHoverRadius: 4,
        borderWidth: 2
      }]
    };

    // ===================================================
    // SENTIMIENTOS
    // ===================================================

    const sent =
      res?.sentiment?.posts_per_sentiment ??
      res?.posts_per_sentiment ??
      {};

    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{
        label: 'Sentimientos',
        data: [
          Number(sent.negativo || 0),
          Number(sent.neutro || 0),
          Number(sent.positivo || 0)
        ],
        backgroundColor: [
          NETVORA_PALETTE.sentiment.negativo,
          NETVORA_PALETTE.sentiment.neutro,
          NETVORA_PALETTE.sentiment.positivo
        ]
      }]
    };

    // ===================================================
    // GRÁFICO DE COMENTARIOS
    // ===================================================

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

    // ===================================================
    // TOP USUARIOS
    // ===================================================

    this.topUsers = Array.isArray(
      res?.top_users
    )
      ? res.top_users.map((u: any) => ({
          usuario:
            u.usuario ??
            u.TweetUser ??
            u.user ??
            '',
          total: Number(u.total || 0)
        }))
      : [];

    // ===================================================
    // SENTIMIENTO VS USUARIO
    // ===================================================

    const svu =
      res?.SentVsUser ??
      res?.sent_vs_user ??
      {};

    const keys =
      svu && typeof svu === 'object'
        ? Object.keys(svu)
        : [];

    this.sentVsUserData = {
      labels: keys,
      datasets: [
        {
          label: 'Negativo',
          data: keys.map(
            k => Number(svu[k]?.negativo || 0)
          ),
          backgroundColor:
            NETVORA_PALETTE.sentiment.negativo,
          borderWidth: 0,
          borderRadius: 6
        },
        {
          label: 'Neutro',
          data: keys.map(
            k => Number(svu[k]?.neutro || 0)
          ),
          backgroundColor:
            NETVORA_PALETTE.sentiment.neutro,
          borderWidth: 0,
          borderRadius: 6
        },
        {
          label: 'Positivo',
          data: keys.map(
            k => Number(svu[k]?.positivo || 0)
          ),
          backgroundColor:
            NETVORA_PALETTE.sentiment.positivo,
          borderWidth: 0,
          borderRadius: 6
        }
      ]
    };

    // ===================================================
    // ÍNDICE DE SENTIMIENTO
    // ===================================================

    const rawIdx = Array.isArray(
      res?.indice_sentimiento
    )
      ? res.indice_sentimiento
      : Array.isArray(res?.indice)
        ? res.indice
        : [];

    this.indiceSent = rawIdx.map(
      (x: any) => ({
        user: String(x.user ?? ''),
        positivos: Number(x.positivos ?? 0),
        negativos: Number(x.negativos ?? 0),
        total: Number(x.total ?? 0),
        indice: Number(
          x.indice_sentimiento ?? 0
        )
      })
    );

    const MIN_TOTAL = 3;

    const filtered = this.indiceSent.filter(
      x => x.total >= MIN_TOTAL
    );

    const sorted = [...filtered].sort(
      (a, b) => b.indice - a.indice
    );

    const TOP = 12;
    const top = sorted.slice(0, TOP);

    this.userIndiceChartData = {
      labels: top.map(x => x.user),
      datasets: [{
        label: 'Índice (%)',
        data: top.map(
          x => +(
            this.normalizeIndiceSigned(x.indice) * 100
          ).toFixed(1)
        ),
        backgroundColor:
          NETVORA_PALETTE.indice.positivo,
        borderRadius: 8,
        borderWidth: 0
      }]
    };

    this.userIndice = filtered
      .map((x: any) => ({
        TweetUser: String(x.user ?? ''),
        pos: Number(x.positivos ?? 0),
        neg: Number(x.negativos ?? 0),
        total: Number(x.total ?? 0),
        indice: this.normalizeIndiceSigned(
          Number(
            x.indice ??
            x.indice_sentimiento ??
            0
          )
        )
      }))
      .sort(
        (a, b) => b.total - a.total
      );

    // ===================================================
    // ACTUALIZAR GRÁFICAS ONPUSH
    // ===================================================

    queueMicrotask(() => {
      this.timelineChart?.update();
    });

    this.cdr.markForCheck();
  }

  // =====================================================
  // NUBE DE PALABRAS
  // =====================================================

  loadWordcloud(): void {

    const version = ++this.wordcloudVersion;

    this.wordcloudSubscription?.unsubscribe();

    const selected = this.getUsersToSend();

    if (
      !this.startDate ||
      !selected.length
    ) {

      if (this.wordcloudUrl) {
        URL.revokeObjectURL(this.wordcloudUrl);
      }

      this.wordcloudUrl = null;
      this.loadingWordcloud = false;

      this.cdr.markForCheck();

      return;
    }

    const body: any = {
      start: this.toYMD(this.startDate),
      end: this.toYMD(
        this.endDate ?? this.startDate
      ),
      tipo_cuenta: this.type_user,
      topic_ids: [...(this.selectedTopics ?? [])],
      search: (this.searchText ?? '').trim(),
      users: selected
    };

    this.loadingWordcloud = true;

    this.cdr.markForCheck();

    this.wordcloudSubscription = this.apiService
      .getWordcloud(body)
      .pipe(

        finalize(() => {

          if (
            version !== this.wordcloudVersion
          ) {
            return;
          }

          this.loadingWordcloud = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: resp => {

          if (
            version !== this.wordcloudVersion
          ) {
            return;
          }

          const blob = resp.body as Blob;

          if (this.wordcloudUrl) {
            URL.revokeObjectURL(this.wordcloudUrl);
            this.wordcloudUrl = null;
          }

          if (
            blob &&
            blob.size > 0 &&
            !blob.type?.includes('application/json')
          ) {
            this.wordcloudUrl =
              URL.createObjectURL(blob);
          }

          this.cdr.markForCheck();
        },

        error: err => {

          if (
            version !== this.wordcloudVersion
          ) {
            return;
          }

          console.error(
            '[Personas/Entidades] Wordcloud',
            err
          );

          if (this.wordcloudUrl) {
            URL.revokeObjectURL(this.wordcloudUrl);
          }

          this.wordcloudUrl = null;
          this.cdr.markForCheck();
        }
      });
  }

  // =====================================================
  // DESCARGAR GRÁFICO
  // =====================================================

  downloadChart(event: Event): void {

    const chartContainer = (
      event.target as HTMLElement
    ).closest(
      '.panel, .chart, .analysis-card, .activity-chart, .explore-main-card, .explore-secondary-card'
    );

    const canvas = chartContainer?.querySelector(
      'canvas'
    ) as HTMLCanvasElement | null;

    if (!canvas) return;

    const link = document.createElement('a');

    link.href = exportCanvasWithWhiteBg(canvas);

    link.download =
      `grafico-${Date.now()}.png`;

    link.click();
  }

  // =====================================================
  // DESCARGAR TODOS LOS GRÁFICOS
  // =====================================================

  public downloadAllCharts(): void {

    const canvases = document.querySelectorAll(
      'canvas'
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

  // =====================================================
  // TRACK BY
  // =====================================================

  trackByEntidad = (
    _: number,
    item: { entidad: string }
  ) => item.entidad;

  trackByUser = (
    _: number,
    item: { usuario: string }
  ) => item.usuario;

  trackByIndiceUser = (
    _: number,
    item: UserIndiceItem
  ) => item.TweetUser;

  // =====================================================
  // HELPERS
  // =====================================================

  private toYMD(d: Date): string {

    const y = d.getFullYear();

    const m = String(
      d.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      d.getDate()
    ).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }

  private formatTimelineLabel(
    fecha: string
  ): string {

    if (!fecha) return '';

    const datePart = String(
      fecha
    ).split(/[T ]/)[0];

    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

    if (match) {
      return `${match[3]}/${match[2]}`;
    }

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
      return fecha;
    }

    return `${String(
      date.getUTCDate()
    ).padStart(2, '0')}/${String(
      date.getUTCMonth() + 1
    ).padStart(2, '0')}`;
  }

  private formatActivityTimelineLabel(
    fecha: string,
    hourly: boolean
  ): string {

    const date =
      this.formatTimelineLabel(fecha);

    if (!hourly) return date;

    const hour =
      /[T ](\d{2}):(\d{2})/.exec(fecha);

    return hour
      ? `${date} ${hour[1]}:${hour[2]}`
      : date;
  }

  private normalizeArray(
    value: any
  ): EntItem[] {

    if (Array.isArray(value)) {

      return value.map((x: any) => ({
        entidad: String(
          x.entidad ??
          x.name ??
          x.key ??
          ''
        ),
        total: this.toNum(x.total)
      }));
    }

    if (
      value &&
      typeof value === 'object'
    ) {

      return Object.entries(value).map(
        ([entidad, total]) => ({
          entidad: String(entidad),
          total: this.toNum(total)
        })
      );
    }

    return [];
  }

  private toNum(v: any): number {

    if (typeof v === 'number') {
      return v;
    }

    if (typeof v === 'string') {
      return Number(v) || 0;
    }

    if (
      v &&
      typeof v === 'object'
    ) {

      const maybe =
        v.total ??
        v.count ??
        v.value ??
        v.n ??
        v.cantidad ??
        v.sum ??
        0;

      return Number(maybe) || 0;
    }

    return 0;
  }

  private normalizeIndiceSigned(
    v: number
  ): number {

    if (!Number.isFinite(v)) {
      return 0;
    }

    if (Math.abs(v) > 1) {
      v = v / 100;
    }

    return Math.max(
      -1,
      Math.min(1, v)
    );
  }

  formatIndice(v: number): string {

    const n =
      this.normalizeIndiceSigned(v) * 100;

    return `${n.toFixed(0)}%`;
  }

  calcUserBar(total: number): number {

    if (!this.topUsers?.length) {
      return 0;
    }

    const max = Math.max(
      ...this.topUsers.map(
        x => x.total || 0
      ),
      1
    );

    return Math.round(
      (total / max) * 100
    );
  }

  private truncateTopic(
    text: string,
    maxLength: number
  ): string {

    if (!text) {
      return 'Sin nombre';
    }

    return text.length > maxLength
      ? `${text.substring(0, maxLength)}…`
      : text;
  }

  calcIndiceBar(v: number): number {

    return Math.round(
      Math.abs(
        this.normalizeIndiceSigned(v) * 100
      )
    );
  }

  // =====================================================
  // ENTIDADES AGRUPADAS POR TÓPICO
  // =====================================================

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

    this.selectedEntitiesByTopic.forEach(item => {

      if (!grouped.has(item.topic_id)) {

        grouped.set(item.topic_id, {
          topic_id: item.topic_id,
          topic_name: item.topic_name,
          total: 0,
          entities: []
        });
      }

      const topic = grouped.get(
        item.topic_id
      )!;

      topic.entities.push(item);
      topic.total += item.total;
    });

    return Array.from(
      grouped.values()
    )
      .map(topic => ({
        ...topic,
        entities: topic.entities.sort(
          (a, b) => b.total - a.total
        )
      }))
      .sort(
        (a, b) => b.total - a.total
      );
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
}