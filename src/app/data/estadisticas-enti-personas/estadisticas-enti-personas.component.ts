import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';

import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { BaseChartDirective } from 'ng2-charts';

import { NETVORA_PALETTE, exportCanvasWithWhiteBg } from '../../utils/helpers';
import { users } from '../../interfaces/users';
import { AccountService } from '../../services/account.service';

type EntItem = { entidad: string; total: number };
type TopUserItem = { usuario: string; total: number };

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
export class EstadisticasEntiPersonasComponent implements OnInit, OnChanges {
  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;

  // usuarios seleccionados manualmente (ids)
  @Input() selectedUsers: string[] = [];

  // si quieres usarlo alguna vez, por defecto none (NO se manda al backend)
  @Input() categoria: string = 'none';

  // lista de users del combo (vienen del padre)
  @Input() users: users[] = [];

  // Define el contexto del dashboard: 'Persona' o 'Entidad'
  @Input() type_user: string = 'Persona';

  @Input() searchText: string = '';

  // opcional
  @Input() entidad: string = 'none';

  @ViewChild(BaseChartDirective) timelineChart?: BaseChartDirective;

  loading = false;
  errorMsg = '';

  // ===== KPI =====
  totalPosts = 0;
  // ===== Comparación con período anterior =====
postsChange: number | null = null;

previousPosts = 0;

previousPeriodStart = '';
previousPeriodEnd = '';
// =========================================================
// PUBLICACIONES POR CUENTA + SHARE OF VOICE
// =========================================================

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

  // ===== Chart selectors =====
  sentimentChartType: ChartType = 'doughnut';
  readonly sentimentTypeOptions: ChartType[] = ['doughnut', 'pie', 'bar'];
    viewModeReplies: 'table' | 'chart' = 'table';


