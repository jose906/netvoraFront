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
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { BaseChartDirective } from 'ng2-charts';
import { NETVORA_PALETTE,exportCanvasWithWhiteBg } from '../../utils/helpers';
import { users } from '../../interfaces/users';

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



@Component({
  selector: 'app-politica-estadisticas',
  templateUrl: './politica-estadisticas.component.html',
  styleUrls: ['./politica-estadisticas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoliticaEstadisticasComponent implements OnChanges, OnDestroy {
  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;
  @Input() selectedUsers: string[] = [];
  @Input() categoria!: string;
  @Input() searchText: string = '';
  @Input() users: users[] = [];

  loading = false;
  errorMsg = '';

  // ===== KPI =====
  totalPosts = 0;
  topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];

   totalReplies = 0;
    totalRepliesNegativo = 0;
totalRepliesNeutro = 0;
totalRepliesPositivo = 0;

  // ===== Top users list =====
  topUsers: TopUserItem[] = [];

  // ===== Extra: Índice por usuario =====
  userIndice: UserIndiceItem[] = [];


  // ===== Chart selectors =====
  sentimentChartType: ChartType = 'doughnut';
  readonly sentimentTypeOptions: ChartType[] = ['doughnut', 'pie', 'bar'];
   viewModeReplies: 'table' | 'chart' = 'table';

  // ===== Timeline =====
  @ViewChild(BaseChartDirective) timelineChart?: BaseChartDirective;

  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [{ label: 'Posts por día', data: [],
       borderColor: NETVORA_PALETTE.timeline.line,
          backgroundColor: NETVORA_PALETTE.timeline.fill,
          pointBackgroundColor: NETVORA_PALETTE.timeline.point,
            tension: 0.35,
            fill: false,
            pointRadius: 2,
           
            pointHoverRadius: 4,
            borderWidth: 2

     }]
  };

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: { x: { ticks: { maxRotation: 0 } }, y: { beginAtZero: true } }
  };

  // ===== Sentimientos (tipo variable) =====
  sentimentData: ChartData = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{ label: 'Sentimientos', data: [0, 0, 0] }]
  };

  readonly commonOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } }
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

  sentVsUserOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: {
      x: { stacked: true, ticks: { maxRotation: 0 } },
      y: { stacked: true, beginAtZero: true }
    }
  };
  // wordCloud
  wordcloudUrl: string | null = null;
  loadingWordcloud = false;
  // ===== Extra: Índice de sentimiento por usuario =====
indiceSent: IndiceSentItem[] = [];

// Chart (horizontal bar)
userIndiceChartData: ChartData<'bar'> = { labels: [], datasets: [{ label: 'Índice (%)', data: [] }] };

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
    x: {
      min: -100,
      max: 100,
      ticks: { callback: (v) => `${v}%` }
    },
    y: { ticks: { autoSkip: false } }
  }
};



  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
  if (!this.startDate) return;

  const startChanged = !!changes['startDate'];
  const endChanged = !!changes['endDate'];
  const usersChanged = !!changes['users'];
  const selChanged = !!changes['selectedUsers'];
  const searchChanged = !!changes['searchText'];
  const catChanged = !!changes['categoria'];

  const usersToSend = this.getUsersToSend();
  if (!usersToSend.length) return;

  if (startChanged || endChanged || usersChanged || selChanged || searchChanged || catChanged) {
    this.cargarDatos();
    this.loadWordcloud();
  }
}
ngOnDestroy(): void {
  if (this.wordcloudUrl) {
    URL.revokeObjectURL(this.wordcloudUrl);
  }
}

