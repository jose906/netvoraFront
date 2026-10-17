
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import { Subscription } from 'rxjs';

import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import { ApiService } from '../services/api.service';

type CategoryKey =
  | 'inicio'
  | 'politica'
  | 'economia'
  | 'seguridad'
  | 'deportes'
  | 'salud'
  | 'sociedad'
  | 'educacion'
  | 'gestion'
  | 'ambiente'
  | 'otros'
  | 'entidades'
  | 'personas';

type AccountType = 'Medio' | 'Entidad' | 'Persona';
type EditKind = 'categoria' | 'sentimiento';

interface CategoryTab {
  key: CategoryKey;
  label: string;
  apiCategory: string;
  accountType: AccountType;
}

interface CorrectionOption {
  label: string;
  value: string;
}

interface AppliedFilters {
  startDate?: Date;
  endDate?: Date;
  users: string[];
  searchText: string;
}

interface PendingChange {
  kind: EditKind;
  item: NewsItem;
  previous: string;
  next: string;
  label: string;
}

@Component({
  selector: 'app-cat-select',
  templateUrl: './cat-select.component.html',
  styleUrl: './cat-select.component.css'
})
export class CatSelectComponent implements OnInit, OnDestroy {

  @ViewChild('confirmationDialog')
  confirmationDialog?: ElementRef<HTMLDialogElement>;

  // =====================================================
  // CATEGORÍAS
  // =====================================================

  readonly categoryTabs: CategoryTab[] = [
    {
      key: 'inicio',
      label: 'Inicio',
      apiCategory: '',
      accountType: 'Medio'
    },
    {
      key: 'politica',
      label: 'Política',
      apiCategory: 'Politica',
      accountType: 'Medio'
    },
    {
      key: 'economia',
      label: 'Economía',
      apiCategory: 'Economia',
      accountType: 'Medio'
    },
    {
      key: 'seguridad',
      label: 'Seguridad',
      apiCategory: 'Seguridad',
      accountType: 'Medio'
    },
    {
      key: 'deportes',
      label: 'Deportes',
      apiCategory: 'Deportes',
      accountType: 'Medio'
    },
    {
      key: 'salud',
      label: 'Salud',
      apiCategory: 'Salud',
      accountType: 'Medio'
    },
    {
      key: 'sociedad',
      label: 'Sociedad',
      apiCategory: 'Social',
      accountType: 'Medio'
    },
    {
      key: 'educacion',
      label: 'Educación',
      apiCategory: 'Educacion',
      accountType: 'Medio'
    },
    {
      key: 'gestion',
      label: 'Gestiones Públicas',
      apiCategory: 'Gestiones',
      accountType: 'Medio'
    },
    {
      key: 'ambiente',
      label: 'Medio Ambiente',
      apiCategory: 'Ambiente',
      accountType: 'Medio'
    },
    {
      key: 'otros',
      label: 'Otros',
      apiCategory: 'Otros',
      accountType: 'Medio'
    },
    {
      key: 'entidades',
      label: 'Entidades Públicas',
      apiCategory: '',
      accountType: 'Entidad'
    },
    {
      key: 'personas',
      label: 'Personas Públicas',
      apiCategory: '',
      accountType: 'Persona'
    }
  ];

  // Valores de corrección.
  // Se utilizan los nombres del módulo CategoriaComponent.

  readonly correctionCategories: CorrectionOption[] = [
    { label: 'Política', value: 'Politica' },
    { label: 'Economía', value: 'Economia' },
    { label: 'Seguridad', value: 'Seguridad' },
    { label: 'Deportes', value: 'Deportes' },
    { label: 'Salud', value: 'Salud' },
    { label: 'Sociedad', value: 'Social' },
    { label: 'Educación', value: 'Educacion' },
    { label: 'Gestiones Públicas', value: 'Gestiones' },
    { label: 'Medio Ambiente', value: 'Ambiente' },
    { label: 'Otros', value: 'Otros' }
  ];

  readonly correctionSentiments: CorrectionOption[] = [
    { label: 'Positivo', value: 'positivo' },
    { label: 'Neutro', value: 'neutro' },
    { label: 'Negativo', value: 'negativo' }
  ];

  activeCategory: CategoryKey = 'inicio';

  get activeOption(): CategoryTab {
    return this.categoryTabs.find(
      option => option.key === this.activeCategory
    )!;
  }

