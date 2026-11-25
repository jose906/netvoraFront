import { DashboardEntityType, DashboardSelection } from '../interfaces/dashboard-evidence';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { users } from '../interfaces/users';
import { ApiService } from '../services/api.service';
import { formatCalendarDate, formatStatisticsRange, StatisticsFilters } from './statistics-insights';
import type { StatisticsReportChart } from './statistics-report';

type TipoCuenta = 'todos' | 'Medio' | 'Entidad' | 'Persona';

type VistaDashboard =
  | 'todos'
  | 'politica'
  | 'economia'
  | 'seguridad'
  | 'deportes'
  | 'sociedad'
  | 'ambiente'
  | 'salud'
  | 'educacion'
  | 'gestiones'
  | 'otros'
  | 'entidades'
  | 'personas';

interface TopicFilterOption {
  id: number;
  name: string;
  total_posts?: number;
}

interface ApiTopicOption {
  topic_id: number | string;
  topic_name: string;
  total_posts?: number;
}

@Component({
  selector: 'app-estadisticas',
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.css'
})
export class EstadisticasComponent implements OnInit {
  readonly views: { id: VistaDashboard; label: string; title?: string; type: TipoCuenta; icon: string }[] = [
    { id: 'todos', label: 'General', title: 'Estadísticas generales', type: 'todos', icon: 'dashboard' },
    { id: 'politica', label: 'Política', type: 'Medio', icon: 'account_balance' },
    { id: 'economia', label: 'Economía', type: 'Medio', icon: 'payments' },
    { id: 'seguridad', label: 'Seguridad', type: 'Medio', icon: 'security' },
    { id: 'sociedad', label: 'Sociedad', type: 'Medio', icon: 'groups' },
    { id: 'deportes', label: 'Deportes', type: 'Medio', icon: 'sports_soccer' },
    { id: 'ambiente', label: 'Ambiente', title: 'Medio ambiente', type: 'Medio', icon: 'eco' },
    { id: 'salud', label: 'Salud', type: 'Medio', icon: 'medical_services' },
    { id: 'educacion', label: 'Educación', type: 'Medio', icon: 'school' },
    { id: 'gestiones', label: 'Gestiones', title: 'Gestiones públicas', type: 'Medio', icon: 'assignment' },
    { id: 'otros', label: 'Otros', type: 'Medio', icon: 'category' },
    { id: 'entidades', label: 'Entidades', title: 'Entidades públicas', type: 'Entidad', icon: 'apartment' },
    { id: 'personas', label: 'Personas', title: 'Personas públicas', type: 'Persona', icon: 'person' }
  ];

  selectedComponent: VistaDashboard = 'todos';
  selectedCategoria = 'Estadísticas generales';

  // Estado editable del formulario: no modifica los dashboards hasta Aplicar.
  filterStartDate: Date | null = new Date();
  filterEndDate: Date | null = null;
  filterSelectedUsers: string[] = [];
  filterSearchText = '';
  filterSelectedTopics: number[] = [];

  // Estado aplicado: estos valores se envían a los hijos desde el HTML.
  appliedStartDate: Date | null = new Date();
  appliedEndDate: Date | null = null;
  appliedSelectedUsers: string[] = [];
  appliedSearchText = '';
  appliedEntity = '';
  appliedEntityType?: DashboardEntityType;
  appliedSelectedTopics: number[] = [];

  users: users[] = [];
  loadingUsers = false;
  availableTopics: TopicFilterOption[] = [];
  loadingTopics = false;
  topicsError = '';
  filtersOpen = false;
  filtersError = '';

  readonly sections = [
    { id: 'summary', label: 'Resumen' },
    { id: 'activity', label: 'Actividad' },
    { id: 'topics', label: 'Tópicos' },
    { id: 'sources', label: 'Fuentes' },
    { id: 'entities', label: 'Entidades' },
    { id: 'sentiment', label: 'Sentimiento' },
    { id: 'detail', label: 'Detalle' },
    { id: 'audience', label: 'Audiencia' }
  ];

  get visibleSections() {
    return this.selectedComponent === 'todos'
      ? this.sections.filter(section => section.id !== 'detail')
      : this.sections;
  }

  statisticsFilters?: StatisticsFilters;

  @ViewChild('reportSource', { static: true }) private reportSource!: ElementRef<HTMLElement>;
  @ViewChild('reportDialog', { static: true }) private reportDialog!: ElementRef<HTMLDialogElement>;
  reportCharts: StatisticsReportChart[] = [];
  reportBusy = false;
  reportTitle = '';
  reportNote = '';
  reportStatus = '';
  reportError = '';