  // ===== Timeline =====
  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Posts por día',
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
  // =========================================================
// TÓPICOS PRINCIPALES
// =========================================================

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
};
postsByAccountChartData: ChartData<'bar'> = {
  labels: [],
  datasets: [
    {
      label: 'Publicaciones',
      data: []
    }
  ]
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
        label: (context) => {

          const value = Number(
            context.raw ?? 0
          );

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
// =========================================================
// EVOLUCIÓN DE TÓPICOS
// =========================================================

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
};
// =========================================================
// TÓPICOS POR USUARIO
// =========================================================

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
};



  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: { x: { ticks: { maxRotation: 0 } }, y: { beginAtZero: true } }
  };
  readonly repliesChartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  animation: false,
  hover: {
    mode: 'nearest'
  },
  plugins: {
    legend: { display: true },
    tooltip: { enabled: true },
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



  // ===== Sentimientos =====
  sentimentData: ChartData = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{ label: 'Sentimientos', data: [0, 0, 0] }]
  };

  readonly commonOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } }
  };

  // ===== SentVsUser (stacked bar) =====
  sentVsUserData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { label: 'Negativo', data: [], backgroundColor: NETVORA_PALETTE.sentVsUser.negativo, borderWidth: 0, borderRadius: 6 },
      { label: 'Neutro',   data: [], backgroundColor: NETVORA_PALETTE.sentVsUser.neutro,   borderWidth: 0, borderRadius: 6 },
      { label: 'Positivo', data: [], backgroundColor: NETVORA_PALETTE.sentVsUser.positivo, borderWidth: 0, borderRadius: 6 },
    ]
  };

  sentVsUserOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: {
      x: { stacked: true, ticks: { maxRotation: 0 } },
      y: { stacked: true, beginAtZero: true, }
    }
  };

  // ===== Índice =====
  userIndice: UserIndiceItem[] = [];

  userIndiceChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ label: 'Índice', data: [] }]
  };

  userIndiceChartOptions: ChartOptions<'bar'> = {
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
      x: { min: -100, max: 100, ticks: { callback: (v) => `${v}%` } },
      y: { ticks: { autoSkip: false } }
    }
  };

  // ===== Wordcloud =====
  wordcloudUrl: string | null = null;
  loadingWordcloud = false;

  indiceSent: IndiceSentItem[] = [];

  // =========================================================
  // ACCESO A COMENTARIOS — PRO / ADMIN
  // =========================================================

  accessLoading = true;
  currentRole = 'viewer';
  subscriptionPlan = '';
  subscriptionStatus = '';

  get canViewReplies(): boolean {
    if (this.currentRole === 'admin') {
      return true;
    }

    return (
      this.subscriptionStatus === 'activo' &&
      this.subscriptionPlan === 'pro'
    );
  }

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private accountService: AccountService
  ) {}

  ngOnInit(): void {
    this.loadAccess();

    // NO fuerces aquí; el padre a veces aún no mandó users.
    // Deja que ngOnChanges dispare cuando estén listos.
  }

  private loadAccess(): void {
    this.accessLoading = true;

    this.accountService.me().subscribe({
      next: (res: any) => {
        const role = String(
          res?.user?.role || 'viewer'
        )
          .trim()
          .toLowerCase();

        // No usamos UserRole aquí para evitar incompatibilidades
        // con roles backend como "usuario".
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
    if (!this.startDate) return;

    const startChanged = !!changes['startDate'];
    const endChanged = !!changes['endDate'];
    const usersChanged = !!changes['users'];
    const selChanged = !!changes['selectedUsers'];
    const searchChanged = !!changes['searchText'];
    const typeChanged = !!changes['type_user'];
    const catChanged = !!changes['categoria'];

    // si no hay selección manual y aún no llegaron users del combo, esperamos
    if (!this.selectedUsers?.length && (!this.users || this.users.length === 0)) return;

    if (startChanged || endChanged || usersChanged || selChanged || searchChanged || typeChanged || catChanged) {
      this.cargarDatos();
      this.loadWordcloud();
    }
  }

  // ✅ FIX: fallback real (no uses "this.selectedUsers || ..." porque [] es truthy)
  private getUsersToSend(): string[] {
    if (this.selectedUsers?.length) return this.selectedUsers;
    return (this.users?.map(u => u.idTweetUser) ?? []);
  }

  public cargarDatos(): void {
    if (!this.startDate) return;

    const body: any = {
      start: this.toYMD(this.startDate),
      users: this.getUsersToSend(),
      type_user: this.type_user
    };

    if (this.endDate) body.end = this.toYMD(this.endDate);

    const s = (this.searchText || '').trim();
    if (s) body.search = s;

    // NO enviar categoria si es none/empty
    const cat = (this.categoria || '').trim().toLowerCase();
    if (cat && cat !== 'none') body.categoria = this.categoria;

    // NO enviar entidad si es none/empty
    const ent = (this.entidad || '').trim().toLowerCase();
    if (ent && ent !== 'none') body.entidad = this.entidad;

    this.loading = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    this.apiService.getCategoriesData(body)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (res) => this.mapResponse(res),
        error: (err) => {
          
          this.errorMsg = 'No se pudo cargar el dashboard.';
          this.cdr.markForCheck();
        },
      });
  }

  private mapResponse(res: any): void {
  this.totalPosts = res?.total_posts?.total_posts ?? res?.total_posts ?? 0;

  this.totalReplies = res?.total_replies?.total ?? 0;
  this.totalRepliesNegativo = res?.total_replies?.negativo ?? 0;
  this.totalRepliesNeutro = res?.total_replies?.neutro ?? 0;
  this.totalRepliesPositivo = res?.total_replies?.positivo ?? 0;

  this.topLocacion = this.normalizeArray(res?.locacion).slice(0, 10);
  this.topOrganizacion = this.normalizeArray(res?.organizacion).slice(0, 10);
  this.topPersona = this.normalizeArray(res?.persona).slice(0, 10);

  
  // =========================================================
// PUBLICACIONES POR CUENTA + SHARE OF VOICE
// =========================================================

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


this.accountTotalPosts = Number(
  res?.account_total_posts ?? 0
);


// =========================================================
// CUENTA LÍDER
// =========================================================

const accountLeader =
  this.postsByAccount[0];

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


// =========================================================
// CONCENTRACIÓN TOP 3
// =========================================================

const accountTop3Total =
  this.postsByAccount
    .slice(0, 3)
    .reduce(
      (sum, item) =>
        sum + item.total,
      0
    );

this.accountTop3Share =
  this.accountTotalPosts > 0
    ? (
        accountTop3Total /
        this.accountTotalPosts
      ) * 100
    : 0;


// =========================================================
// CONCENTRACIÓN TOP 5
// =========================================================

const accountTop5Total =
  this.postsByAccount
    .slice(0, 5)
    .reduce(
      (sum, item) =>
        sum + item.total,
      0
    );

this.accountTop5Share =
  this.accountTotalPosts > 0
    ? (
        accountTop5Total /
        this.accountTotalPosts
      ) * 100
    : 0;


// =========================================================
// GRÁFICO — PUBLICACIONES POR CUENTA
// =========================================================

this.postsByAccountChartData = {

  labels: this.postsByAccount.map(
    item => item.usuario
  ),

  datasets: [
    {
      label: 'Publicaciones',

      data: this.postsByAccount.map(
        item => item.total
      )
    }
  ]
};
  // =========================================================
// TÓPICOS PRINCIPALES
// =========================================================

const topTopics = Array.isArray(res?.top_topics)
  ? res.top_topics
  : [];

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
// EVOLUCIÓN DE TÓPICOS
// =========================================================

const topicTimeline = Array.isArray(res?.topics_timeline)
  ? res.topics_timeline
  : [];

// Fechas únicas
const fechas: string[] = Array.from(
  new Set<string>(
    topicTimeline.map(
      (item: any): string => String(item.fecha)
    )
  )
);
// =====================================================
// COMPARACIÓN DE PUBLICACIONES
// =====================================================

this.postsChange =
  res?.comparison?.posts?.change ?? null;

this.previousPosts =
  Number(
    res?.comparison?.posts?.previous ?? 0
  );

this.previousPeriodStart =
  String(
    res?.comparison?.period?.previous_start ?? ''
  );

this.previousPeriodEnd =
  String(
    res?.comparison?.period?.previous_end ?? ''
  );

// Orden cronológico
fechas.sort((a: string, b: string) => {
  return new Date(a).getTime() - new Date(b).getTime();
});

// Tópicos únicos
const topicMap = new Map<
  number,
  {
    topic_id: number;
    topic_name: string;
  }
>();

topicTimeline.forEach((item: any) => {

  const topicId = Number(item.topic_id);

  if (!topicMap.has(topicId)) {
    topicMap.set(topicId, {
      topic_id: topicId,
      topic_name: String(
        item.topic_name || 'Sin nombre'
      )
    });
  }

});

const timelineTopics = Array.from(
  topicMap.values()
);

// Colores de las líneas
const topicColors = [
  '#6d28d9',
  '#2563eb',
  '#059669',
  '#ea580c',
  '#dc2626'
];

// Construir gráfico
this.topicsTimelineData = {

  labels: fechas.map((fecha: string) =>
    this.formatTimelineLabel(fecha)
  ),

  datasets: timelineTopics.map(
    (topic, index) => {

      const data = fechas.map(
        (fecha: string) => {

          const item = topicTimeline.find(
            (row: any) =>
              Number(row.topic_id) === topic.topic_id &&
              String(row.fecha) === fecha
          );

          return item
            ? Number(item.total ?? 0)
            : 0;
        }
      );

      const color =
        topicColors[index % topicColors.length];

      return {
        label: this.truncateTopic(
          topic.topic_name,
          38
        ),

        data,

        borderColor: color,
        backgroundColor: color,

        tension: 0.35,
        fill: false,

        pointRadius: 3,
        pointHoverRadius: 5,

        borderWidth: 2
      };
    }
  )
};
// =========================================================
// TÓPICOS POR USUARIO
// =========================================================

const topicsByUser = Array.isArray(res?.topics_by_user)
  ? res.topics_by_user
  : [];

// ---------------------------------------------------------
// Tópicos únicos
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Usuarios únicos
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Colores
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Construir gráfico
// ---------------------------------------------------------

this.topicsByUserData = {
  labels: topics.map((topic) =>
    this.truncateTopic(
      topic.topic_name,
      45
    )
  ),

  datasets: topicUsers.map(
    (user, index) => {

      const data = topics.map((topic) => {
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
// =========================================================
// ENTIDADES POR TÓPICO
// =========================================================

this.entitiesByTopicPersona = Array.isArray(
  res?.entities_by_topic_persona
)
  ? res.entities_by_topic_persona.map((item: any) => ({
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
    }))
  : [];

this.entitiesByTopicOrganizacion = Array.isArray(
  res?.entities_by_topic_organizacion
)
  ? res.entities_by_topic_organizacion.map((item: any) => ({
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
    }))
  : [];

this.entitiesByTopicLocacion = Array.isArray(
  res?.entities_by_topic_locacion
)
  ? res.entities_by_topic_locacion.map((item: any) => ({
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
    }))
  : [];
  
  // Timeline
  const tl = Array.isArray(res?.time_line)
    ? res.time_line
    : Array.isArray(res?.timeline)
    ? res.timeline
    : [];

  this.timelineData = {
    labels: tl.map((x: any) => this.formatTimelineLabel(x.fecha)),
    datasets: [{
      label: 'Posts por día',
      data: tl.map((x: any) => Number(x.total || 0)),
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

  // Sentimientos
  const sent = res?.sentiment?.posts_per_sentiment ?? res?.posts_per_sentiment ?? {};
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
      ],
    }]
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

  this.topUsers = Array.isArray(res?.top_users)
    ? res.top_users.map((u: any) => ({
        usuario: u.usuario ?? u.TweetUser ?? u.user ?? '',
        total: Number(u.total || 0)
      }))
    : [];

  const svu = res?.SentVsUser ?? res?.sent_vs_user ?? {};
  const keys = svu && typeof svu === 'object' ? Object.keys(svu) : [];

  this.sentVsUserData = {
    labels: keys,
    datasets: [
      { label: 'Negativo', data: keys.map(k => Number(svu[k]?.negativo || 0)), backgroundColor: NETVORA_PALETTE.sentiment.negativo, borderWidth: 0, borderRadius: 6 },
      { label: 'Neutro',   data: keys.map(k => Number(svu[k]?.neutro || 0)), backgroundColor: NETVORA_PALETTE.sentiment.neutro, borderWidth: 0, borderRadius: 6 },
      { label: 'Positivo', data: keys.map(k => Number(svu[k]?.positivo || 0)), backgroundColor: NETVORA_PALETTE.sentiment.positivo, borderWidth: 0, borderRadius: 6 }
    ]
  };

  const rawIdx = Array.isArray(res?.indice_sentimiento)
    ? res.indice_sentimiento
    : Array.isArray(res?.indice)
    ? res.indice
    : [];

  this.indiceSent = rawIdx.map((x: any) => ({
    user: String(x.user ?? ''),
    positivos: Number(x.positivos ?? 0),
    negativos: Number(x.negativos ?? 0),
    total: Number(x.total ?? 0),
    indice: Number(x.indice_sentimiento ?? 0)
  }));

  const MIN_TOTAL = 3;
  const filtered = this.indiceSent.filter(x => x.total >= MIN_TOTAL);
  const sorted = [...filtered].sort((a, b) => b.indice - a.indice);
  const TOP = 12;
  const top = sorted.slice(0, TOP);

  this.userIndiceChartData = {
    labels: top.map(x => x.user),
    datasets: [{
      label: 'Índice (%)',
      data: top.map(x => +(this.normalizeIndiceSigned(x.indice) * 100).toFixed(1)),
      backgroundColor: NETVORA_PALETTE.indice.positivo,
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
      indice: this.normalizeIndiceSigned(Number(x.indice ?? x.indice_sentimiento ?? 0))
    }))
    .sort((a, b) => b.total - a.total);

  queueMicrotask(() => this.timelineChart?.update());
  this.cdr.markForCheck();
}

  // WordCloud
  loadWordcloud() {
  if (!this.startDate) return;

  const usersToSend = this.getUsersToSend();
  if (!usersToSend.length) {
    if (this.wordcloudUrl) {
      URL.revokeObjectURL(this.wordcloudUrl);
      this.wordcloudUrl = null;
    }
    return;
  }

  this.loadingWordcloud = true;
  this.cdr.markForCheck();

  const body = {
    start: this.toYMD(this.startDate),
    end: this.endDate ? this.toYMD(this.endDate) : undefined,
    tipo_cuenta: this.type_user,
    users: usersToSend
  };

  this.apiService.getWordcloud(body).subscribe({
    next: (resp) => {
      const blob = resp.body as Blob;

      if (blob?.type?.includes('application/json')) {
        blob.text().then(t => console.error('', t));
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
    error: (err) => {
      
      this.wordcloudUrl = null;
      this.loadingWordcloud = false;
      this.cdr.markForCheck();
    }
  });
}

  // Downloads
  downloadChart(event: Event) {
    const chartContainer = (event.target as HTMLElement).closest('.panel');
    const canvas = chartContainer?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = exportCanvasWithWhiteBg(canvas);
    link.download = `grafico-${Date.now()}.png`;
    link.click();
  }

  public downloadAllCharts() {
    const canvases = document.querySelectorAll('canvas') as NodeListOf<HTMLCanvasElement>;
    if (!canvases.length) return;

    canvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.href = exportCanvasWithWhiteBg(canvas);
      link.download = `grafico-${index + 1}-${Date.now()}.png`;
      link.click();
    });
  }

  // TrackBy
  trackByEntidad = (_: number, item: { entidad: string }) => item.entidad;
  trackByUser = (_: number, item: { usuario: string }) => item.usuario;
  trackByIndiceUser = (_: number, item: UserIndiceItem) => item.TweetUser;

  // Helpers
  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatTimelineLabel(fecha: string): string {
  const dt = new Date(fecha);
  if (Number.isNaN(dt.getTime())) return fecha;
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

  private normalizeArray(value: any): EntItem[] {
    if (Array.isArray(value)) {
      return value.map((x: any) => ({
        entidad: String(x.entidad ?? x.name ?? x.key ?? ''),
        total: this.toNum(x.total)
      }));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).map(([entidad, total]) => ({
        entidad: String(entidad),
        total: this.toNum(total)
      }));
    }

    return [];
  }

  private toNum(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;

    if (v && typeof v === 'object') {
      const maybe = v.total ?? v.count ?? v.value ?? v.n ?? v.cantidad ?? v.sum ?? 0;
      return Number(maybe) || 0;
    }
    return 0;
  }

  private normalizeIndiceSigned(v: number): number {
    if (!Number.isFinite(v)) return 0;
    if (Math.abs(v) > 1) v = v / 100;
    return Math.max(-1, Math.min(1, v));
  }

  // para tu HTML
  formatIndice(v: number): string {
    const n = this.normalizeIndiceSigned(v) * 100;
    return `${n.toFixed(0)}%`;
  }

  calcUserBar(total: number): number {
    if (!this.topUsers?.length) return 0;
    const max = Math.max(...this.topUsers.map(x => x.total || 0), 1);
    return Math.round((total / max) * 100);
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
    return Math.round(Math.abs(this.normalizeIndiceSigned(v) * 100));
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

      // Ordenar entidades de mayor a menor
      entities: topic.entities.sort(
        (a, b) => b.total - a.total
      )
    }))
    // Ordenar tópicos de mayor a menor
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