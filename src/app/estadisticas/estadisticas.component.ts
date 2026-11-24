import { DashboardEntityType, DashboardSelection } from '../interfaces/dashboard-evidence';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { users } from '../interfaces/users';
import { ApiService } from '../services/api.service';

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

  private usersRequestId = 0;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const params = this.router.parseUrl(this.router.url).queryParams;
    const views: Record<VistaDashboard, string> = {
      todos: 'Estadísticas generales', politica: 'Política', economia: 'Economía', seguridad: 'Seguridad',
      deportes: 'Deportes', sociedad: 'Sociedad', ambiente: 'Ambiente', salud: 'Salud',
      educacion: 'Educación', gestiones: 'Gestiones', otros: 'Otros', entidades: 'Entidades', personas: 'Personas'
    };
    const view: VistaDashboard = typeof params['vista'] === 'string' &&
      Object.prototype.hasOwnProperty.call(views, params['vista']) ? params['vista'] as VistaDashboard : 'todos';
    this.goToView(view, views[view], view === 'todos' ? 'todos'
      : view === 'entidades' ? 'Entidad' : view === 'personas' ? 'Persona' : 'Medio');
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
      if ((view === 'personas' || view === 'entidades') && typeof params['entidad'] === 'string' &&
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
  }

  trackByUserId = (_: number, user: users): string => String(user.idTweetUser);
  trackByTopicId = (_: number, topic: TopicFilterOption): number => topic.id;
}