  private usersRequestId = 0;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const params = this.router.parseUrl(this.router.url).queryParams;
    const view = this.views.find(option => option.id === params['vista']) ?? this.views[0];
    this.goToView(view.id, view.title ?? view.label, view.type);
    if (params['seguir'] === '1') {
      this.radarFormOpen = true;
      this.radarName = typeof params['nombre'] === 'string' ? params['nombre'].slice(0, 120) : '';
    }
    if (params['inicio']) {
      this.filterStartDate = this.parseDate(params['inicio']) ?? this.filterStartDate;
      this.filterEndDate = this.parseDate(params['fin']);
      this.filterSelectedUsers = typeof params['cuentas'] === 'string'
        ? params['cuentas'].split(',').filter((id: string) => /^\d+$/.test(id)) : [];
      this.filterSelectedTopics = typeof params['temas'] === 'string'
        ? params['temas'].split(',').map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0) : [];
      this.filterSearchText = typeof params['buscar'] === 'string' ? params['buscar'] : '';
      const kind = params['tipoEntidad'];
      if ((view.id === 'personas' || view.id === 'entidades') && typeof params['entidad'] === 'string' &&
          (kind === 'PER' || kind === 'ORG' || kind === 'LOC')) {
        this.appliedEntity = params['entidad'].slice(0, 255);
        this.appliedEntityType = kind;
      }
      if (!this.aplicarFechas()) this.resetFiltros();
    }
    this.loadTopics();
  }

  applyDashboardSelection(selection: DashboardSelection): void {
    this.filterStartDate = this.appliedStartDate;
    this.filterEndDate = this.appliedEndDate;
    this.filterSearchText = this.appliedSearchText;
    this.filterSelectedUsers = selection.sourceId ? [selection.sourceId] : [...this.appliedSelectedUsers];
    this.filterSelectedTopics = selection.topicId ? [selection.topicId] : [...this.appliedSelectedTopics];
    if (selection.entity && selection.entityType) {
      this.appliedEntity = selection.entity;
      this.appliedEntityType = selection.entityType;
    }
    if (selection.bucket) {
      this.filterStartDate = this.parseDate(selection.bucket.slice(0, 10));
      this.filterEndDate = null;
    }
    this.aplicarFechas();
  }

  applyPreset(days: number): void {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz',
      year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
    const today = this.parseDate(part('year') + '-' + part('month') + '-' + part('day'));
    if (!today) return;
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    this.filterStartDate = start;
    this.filterEndDate = today;
    this.aplicarFechas();
  }

  removeAppliedFilter(filter: 'accounts' | 'topics' | 'search' | 'entity'): void {
    this.filterStartDate = this.appliedStartDate;
    this.filterEndDate = this.appliedEndDate;
    this.filterSelectedUsers = filter === 'accounts' ? [] : [...this.appliedSelectedUsers];
    this.filterSelectedTopics = filter === 'topics' ? [] : [...this.appliedSelectedTopics];
    this.filterSearchText = filter === 'search' ? '' : this.appliedSearchText;
    if (filter === 'entity') {
      this.appliedEntity = '';
      this.appliedEntityType = undefined;
    }
    this.aplicarFechas();
  }

  radarName = '';
  radarFormOpen = false;
  radarSaving = false;
  radarMessage = '';

  saveRadarWatch(): void {
    const name = this.radarName.trim();
    const accounts = this.appliedSelectedUsers.length ? this.appliedSelectedUsers
      : this.users.map(account => String(account.idTweetUser));
    if (!name || !accounts.length || this.radarSaving) return;
    this.radarSaving = true;
    this.radarMessage = '';
    this.apiService.createRadarWatch(name, {
      view: this.selectedComponent, users: accounts, topic_ids: this.appliedSelectedTopics,
      search: this.appliedSearchText, entidad: this.appliedEntity || undefined, entity_type: this.appliedEntityType
    }).subscribe({
      next: response => {
        this.radarSaving = false;
        this.router.navigate(['/radar'], { queryParams: { seguimiento: response.id } });
      },
      error: error => {
        this.radarSaving = false;
        this.radarMessage = error.error?.error || 'No se pudo crear el seguimiento.';
      }
    });
  }

  private parseDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  closeFilters(): void {
    this.filtersOpen = false;
  }

  applyAndCloseFilters(): void {
    if (this.aplicarFechas()) {
      this.closeFilters();
    }
  }

  loadTopics(): void {
    this.loadingTopics = true;
    this.topicsError = '';

    // Reutiliza la API que ya funciona en TopicsComponent.
    this.apiService.getTopics().subscribe({
      next: (data: ApiTopicOption[]) => {
        const topics = Array.isArray(data) ? data : [];
        const uniqueTopics = new Map<number, TopicFilterOption>();

        for (const item of topics) {
          const id = Number(item.topic_id);
          const name = String(item.topic_name ?? '').trim();

          if (!Number.isSafeInteger(id) || id <= 0 || !name || name.startsWith('__')) {
            continue;
          }

          uniqueTopics.set(id, {
            id,
            name,
            ...(item.total_posts != null
              ? { total_posts: Number(item.total_posts) }
              : {})
          });
        }

        this.availableTopics = Array.from(uniqueTopics.values()).sort(
          (a, b) => a.name.localeCompare(b.name, 'es')
        );

        // Eliminar selecciones que dejaron de estar disponibles.
        const validIds = new Set(this.availableTopics.map(topic => topic.id));
        this.filterSelectedTopics = this.filterSelectedTopics.filter(id => validIds.has(Number(id)));
        this.loadingTopics = false;
      },
      error: (error: unknown) => {
        console.error('Error al cargar tópicos:', error);
        this.availableTopics = [];
        this.loadingTopics = false;
        this.topicsError = 'No fue posible cargar los tópicos.';
      }
    });
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.filterEndDate) count++;
    if (this.filterSelectedUsers.length > 0) count++;
    if (this.filterSearchText.trim()) count++;
    if (this.filterSelectedTopics.length > 0) count++;
    return count;
  }

  goToView(
    component: VistaDashboard,
    categoriaLabel: string,
    tipo: TipoCuenta = 'Medio'
  ): void {
    this.selectedComponent = component;
    this.selectedCategoria = categoriaLabel;
    this.filtersOpen = false;
    this.filtersError = '';

    // Conserva el comportamiento original: al cambiar de vista, reiniciar filtros.
    this.resetFiltrosInterno();
    this.syncAppliedFilters();
    this.loadUsers(tipo);
  }

  loadUsers(tipo: TipoCuenta): void {
    const tipoFinal: TipoCuenta =
      ['todos', 'Medio', 'Entidad', 'Persona'].includes(tipo) ? tipo : 'Medio';

    // Evita que una respuesta lenta de la vista anterior sustituya las cuentas actuales.
    const requestId = ++this.usersRequestId;
    this.loadingUsers = true;
    this.users = [];

    this.apiService.getUsers2(tipoFinal).subscribe({
      next: (data: users[]) => {
        if (requestId !== this.usersRequestId) return;
        this.users = Array.isArray(data) ? data : [];
        this.loadingUsers = false;
      },
      error: (error: unknown) => {
        if (requestId !== this.usersRequestId) return;
        console.error('Error al cargar cuentas:', error);
        this.users = [];
        this.loadingUsers = false;
      }
    });
  }

  aplicarFechas(): boolean {
    this.filtersError = '';

    if (!this.filterStartDate || Number.isNaN(this.filterStartDate.getTime())) {
      this.filtersError = 'Selecciona una fecha de inicio válida.';
      return false;
    }

    if (this.filterEndDate &&
        (Number.isNaN(this.filterEndDate.getTime()) ||
         this.filterStartDate.getTime() > this.filterEndDate.getTime())) {
      this.filtersError = 'La fecha final debe ser igual o posterior a la inicial.';
      return false;
    }

    this.syncAppliedFilters();
    return true;
  }

  resetFiltros(): void {
    this.resetFiltrosInterno();
    this.syncAppliedFilters();
  }

  private resetFiltrosInterno(): void {
    this.appliedEntity = '';
    this.appliedEntityType = undefined;
    this.filterStartDate = new Date();
    this.filterEndDate = null;
    this.filterSelectedUsers = [];
    this.filterSelectedTopics = [];
    this.filterSearchText = '';
    this.filtersError = '';
  }

  showSection(id: string): void {
    const section = this.reportSource.nativeElement.querySelector<HTMLElement>(`[data-statistics-section="${id}"]`);
    if (!section) return;
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
    section.scrollIntoView({ block: 'start' });
  }

  openReport(): void {
    this.reportStatus = '';
    this.reportError = '';
    if (this.reportIsLoading()) {
      this.reportStatus = 'Espera a que terminen de cargar las gráficas para preparar el informe.';
      return;
    }

    this.reportCharts = Array.from(this.reportSource.nativeElement.querySelectorAll<HTMLElement>(
      'canvas[aria-label], [data-report-chart], img.wordcloud-img'
    )).filter(element => element.getClientRects().length > 0).map(element => ({
      element,
      title: element.dataset['reportChart'] || element.getAttribute('aria-label') || element.getAttribute('alt') || 'Gráfica',
      group: this.sections.find(section =>
        section.id === element.closest<HTMLElement>('[data-statistics-section]')?.dataset['statisticsSection'])?.label,
      note: element.dataset['reportNote'],
      selected: true
    }));

    if (!this.reportCharts.length) {
      this.reportStatus = 'No hay gráficas con datos para el informe de esta vista.';
      return;
    }

    this.reportTitle = this.selectedCategoria;
    this.reportNote = '';
    this.closeFilters();
    this.reportDialog.nativeElement.showModal();
  }

  closeReport(): void {
    if (this.reportBusy) return;
    this.reportDialog.nativeElement.close();
    this.reportCharts = [];
  }

  get reportCount(): number {
    return this.reportCharts.filter(chart => chart.selected).length;
  }

  selectReportCharts(selected: boolean): void {
    this.reportCharts.forEach(chart => chart.selected = selected);
  }

  async exportReport(): Promise<void> {
    const filters = this.statisticsFilters;
    if (this.reportBusy || !filters || !this.reportCount) return;
    this.reportError = '';
    if (this.reportIsLoading() || this.reportCharts.some(chart => chart.selected && !chart.element.isConnected)) {
      this.reportError = 'Las gráficas se actualizaron. Cierra el informe y vuelve a abrirlo para cargar la selección actual.';
      return;
    }

    const accountNames = new Map(this.users.map(account => [String(account.idTweetUser), account.TweetUser]));
    const topicNames = new Map(this.availableTopics.map(topic => [topic.id, topic.name]));
    const scope: [string, string][] = [
      ['Vista', this.selectedCategoria],
      ['Período', formatStatisticsRange([filters.start, filters.end]) + ' (hora de Bolivia)'],
      ['Cuentas', filters.users.map(id => accountNames.get(id) || '#' + id).join(', ') || 'Todas las cuentas de la vista'],
      ['Tópicos', filters.topic_ids.map(id => topicNames.get(id) || '#' + id).join(', ') || 'Todos']
    ];
    if (filters.entidad) scope.push(['Entidad mencionada', filters.entidad]);
    if (filters.search) scope.push(['Búsqueda', filters.search]);
    const warnings = Array.from(this.reportSource.nativeElement.querySelectorAll<HTMLElement>('.nv-error-state'))
      .filter(error => error.getClientRects().length && !error.closest('app-dashboard-evidence'))
      .map(error => error.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean);
    const currentDay = this.reportSource.nativeElement.querySelector('.period-note')?.textContent?.trim();
    if (currentDay) warnings.push(currentDay);

    this.reportBusy = true;
    try {
      const { downloadStatisticsReport } = await import('./statistics-report');
      const omitted = await downloadStatisticsReport({
        title: this.reportTitle.trim() || this.selectedCategoria,
        scope, note: this.reportNote.trim(), warnings: [...new Set(warnings)],
        charts: this.reportCharts.filter(chart => chart.selected)
      }, 'netvora-estadisticas-' + this.selectedComponent + '-' + filters.start + '.pdf');
      this.reportStatus = omitted
        ? `Informe descargado con ${omitted} gráficas omitidas. El PDF detalla cuáles.`
        : 'Informe PDF descargado.';
      this.reportDialog.nativeElement.close();
      this.reportCharts = [];
    } catch {
      this.reportError = 'No se pudo generar el PDF. Intenta de nuevo con las gráficas seleccionadas.';
    } finally {
      this.reportBusy = false;
    }
  }

  private reportIsLoading(): boolean {
    const states = this.reportSource.nativeElement.querySelectorAll<HTMLElement>(
      '.nv-loading-state, .nv-loading-indicator, .insights-status[role="status"]'
    );
    return Array.from(states).some(state => state.getClientRects().length && !state.closest('app-dashboard-evidence'));
  }

  private syncAppliedFilters(): void {
    this.appliedStartDate = this.filterStartDate
      ? new Date(this.filterStartDate)
      : null;
    this.appliedEndDate = this.filterEndDate
      ? new Date(this.filterEndDate)
      : null;
    this.appliedSelectedUsers = [...this.filterSelectedUsers].map(String);
    this.appliedSelectedTopics = [...new Set(
      this.filterSelectedTopics.map(Number).filter(id => Number.isSafeInteger(id) && id > 0)
    )];
    this.appliedSearchText = this.filterSearchText.trim();
    if (!this.appliedStartDate) return;
    const type = this.views.find(view => view.id === this.selectedComponent)?.type;
    this.statisticsFilters = {
      start: formatCalendarDate(this.appliedStartDate),
      end: formatCalendarDate(this.appliedEndDate ?? this.appliedStartDate),
      users: this.appliedSelectedUsers, topic_ids: this.appliedSelectedTopics, search: this.appliedSearchText,
      categoria: type === 'Medio' ? this.selectedComponent : undefined,
      type_user: type === 'todos' ? undefined : type,
      entidad: this.appliedEntity || undefined, entity_type: this.appliedEntityType
    };
    this.reportStatus = '';
  }

  trackByUserId = (_: number, user: users): string => String(user.idTweetUser);
  trackByTopicId = (_: number, topic: TopicFilterOption): number => topic.id;
}
