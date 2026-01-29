import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { HomePageResponse } from '../interfaces/homePage';

interface PrincipalStatsVM {
  totalHoy: number;
  positivas: number;
  neutras: number;
  negativas: number;
  categoriaTop: string;
  topEntidades: string[];
}

interface CirclePoint {
  x: number;
  y: number;
  v: number;
}

@Component({
  selector: 'app-principal',
  templateUrl: './principal.component.html',
  styleUrls: ['./principal.component.css']
})
export class PrincipalComponent implements OnInit {
  todayLabel = '';

  // Cards (daily)
  stats: PrincipalStatsVM = this.emptyStats();

  // 7 días
  last7Days: HomePageResponse['last_7_days'] = [];

  // SVG
  weekPoints = '0,30 100,30';
  weekCircles: CirclePoint[] = [];
  weekLabels: string[] = [];
  weekLineClass: 'pos' | 'neg' | 'zero' = 'zero';

  // Métricas (índice)
  weekMax = 0;
  weekMin = 0;
  weekAvg = 0;

  // UI state
  cargando = false;
  error = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadMainStats();
  }

  // Top 3 fijo para el template (si no hay datos, rellena con "—")
  get top3Entidades(): string[] {
    const src = Array.isArray(this.stats.topEntidades) ? this.stats.topEntidades : [];
    return [src[0] ?? '—', src[1] ?? '—', src[2] ?? '—'];
  }

  trackByIndex = (i: number) => i;

  trackByCircle = (_: number, p: CirclePoint) => `${p.x}-${p.y}-${p.v}`;

  private loadMainStats(): void {
    this.cargando = true;
    this.error = '';

    this.apiService.getMainPageStats()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (res: HomePageResponse) => {
          const daily = res?.daily;

          // Header
          this.todayLabel = daily?.fecha ?? '';

          // Cards
          this.stats = {
            totalHoy: this.toNumber(daily?.total_noticias),
            positivas: this.toNumber(daily?.sentimientos?.positivo),
            neutras: this.toNumber(daily?.sentimientos?.neutro),
            negativas: this.toNumber(daily?.sentimientos?.negativo),
            categoriaTop: (daily?.top_categoria ?? '—').trim() || '—',
            topEntidades: Array.isArray(daily?.top_3_entidades) ? daily.top_3_entidades : []
          };

          // 7 días
          this.last7Days = Array.isArray(res?.last_7_days) ? res.last_7_days : [];

          // Gráfica
          this.buildWeekIndexLineChart(this.last7Days);
        },
        error: (err) => {
          console.error('❌ Error getMainPageStats:', err);
          this.error = 'No se pudo cargar el resumen de hoy.';

          this.todayLabel = '';
          this.stats = this.emptyStats();
          this.last7Days = [];
          this.resetWeekChart();
        }
      });
  }

  private emptyStats(): PrincipalStatsVM {
    return {
      totalHoy: 0,
      positivas: 0,
      neutras: 0,
      negativas: 0,
      categoriaTop: '—',
      topEntidades: []
    };
  }

  private toNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private resetWeekChart(): void {
    this.weekPoints = '0,30 100,30';
    this.weekCircles = [];
    this.weekLabels = [];
    this.weekLineClass = 'zero';
    this.weekMax = 0;
    this.weekMin = 0;
    this.weekAvg = 0;
  }

  private buildWeekIndexLineChart(days: HomePageResponse['last_7_days']): void {
    const safeDays = Array.isArray(days) ? days : [];

    this.weekLabels = safeDays.map(d => d.fecha ?? '—');
    const values = safeDays.map(d => this.toNumber(d.indice));

    if (!values.length) {
      this.resetWeekChart();
      return;
    }

    const last = values[values.length - 1];
    this.weekLineClass = last > 0 ? 'pos' : last < 0 ? 'neg' : 'zero';

    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    this.weekMax = max;
    this.weekMin = min;
    this.weekAvg = avg;

    // Escala SVG: x [0..100], y [6..34] (invertido)
    const n = values.length;
    const xStep = n === 1 ? 0 : 100 / (n - 1);

    const yTop = 6;
    const yBot = 34;
    const yRange = yBot - yTop;

    const denom = (max - min) === 0 ? 1 : (max - min);

    const points: string[] = [];
    const circles: CirclePoint[] = [];

    values.forEach((v, i) => {
      const x = +(i * xStep).toFixed(2);
      const t = (v - min) / denom;              // 0..1
      const y = +(yBot - (t * yRange)).toFixed(2); // invertido

      points.push(`${x},${y}`);
      circles.push({ x, y, v });
    });

    this.weekPoints = points.join(' ');
    this.weekCircles = circles;
  }
}
