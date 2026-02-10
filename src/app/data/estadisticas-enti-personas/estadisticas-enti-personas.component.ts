import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,ViewChild
} from '@angular/core';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { BaseChartDirective } from 'ng2-charts';
import { NETVORA_PALETTE,exportCanvasWithWhiteBg } from '../../utils/helpers';

type EntItem = { entidad: string; total: number };
type TopUserItem = { usuario: string; total: number };

type UserIndiceItem = {
  TweetUser: string;
  pos: number;
  neg: number;
  total: number;
  indice: number; // puede venir ya calculado desde backend
};

type IndiceSentItem = {
  user: string;
  positivos: number;
  negativos: number;
  total: number;
  indice: number; // 0..1
};


@Component({
  selector: 'app-estadisticas-enti-personas',
  templateUrl: './estadisticas-enti-personas.component.html',
  styleUrl: './estadisticas-enti-personas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstadisticasEntiPersonasComponent implements OnInit {
  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;
  @Input() selectedUsers: number[] = [];

  // En tu HTML se muestra "Estadísticas — {{ categoria || 'Categoría' }}"
  // pero tú quieres "categoría none". Deja default 'none' y no lo mandamos al backend.
  @Input() categoria: string = 'none';

  // ✅ fijo para este dashboard
  @Input() type_user: string = 'Persona';

  // (opcional) si en algún momento quieres filtrar por entidad, aquí lo dejas
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
    datasets: [{ label: 'Posts por día', data: [], tension: 0.35, fill: false, pointRadius: 2,

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

  // ===== ✅ Índice por usuario (para tu bloque inferior) =====
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
    x: {
      min: -100,
      max: 100,
      ticks: { callback: (v) => `${v}%` }
    },
    y: { ticks: { autoSkip: false } }
  }
};

  // ===== ✅ Wordcloud =====
  wordcloudUrl: string | null = null;
  loadingWordcloud = false;

  indiceSent: IndiceSentItem[] = [];

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  // 🔥 carga automática al entrar
  if (this.startDate) {
    this.cargarDatos();
    this.loadWordcloud();
  }
}

  public cargarDatos(): void {
    if (!this.startDate) return;

    const body: any = {
      start: this.toYMD(this.startDate),
      users: this.selectedUsers || [],
      type_user: this.type_user // ✅ Persona
    };

    if (this.endDate) body.end = this.toYMD(this.endDate);

    // ✅ NO enviar categoria si es none/empty
    const cat = (this.categoria || '').trim().toLowerCase();
    if (cat && cat !== 'none') body.categoria = this.categoria;

    // ✅ NO enviar entidad si es none/empty
    const ent = (this.entidad || '').trim().toLowerCase();
    if (ent && ent !== 'none') body.entidad = this.entidad;

    this.loading = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    // ✅ usa tu endpoint real (yo dejo el que ya tenías)
    this.apiService.getCategoriesData(body)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (res) => {
          console.log('📥 Response recibida:', res);
          this.mapResponse(res);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.errorMsg = 'No se pudo cargar el dashboard.';
          this.cdr.markForCheck();
        },
      });
  }

  private mapResponse(res: any): void {
    // Total posts
    this.totalPosts = res?.total_posts?.total_posts ?? res?.total_posts ?? 0;

    // Top entidades (depende tu backend)
    this.topLocacion = this.normalizeArray(res?.locacion);
    this.topOrganizacion = this.normalizeArray(res?.organizacion);
    this.topPersona = this.normalizeArray(res?.persona);


    // Timeline
    const tl = res?.time_line ?? res?.timeline ?? [];
    this.timelineData = {
      labels: tl.map((x: any) => this.formatTimelineLabel(x.fecha)),
      datasets: [
        {
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
        }
      ]
    };

    // Sentimientos
    const s = res?.sentiment?.posts_per_sentiment ?? res?.posts_per_sentiment ?? {};
    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{
        label: 'Sentimientos',
        data: [
          Number(s.negativo || 0),
          Number(s.neutro || 0),
          Number(s.positivo || 0)
        ],
        backgroundColor: [
                NETVORA_PALETTE.sentiment.negativo,
                NETVORA_PALETTE.sentiment.neutro,
                NETVORA_PALETTE.sentiment.positivo
              ],
      }]
    };

    // Top users list
    this.topUsers = (res?.top_users ?? []).map((u: any) => ({
      usuario: u.usuario ?? u.TweetUser ?? u.user ?? '',
      total: Number(u.total || 0)
    }));

    // SentVsUser (stacked bar)
    const svu = res?.SentVsUser ?? res?.sent_vs_user ?? {};
    const users = Object.keys(svu);

    this.sentVsUserData = {
      labels: users,
      datasets: [
        { label: 'Negativo', data: users.map(u => Number(svu[u]?.negativo || 0)), backgroundColor: NETVORA_PALETTE.sentiment.negativo, borderWidth: 0,
      borderRadius: 6 },
        { label: 'Neutro', data: users.map(u => Number(svu[u]?.neutro || 0)), backgroundColor: NETVORA_PALETTE.sentiment.neutro, borderWidth: 0,
      borderRadius: 6 },
        { label: 'Positivo', data: users.map(u => Number(svu[u]?.positivo || 0)), backgroundColor: NETVORA_PALETTE.sentiment.positivo, borderWidth: 0,
      borderRadius: 6 }
      ]
    };

    // ✅ user_indice (para tu bloque inferior)
        // Extra: Índice por usuario (tabla)
  const ui = Array.isArray(res.indice_sentimiento) ? res.indice_sentimiento : (Array.isArray(res?.indice_sentimiento) ? res.UserIndice : []);
  this.userIndice = ui.map((x: any) => ({
    TweetUser: String(x.user ?? ''),
    pos: Number(x.positivos ?? 0),
    neg: Number(x.negativos ?? 0),
    total: Number(x.total ?? 0),
    // normaliza por si viene 0..100
    indice: this.normalizeIndiceSigned(Number(x.indice_sentimiento ?? 0)),
}))
// orden bonito (total desc)
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



    // Debug útil
    console.log('TL raw:', tl);
    console.log('TL labels:', this.timelineData.labels);
    console.log('TL data:', this.timelineData.datasets[0].data);

    // ✅ Fuerza repaint del chart (OnPush + ng2-charts)
    queueMicrotask(() => {
      this.timelineChart?.update();
    });

    this.cdr.markForCheck();
  }

  // ===== WordCloud =====
  loadWordcloud() {
  if (!this.startDate) return;

  this.loadingWordcloud = true;
  this.cdr.markForCheck();

  const body = {
    start: this.toYMD(this.startDate),
    end: this.endDate ? this.toYMD(this.endDate) : undefined,
    tipo_cuenta: this.type_user,
    users: this.selectedUsers ?? []
  };

  this.apiService.getWordcloud(body).subscribe({
    next: (resp) => {
      console.log('✅ wordcloud status:', resp.status);
      console.log('✅ content-type:', resp.headers.get('content-type'));

      const blob = resp.body as Blob;
      console.log('✅ isBlob:', blob instanceof Blob, 'size:', blob?.size, 'type:', blob?.type);

      // Si el backend devolvió JSON de error “disfrazado”
      if (blob?.type?.includes('application/json')) {
        blob.text().then(t => console.error('🧨 Backend devolvió JSON:', t));
        this.wordcloudUrl = null;
        this.loadingWordcloud = false;
        this.cdr.markForCheck();
        return;
      }

      // Blob vacío
      if (!blob || blob.size === 0) {
        console.error('❌ Blob vacío (no hay imagen)');
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
      console.error('❌ wordcloud error:', err);
      this.wordcloudUrl = null;
      this.loadingWordcloud = false;
      this.cdr.markForCheck();
    }
  });
}

  // ===== Downloads =====
  downloadChart(event: Event) {
    const chartContainer = (event.target as HTMLElement).closest('.chart');
    const canvas = chartContainer?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = exportCanvasWithWhiteBg(canvas);
    link.download = `grafico-${Date.now()}.png`;
    link.click();
  }

  public downloadAllCharts() {
    const canvases = document.querySelectorAll('.chart canvas') as NodeListOf<HTMLCanvasElement>;
    if (!canvases.length) return;

    canvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.href = exportCanvasWithWhiteBg(canvas);
      link.download = `grafico-${index + 1}-${Date.now()}.png`;
      link.click();
    });
  }

  // ===== TrackBy =====
  trackByEntidad = (_: number, item: { entidad: string }) => item.entidad;
  trackByUser = (_: number, item: { usuario: string }) => item.usuario;
  trackByIndiceUser = (_: number, item: UserIndiceItem) => item.TweetUser;

  // ===== UI helpers (para tu HTML) =====
  // ===== Helpers =====
  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatTimelineLabel(fecha: string): string {
    const dt = new Date(fecha);
    if (Number.isNaN(dt.getTime())) return fecha;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
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

  // ✅ si viene objeto: {total: 123} o {count: 123} o similar
  if (v && typeof v === 'object') {
    const maybe =
      v.total ?? v.count ?? v.value ?? v.n ?? v.cantidad ?? v.sum ?? 0;
    return Number(maybe) || 0;
  }

  return 0;
}


  private safeIndice(indice: any, pos: any, neg: any, total: any): number {
    // si el backend ya manda indice, úsalo
    const i = Number(indice);
    if (!Number.isNaN(i)) return i;

    // si no manda, lo calculamos básico: (pos - neg) / total
    const p = Number(pos || 0);
    const n = Number(neg || 0);
    const t = Number(total || (p + n));
    if (!t) return 0;

    return (p - n) / t;
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



}
