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

  // ✅ este define el dashboard: 'Persona' o 'Entidad'
  @Input() type_user: string = 'Persona';

  @Input() searchText: string = '';

  // opcional
  @Input() entidad: string = 'none';

  @ViewChild(BaseChartDirective) timelineChart?: BaseChartDirective;

  loading = false;
  errorMsg = '';

  // ===== KPI =====
  totalPosts = 0;
  topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];

  // ===== Top users list =====
  topUsers: TopUserItem[] = [];

  // ===== Chart selectors =====
  sentimentChartType: ChartType = 'doughnut';
  readonly sentimentTypeOptions: ChartType[] = ['doughnut', 'pie', 'bar'];

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

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    scales: { x: { ticks: { maxRotation: 0 } }, y: { beginAtZero: true } }
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

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // NO fuerces aquí; el padre a veces aún no mandó users.
    // Deja que ngOnChanges dispare cuando estén listos.
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

  this.topLocacion = this.normalizeArray(res?.locacion).slice(0, 3);
  this.topOrganizacion = this.normalizeArray(res?.organizacion).slice(0, 3);
  this.topPersona = this.normalizeArray(res?.persona).slice(0, 3);
  
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
        blob.text().then(t => console.error('🧨 Backend devolvió JSON:', t));
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

  calcIndiceBar(v: number): number {
    return Math.round(Math.abs(this.normalizeIndiceSigned(v) * 100));
  }
}