private getUsersToSend(): string[] {
  if (this.selectedUsers?.length) {
    return this.selectedUsers.map(String);
  }

  return (this.users ?? []).map(u => String(u.idTweetUser));
}

 

 public cargarDatos(): void {
  if (!this.startDate) return;

  const usersToSend = this.getUsersToSend();
  if (!usersToSend.length) {
    this.errorMsg = 'No hay usuarios disponibles para consultar.';
    this.totalPosts = 0;
    this.topUsers = [];
    this.userIndice = [];
    this.cdr.markForCheck();
    return;
  }

  const body: any = {
    start: this.toYMD(this.startDate),
    users: usersToSend,
    categoria: this.categoria || '',
    type_user: 'Medio'
  };

  if (this.endDate) {
    body.end = this.toYMD(this.endDate);
  }

  const search = (this.searchText || '').trim();
  if (search) {
    body.search = search;
  }
  

  this.loading = true;
  this.errorMsg = '';
  this.cdr.markForCheck();

  this.apiService.getCategoriesData(body)
    .pipe(finalize(() => {
      this.loading = false;
      this.cdr.markForCheck();
    }))
    .subscribe({
      next: (res) => {
        
        this.mapResponse(res);
      },
      error: (err) => {
       
        this.errorMsg = 'No se pudo cargar el dashboard.';
        this.cdr.markForCheck();
      },
    });
}

  private mapResponse(res: any): void {
    // Total posts
    this.totalPosts = res?.total_posts?.total_posts ?? 0;
    this.totalReplies = res.total_replies.total ?? 0
    this.totalRepliesNegativo = res.total_replies.negativo ?? 0
    this.totalRepliesNeutro = res.total_replies.neutro ?? 0
    this.totalRepliesPositivo = res.total_replies.positivo ?? 0 

   

    // Top 3 entidades
    this.topLocacion = (res?.locacion ?? []).slice(0, 3);
    this.topOrganizacion = (res?.organizacion ?? []).slice(0, 3);
    this.topPersona = (res?.persona ?? []).slice(0, 3);

    // Timeline (🔥 Fix: UTC + update chart)
    const tl = Array.isArray(res?.time_line) ? res.time_line : [];
 
    this.timelineData = {
      labels: tl.map((x: any) => this.formatTimelineLabelUTC(x.fecha)),
      datasets: [
        {
          label: 'Posts por día',
          data: tl.map((x: any) => Number(x.total ?? 0)),
          tension: 0.35,
          fill: false,
          pointRadius: 2,
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

    // Sentimientos
    const s = res?.sentiment?.posts_per_sentiment ?? {};
    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{
        label: 'Sentimientos',
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

// opcional: para tabla muestra más (ordenada por total desc o índice desc)
this.indiceSent = [...filtered].sort((a, b) => b.total - a.total);



   

    // ✅ Fuerza repaint del chart (OnPush + ng2-charts)
    queueMicrotask(() => {
      this.timelineChart?.update();
    });

    this.cdr.markForCheck();
  }

  // ===== Downloads =====
 downloadChart(event: Event) {
  const button = event.currentTarget as HTMLElement;
  const panel = button.closest('.panel');
  const canvas = panel?.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const link = document.createElement('a');
  link.href = exportCanvasWithWhiteBg(canvas);
  link.download = `grafico-${Date.now()}.png`;
  link.click();
}

public downloadAllCharts() {
  const canvases = document.querySelectorAll('.panel canvas') as NodeListOf<HTMLCanvasElement>;
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
    const dt = new Date(fecha);
    if (Number.isNaN(dt.getTime())) return fecha;

    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }
  

loadWordcloud() {
  if (!this.startDate) return;

  const usersToSend = this.getUsersToSend();
  if (!usersToSend.length) {
    this.wordcloudUrl = null;
    return;
  }

  this.loadingWordcloud = true;
  this.cdr.markForCheck();

  const body = {
    start: this.toYMD(this.startDate),
    end: this.endDate ? this.toYMD(this.endDate) : undefined,
    categoria: this.categoria,
    tipo_cuenta: 'Medio',
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
  return Math.round(this.normalizeIndiceSigned(v) * 100);
}

trackByIndiceUser = (_: number, item: UserIndiceItem) => item.TweetUser;




  
}
