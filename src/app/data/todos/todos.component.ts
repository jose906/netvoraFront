import {Component,Input,ChangeDetectionStrategy,ChangeDetectorRef} from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { StatsResponse } from '../../interfaces/data/mainDashboard';
import { NETVORA_PALETTE } from '../../utils/helpers';

type TopItem = { nombre: string; total: number };
type EntItem = { entidad: string; total: number };

@Component({
  selector: 'app-todos',
  templateUrl: './todos.component.html',
  styleUrls: ['./todos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodosComponent {
  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;
  @Input() selectedUsers: number[] = [];

  loading = false;
  errorMsg = '';

  // ======= KPI =======
  totalPosts = 0;

  topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];

  // ======= Chart selectors =======
  sentimentChartType: ChartType = 'doughnut';
  categoriesChartType: ChartType = 'bar';

  readonly sentimentTypeOptions: ChartType[] = ['doughnut', 'pie', 'bar'];
  readonly categoriesTypeOptions: ChartType[] = ['bar', 'doughnut', 'pie'];

  // ======= Charts data =======
  timelineChartType: ChartType = 'line';

  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Posts por día',
      data: [],
      borderColor: NETVORA_PALETTE.accent,
      backgroundColor: 'rgba(109,40,217,1)',
      tension: 0.35,
      fill: false,
      pointRadius: 2,
      pointBackgroundColor: NETVORA_PALETTE.accent,
      pointHoverRadius: 4,
      borderWidth: 2
      },
    ],
  };

  sentimentData: ChartData<'doughnut' | 'pie' | 'bar'> = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{ label: 'Sentimientos', data: [0, 0, 0],

      backgroundColor: [
        NETVORA_PALETTE.sentiment.negativo,
        NETVORA_PALETTE.sentiment.neutro,
        NETVORA_PALETTE.sentiment.positivo
      ],
      borderWidth: 0
     }],
  };

  categoriesData: ChartData<'doughnut' | 'pie' | 'bar'> = {
    labels: [],
    datasets: [{ label: 'Categorías', data: [], 
      backgroundColor: NETVORA_PALETTE.categories,
      borderWidth: 0
    }],
  };

  // ======= Options =======
  readonly commonCardChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
  };

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { maxRotation: 0 } },
      y: { beginAtZero: true },
    },
  };

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  public cargarDatos(): void {
  if (!this.startDate) return;

  const start = this.toYMD(this.startDate);

  const body: any = {
    start,
    users: this.selectedUsers || [],
  };

  // ✅ SOLO si el usuario eligió endDate, lo mandas
  if (this.endDate) {
    body.end = this.toYMD(this.endDate);
  }

  this.loading = true;
  this.errorMsg = '';
  this.cdr.markForCheck();

  this.api.getAllData(body)
    .pipe(finalize(() => {
      this.loading = false;
      this.cdr.markForCheck();
    }))
    .subscribe({
      next: (res) => this.mapResponse(res),
      error: () => {
        this.errorMsg = 'No se pudo cargar el dashboard.';
        this.cdr.markForCheck();
      },
    });
}


  private mapResponse(res: StatsResponse): void {
    // ======= KPI =======
    this.totalPosts = res?.posts?.total_posts ?? 0;

    // Top 3 (tomas los primeros 3 del array ya ordenado)
    this.topLocacion = (res?.locacion ?? []).slice(0, 3);
    this.topOrganizacion = (res?.organizacion ?? []).slice(0, 3);
    this.topPersona = (res?.persona ?? []).slice(0, 3);

    // ======= Timeline =======
    const tl = res?.time_line ?? [];
    const labels = tl.map((x: any) => this.formatTimelineLabel(x.fecha));
    const data = tl.map((x: any) => Number(x.total || 0));

    this.timelineData = {
      labels,
      datasets: [
        {
          label: 'Posts por día',
          data: data,
          borderColor: NETVORA_PALETTE.accent,
          backgroundColor: 'rgba(109,40,217,1)',
          tension: 0.35,
          fill: false,
          pointRadius: 2,
          pointBackgroundColor: NETVORA_PALETTE.accent,
          pointHoverRadius: 4,
          borderWidth: 2

        },
      ],
    };

    // ======= Sentimientos =======
    const s = res?.sentimientos?.posts_per_sentiment ?? ({} as any);
    const neg = Number(s.negativo || 0);
    const neu = Number(s.neutro || 0);
    const pos = Number(s.positivo || 0);

    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{ label: 'Sentimientos', 
        
        data: [neg, neu, pos],
         backgroundColor: [
        NETVORA_PALETTE.sentiment.negativo,
        NETVORA_PALETTE.sentiment.neutro,
        NETVORA_PALETTE.sentiment.positivo
      ],
      borderWidth: 0
        


      }],
    };

    // ======= Categorías =======
    const pc = res?.posts_categories?.posts_per_category ?? ({} as any);
    const catLabels = Object.keys(pc);
    const catData = catLabels.map((k) => Number(pc[k] || 0));

    this.categoriesData = {
      labels: catLabels,
      datasets: [{ 
        label: 'Categorías', data: catData, 
        backgroundColor: NETVORA_PALETTE.categories,
      borderWidth: 0
        


      }],
    };

    this.cdr.markForCheck();
  }

  // ======= helpers =======
  private toYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimelineLabel(fecha: string): string {
    // Recibe "Mon, 15 Dec 2025 00:00:00 GMT" -> label "15/12"
    const dt = new Date(fecha);
    if (Number.isNaN(dt.getTime())) return fecha;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  // ======= downloads (ya los tenías) =======
  downloadChart(event: Event) {
    const chartContainer = (event.target as HTMLElement).closest('.chart');
    const canvas = chartContainer?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `grafico-${Date.now()}.png`;
    link.click();
  }

  public downloadAllCharts() {
    const canvases = document.querySelectorAll('.chart canvas') as NodeListOf<HTMLCanvasElement>;
    if (!canvases.length) return;

    canvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `grafico-${index + 1}-${Date.now()}.png`;
      link.click();
    });
  }

  trackByEntidad = (_: number, item: { entidad: string }) => item.entidad;
}
