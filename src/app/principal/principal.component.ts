import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { HomePageResponse } from '../interfaces/homePage';
import { users } from '../interfaces/users';
import { Router } from '@angular/router';

interface PrincipalStatsVM {
  totalHoy: number;
  positivas: number;
  neutras: number;
  negativas: number;
  categoriaTop: string;
  topEntidades: TopEntidadVM[];
}

export interface TopEntidadVM {
  entidad: string;
  total: number;
}

interface WeekBar {
  x: number;      // x en SVG (0..100)
  w: number;      // ancho
  y: number;      // y superior del rect
  h: number;      // alto del rect
  v: number;      // valor real
  fecha: string;  // label
  cls: 'pos' | 'neg' | 'zero';
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

  users: users[] = [];

  // Chart bars
  weekBars: WeekBar[] = [];
  weekLabels: string[] = [];
  weekZeroY = 20; // línea 0 en SVG (y)
  weekDomainMin = 0;
  weekDomainMax = 0;

  // Métricas
  weekMax = 0;
  weekMin = 0;
  weekAvg = 0;

  // UI state
  cargando = false;
  error = '';

  showNoUsersModal = false;

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.apiService.getUsers2("Medio").subscribe({
      next: (data) => {
        this.users = Array.isArray(data) ? data : [];

        if (this.users.length === 0) {
          this.showNoUsersModal = true;
          return;
        }

        this.loadMainStats(this.users.map(u => String(u.idTweetUser)));
      },
      error: (error) => {
        
        this.error = 'No se pudieron cargar los usuarios.';
      }
    });
  }

  get top3Entidades(): TopEntidadVM[] {
    const src: TopEntidadVM[] = Array.isArray(this.stats?.topEntidades) ? this.stats.topEntidades : [];
    const fallback: TopEntidadVM = { entidad: '—', total: 0 };
    return [src[0] ?? fallback, src[1] ?? fallback, src[2] ?? fallback];
  }

  trackByIndex = (i: number) => i;
  trackByBar = (_: number, b: WeekBar) => `${b.x}-${b.v}-${b.fecha}`;

  private loadMainStats(users?: string[]): void {
    this.cargando = true;
    this.error = '';

    this.apiService.getMainPageStats(users)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (res: HomePageResponse) => {
          const daily = res?.daily;

          this.todayLabel = daily?.fecha ?? '';

          this.stats = {
            totalHoy: this.toNumber(daily?.total_noticias),
            positivas: this.toNumber(daily?.sentimientos?.positivo),
            neutras: this.toNumber(daily?.sentimientos?.neutro),
            negativas: this.toNumber(daily?.sentimientos?.negativo),
            categoriaTop: (daily?.top_categoria ?? '—').trim() || '—',
            topEntidades: Array.isArray(daily?.top_3_entidades)
              ? daily.top_3_entidades.map((e: any) => ({
                  entidad: e?.entidad ?? '—',
                  total: Number(e?.total ?? 0)
                }))
              : []
          };

          this.last7Days = Array.isArray(res?.last_7_days) ? res.last_7_days : [];
          this.buildWeekBarChart(this.last7Days);
        },
        error: (err) => {
          
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
    this.weekBars = [];
    this.weekLabels = [];
    this.weekZeroY = 20;
    this.weekDomainMin = 0;
    this.weekDomainMax = 0;
    this.weekMax = 0;
    this.weekMin = 0;
    this.weekAvg = 0;
  }

  /**
   * ✅ Gráfica de barras con baseline 0
   * - Siempre incluye 0 en el dominio para que la referencia neutral exista
   * - No “falla” cuando hay valores todos positivos o todos negativos
   * - Se entiende mejor que una línea para índices +/-.
   */
  private buildWeekBarChart(days: HomePageResponse['last_7_days']): void {
    const safeDays = Array.isArray(days) ? days : [];
    if (!safeDays.length) {
      this.resetWeekChart();
      return;
    }

    this.weekLabels = safeDays.map(d => d.fecha ?? '—');
    const values = safeDays.map(d => this.toNumber(d.indice));

    // métricas
    const maxV = Math.max(...values);
    const minV = Math.min(...values);
    const avgV = values.reduce((a, b) => a + b, 0) / values.length;

    this.weekMax = maxV;
    this.weekMin = minV;
    this.weekAvg = avgV;

    // 🔥 Dominio INCLUYENDO 0 siempre
    const domainMin = Math.min(minV, 0);
    const domainMax = Math.max(maxV, 0);
    this.weekDomainMin = domainMin;
    this.weekDomainMax = domainMax;

    // SVG scale: y [6..34] invertido
    const yTop = 6;
    const yBot = 34;
    const yRange = yBot - yTop;

    const denom = (domainMax - domainMin) === 0 ? 1 : (domainMax - domainMin);

    const mapY = (v: number) => {
      const t = (v - domainMin) / denom;           // 0..1
      return +(yBot - (t * yRange)).toFixed(2);    // invertido
    };

    // baseline de 0
    const zeroY = mapY(0);
    this.weekZeroY = zeroY;

    // barras: ancho dinámico
    const n = values.length;
    const gap = 1.4; // en unidades SVG (0..100)
    const totalGap = gap * (n + 1);
    const w = Math.max(6, (100 - totalGap) / n); // no muy flacas
    const bars: WeekBar[] = [];

    for (let i = 0; i < n; i++) {
      const v = values[i];
      const yV = mapY(v);

      // rect desde baseline a valor
      const y = Math.min(zeroY, yV);
      const h = Math.abs(zeroY - yV);

      const x = +(gap + i * (w + gap)).toFixed(2);

      const cls: WeekBar['cls'] = v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';

      bars.push({
        x,
        w: +w.toFixed(2),
        y,
        h: +h.toFixed(2),
        v,
        fecha: this.weekLabels[i] || '—',
        cls
      });
    }

    this.weekBars = bars;
  }

  irAUsuarios() {
    this.router.navigate(['/settings']);
  }
}