  // =====================================================
  // PUBLICACIONES
  // =====================================================

  datos: NewsItem[] = [];

  cargando = false;
  cargandoUsuarios = false;

  error = '';
  errorUsuarios = '';
  errorGuardado = '';
  avisoExito = '';

  // =====================================================
  // FILTROS
  // =====================================================

  startDate: Date | undefined = new Date();
  endDate: Date | undefined;

  searchText = '';

  users: users[] = [];
  selectedUsers: string[] = [];

  private appliedFilters: AppliedFilters = {
    startDate: this.startDate,
    endDate: undefined,
    users: [],
    searchText: ''
  };

  // =====================================================
  // PAGINACIÓN
  // =====================================================

  currentPage = 1;
  pageSize = 10;
  hasMore = false;

  // =====================================================
  // EDICIÓN / CONFIRMACIÓN
  // =====================================================

  editorActivo: {
    id: string;
    kind: EditKind;
  } | null = null;

  pendingChange: PendingChange | null = null;

  guardandoCambio = false;
  guardandoTweetId: string | null = null;

  // =====================================================
  // SUBSCRIPCIONES
  // =====================================================

  private postsSubscription?: Subscription;
  private usersSubscription?: Subscription;
  private mutationSubscription?: Subscription;

  private requestSequence = 0;

  constructor(
    private apiService: ApiService
  ) {}

  // =====================================================
  // CICLO DE VIDA
  // =====================================================

  ngOnInit(): void {
    this.cargarUsuariosYPublicaciones();
  }

  ngOnDestroy(): void {
    this.postsSubscription?.unsubscribe();
    this.usersSubscription?.unsubscribe();
    this.mutationSubscription?.unsubscribe();
  }

  // =====================================================
  // UTILIDADES
  // =====================================================

  trackByTweet(
    index: number,
    item: NewsItem
  ): string {
    return String(item.tweetid);
  }

  trackByCategory(
    index: number,
    category: CategoryTab
  ): string {
    return category.key;
  }

  private normalizar(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  esCategoriaActual(
    item: NewsItem,
    value: string
  ): boolean {
    return this.normalizar(item.categoria) ===
      this.normalizar(value);
  }

  esSentimientoActual(
    item: NewsItem,
    value: string
  ): boolean {
    return this.normalizar(item.sentimiento) ===
      this.normalizar(value);
  }

  private toYMD(date?: Date): string | undefined {
    if (!date || Number.isNaN(date.getTime())) {
      return undefined;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  formatBoliviaDate(value: unknown): string {
    if (!value) {
      return '';
    }

    const raw = String(value).trim().replace(' ', 'T');

    const withZone =
      /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
        ? raw
        : `${raw}Z`;

    const date = value instanceof Date
      ? value
      : new Date(withZone);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  // =====================================================
  // SNAPSHOT DE FILTROS
  // La paginación conserva los filtros aplicados.
  // =====================================================

  private guardarFiltrosAplicados(): void {
    this.appliedFilters = {
      startDate: this.startDate,
      endDate: this.endDate,
      users: [...this.selectedUsers],
      searchText: this.searchText.trim()
    };
  }

  // =====================================================
  // CAMBIAR CATEGORÍA
  // =====================================================

  onSelect(categoria: CategoryKey): void {
    if (this.guardandoCambio) {
      return;
    }

    if (this.activeCategory === categoria) {
      return;
    }

    const previousType = this.activeOption.accountType;

    this.activeCategory = categoria;
    this.currentPage = 1;

    this.error = '';
    this.errorGuardado = '';
    this.avisoExito = '';

    this.editorActivo = null;

    // Cancelamos inmediatamente la consulta anterior.
    this.postsSubscription?.unsubscribe();
    this.requestSequence++;

    this.datos = [];
    this.hasMore = false;

    const nextType = this.activeOption.accountType;

    if (previousType !== nextType) {
      this.selectedUsers = [];
      this.guardarFiltrosAplicados();
      this.cargarUsuariosYPublicaciones();
    } else {
      this.guardarFiltrosAplicados();
      this.loadByCategory(1);
    }
  }

  // =====================================================
  // CARGAR CUENTAS SEGÚN TIPO
  // =====================================================

  private cargarUsuariosYPublicaciones(): void {
    const type = this.activeOption.accountType;

    this.cargandoUsuarios = true;
    this.errorUsuarios = '';

    this.usersSubscription?.unsubscribe();
    this.postsSubscription?.unsubscribe();

    this.requestSequence++;

    this.datos = [];
    this.cargando = true;

    this.usersSubscription = this.apiService
      .getUsers2(type)
      .subscribe({
        next: (data: users[]) => {
          if (this.activeOption.accountType !== type) {
            return;
          }

          this.users = Array.isArray(data) ? data : [];
          this.cargandoUsuarios = false;

          this.loadByCategory(1);
        },

        error: (err) => {
          console.error('Error cargando cuentas:', err);

          if (this.activeOption.accountType !== type) {
            return;
          }

          this.users = [];
          this.cargandoUsuarios = false;

          this.errorUsuarios =
            'No se pudo cargar el listado de cuentas.';

          // Las publicaciones aún pueden consultarse
          // sin un filtro específico por usuario.
          this.loadByCategory(1);
        }
      });
  }

  // =====================================================
  // FILTRAR
  // =====================================================

  filtrar(): void {
    if (this.startDate && this.endDate &&
        this.startDate > this.endDate) {
      this.error =
        'La fecha de inicio no puede ser posterior a la fecha final.';
      return;
    }

    this.error = '';
    this.guardarFiltrosAplicados();
    this.loadByCategory(1);
  }

  // =====================================================
  // LIMPIAR
  // =====================================================

  limpiar(): void {
    this.startDate = undefined;
    this.endDate = undefined;
    this.selectedUsers = [];
    this.searchText = '';

    this.editorActivo = null;

    this.error = '';
    this.errorGuardado = '';
    this.avisoExito = '';

    this.guardarFiltrosAplicados();

    // A diferencia de la versión anterior,
    // ahora realmente recarga los resultados.
    this.loadByCategory(1);
  }

  // =====================================================
  // CONSTRUIR PETICIÓN
  // =====================================================

  
private buildBody(page: number): any {
  const body: any = {
    page,
    limit: this.pageSize
  };

  const start = this.toYMD(this.appliedFilters.startDate);
  const end = this.toYMD(this.appliedFilters.endDate);

  if (start) body.startDate = start;
  if (end) body.endDate = end;

  if (this.appliedFilters.searchText) {
    body.searchText = this.appliedFilters.searchText;
  }

  // INICIO: conservar el formato del endpoint original
  if (this.activeCategory === 'inicio') {
    if (this.appliedFilters.users.length) {
      body.users = this.appliedFilters.users.map(Number);
    }

    return body;
  }

  // RESTO: endpoint unificado de categorías
  body.categoria = this.activeOption.apiCategory;
  body.type = this.activeOption.accountType;
  body.type_user = this.activeOption.accountType;

  body.users = this.appliedFilters.users.length
    ? [...this.appliedFilters.users]
    : this.users.map(user => String(user.idTweetUser));

  return body;
}


  // =====================================================
  // ÚNICO MÉTODO DE CONSULTA
  // =====================================================

  private loadByCategory(page: number = 1): void {
    this.postsSubscription?.unsubscribe();

    const sequence = ++this.requestSequence;

    this.cargando = true;
    this.error = '';

    const body = this.buildBody(page);
    const apiCall = this.activeCategory === 'inicio'
  ? this.apiService.getAllPosts(body)
  : this.apiService.getPostsCategoria(body);

    this.postsSubscription = apiCall
      .subscribe({
        next: (response: any) => {
          if (sequence !== this.requestSequence) {
            return;
          }

          const rows =
            response?.resultado ??
            response?.items ??
            response?.data ??
            [];

          this.datos = Array.isArray(rows) ? rows : [];

          this.currentPage = Number(
            response?.page ?? page
          );

          this.hasMore =
            typeof response?.hasMore === 'boolean'
              ? response.hasMore
              : this.datos.length === this.pageSize;

          this.cargando = false;
        },

        error: (err) => {
          if (sequence !== this.requestSequence) {
            return;
          }

          console.error(
            'Error consultando publicaciones:',
            err
          );

          this.error =
            'No se pudieron cargar las publicaciones.';

          this.datos = [];
          this.hasMore = false;
          this.cargando = false;
        }
      });
  }

  // =====================================================
  // PAGINACIÓN
  // =====================================================

  loadNextPage(): void {
    if (!this.hasMore || this.cargando) {
      return;
    }

    this.loadByCategory(this.currentPage + 1);
  }

  loadPreviousPage(): void {
    if (this.currentPage <= 1 || this.cargando) {
      return;
    }

    this.loadByCategory(this.currentPage - 1);
  }

  // =====================================================
  // EXPANDIR EDITOR
  // =====================================================

  toggleEditor(
    item: NewsItem,
    kind: EditKind
  ): void {
    const id = String(item.tweetid);

    if (
      this.editorActivo?.id === id &&
      this.editorActivo?.kind === kind
    ) {
      this.editorActivo = null;
      return;
    }

    this.editorActivo = { id, kind };
  }

  editorAbierto(
    item: NewsItem,
    kind: EditKind
  ): boolean {
    return (
      this.editorActivo?.id === String(item.tweetid) &&
      this.editorActivo?.kind === kind
    );
  }

  // =====================================================
  // PREPARAR CAMBIO DE CATEGORÍA
  // =====================================================

  abrirCambioCategoria(
    item: NewsItem,
    option: CorrectionOption
  ): void {
    if (this.esCategoriaActual(item, option.value)) {
      return;
    }

    this.pendingChange = {
      kind: 'categoria',
      item,
      previous: String(item.categoria ?? ''),
      next: option.value,
      label: option.label
    };

    this.abrirConfirmacion();
  }

  // =====================================================
  // PREPARAR CAMBIO DE SENTIMIENTO
  // =====================================================

  abrirCambioSentimiento(
    item: NewsItem,
    option: CorrectionOption
  ): void {
    if (this.esSentimientoActual(item, option.value)) {
      return;
    }

    this.pendingChange = {
      kind: 'sentimiento',
      item,
      previous: String(item.sentimiento ?? ''),
      next: option.value,
      label: option.label
    };

    this.abrirConfirmacion();
  }

  private abrirConfirmacion(): void {
    this.errorGuardado = '';

    const dialog = this.confirmationDialog?.nativeElement;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  // =====================================================
  // CANCELAR CAMBIO
  // =====================================================

  cancelarConfirmacion(): void {
    if (this.guardandoCambio) {
      return;
    }

    const dialog = this.confirmationDialog?.nativeElement;

    if (dialog?.open) {
      dialog.close();
    }

    this.pendingChange = null;
    this.errorGuardado = '';
  }

  onDialogCancel(event: Event): void {
    if (this.guardandoCambio) {
      event.preventDefault();
      return;
    }

    this.pendingChange = null;
    this.errorGuardado = '';
  }

  // =====================================================
  // CONFIRMAR Y GUARDAR
  // =====================================================

  confirmarCambio(): void {
    const change = this.pendingChange;

    if (!change || this.guardandoCambio) {
      return;
    }

    this.guardandoCambio = true;
    this.guardandoTweetId = String(change.item.tweetid);

    this.errorGuardado = '';

    const id = String(change.item.tweetid);
    const text = String(change.item.text ?? '');

    const request = change.kind === 'categoria'
      ? this.apiService.updateCategory({
          idTweet: id,
          newCategory: change.next,
          oldCategory: change.previous,
          text
        })
      : this.apiService.updateSentiment({
          idTweet: id,
          newSentiment: change.next,
          oldSentiment: change.previous,
          text
        });

    this.mutationSubscription = request.subscribe({
      next: () => {
        this.guardandoCambio = false;
        this.guardandoTweetId = null;

        const tipo = change.kind === 'categoria'
          ? 'Categoría'
          : 'Sentimiento';

        this.avisoExito =
          `${tipo} actualizado correctamente.`;

        this.pendingChange = null;
        this.editorActivo = null;

        const dialog =
          this.confirmationDialog?.nativeElement;

        if (dialog?.open) {
          dialog.close();
        }

        // Conserva la página actual.
        this.loadByCategory(this.currentPage);
      },

      error: (err) => {
        console.error('Error actualizando publicación:', err);

        this.guardandoCambio = false;
        this.guardandoTweetId = null;

        // El diálogo permanece abierto para poder
        // volver a intentar o cancelar.
        this.errorGuardado =
          'No se pudo guardar el cambio. Inténtalo nuevamente.';
      }
    });
  }
}
