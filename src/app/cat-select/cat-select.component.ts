import { Component, OnInit } from '@angular/core';
import { NewsItem } from '../interfaces/NewsItem';
import { NewsData } from '../interfaces/NewsData';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { users } from '../interfaces/users';
import { Observable } from 'rxjs';
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
  | 'otros'
  | 'entidades'
  | 'ambiente'
  | 'personas';

interface NewsResponse {
  resultado: NewsItem[];
  page: number;
}


@Component({
  selector: 'app-cat-select',
  templateUrl: './cat-select.component.html',
  styleUrl: './cat-select.component.css'
})
export class CatSelectComponent implements OnInit{
   datos: NewsItem[] = [];
  cargando = false;
  error = '';

  // Fechas (ya en TZ La Paz)
  startDate: Date | undefined = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' })
  );
  endDate: Date | undefined;

  currentPage = 1;
  pageSize = 10;
  hasMore = false;

  searchText = '';
  users: users[] = [];
  selectedUsers: number[] = [];

  // ✅ para paginar/filtrar en la categoría actual
  activeCategory: CategoryKey = 'inicio';

  // ✅ Mapa: categoría -> método del ApiService
  private readonly categoryApiMap: Record<CategoryKey, (body: any) => Observable<any>> = {
    inicio: (body) => this.apiService.getAllPosts(body),      // ✅ tu endpoint de "inicio"
    politica: (body) => this.apiService.getNews(body),
    economia: (body) => this.apiService.getPostsEco(body),
    seguridad: (body) => this.apiService.getPostsSegu(body),
    deportes: (body) => this.apiService.getPostsDeport(body),
    salud: (body) => this.apiService.getPostSalud(body),
    sociedad: (body) => this.apiService.getPostsSocial(body),
    educacion: (body) => this.apiService.getPostsEduca(body),
    gestion: (body) => this.apiService.getPostsGestiones(body),
    otros: (body) => this.apiService.getPostsOtros(body),
    entidades: (body) => this.apiService.getPostsEntidades(body),
    personas: (body) => this.apiService.getPostPer(body),
    ambiente: (body) => this.apiService.getPostsAmbiente(body),
  };

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadByCategory(this.activeCategory, { resetPage: true }); // ✅ carga inicio
  }

  /** Helpers */
  private formatDate(d?: Date): string | undefined {
    return d ? d.toISOString().split('T')[0] : undefined;
  }

  private buildBody(page: number): any {
    const body: any = { page, limit: this.pageSize };

    const start = this.formatDate(this.startDate);
    const end = this.formatDate(this.endDate);

    if (start) body.startDate = start;
    if (end) body.endDate = end;
    if (this.selectedUsers?.length) body.users = this.selectedUsers;
    if (this.searchText?.trim()) body.searchText = this.searchText.trim();

    return body;
  }

  /** Cargar usuarios */
  loadUsers(): void {
    this.apiService.getUsers('Medio').subscribe({
      next: (data) => (this.users = data),
      error: (err) => console.error('❌ Error al cargar usuarios:', err),
    });
  }

  /** Cambiar categoría desde el menú */
  onSelect(categoria: CategoryKey): void {
    this.activeCategory = categoria;
    this.loadByCategory(categoria, { resetPage: true }); // ✅ ya no returns
  }

  /** Filtrar (usa la categoría actual) */
  filtrar(): void {
    this.loadByCategory(this.activeCategory, { resetPage: true });
  }

  /** Limpiar filtros */
  limpiar(): void {
    this.startDate = undefined;
    this.endDate = undefined;
    this.selectedUsers = [];
    this.searchText = '';
    this.currentPage = 1;
    this.datos = [];
    this.error = '';
    this.hasMore = false;
  }

  /** Paginación */
  loadNextPage(): void {
    if (!this.hasMore || this.cargando) return;
    this.loadByCategory(this.activeCategory, { page: this.currentPage + 1 });
  }

  loadPreviousPage(): void {
    if (this.currentPage <= 1 || this.cargando) return;
    this.loadByCategory(this.activeCategory, { page: this.currentPage - 1 });
  }

  /** Carga genérica por categoría */
  private loadByCategory(
    categoria: CategoryKey,
    opts?: { page?: number; resetPage?: boolean }
  ): void {
    this.cargando = true;
    this.error = '';

    const page = opts?.resetPage ? 1 : (opts?.page ?? this.currentPage);
    const body = this.buildBody(page);
    console.log(this.startDate)
    const apiCall = this.categoryApiMap[categoria];

    apiCall(body).subscribe({
      next: (data: any) => {
        const resp: NewsResponse = {
          resultado: data.resultado || [],
          page: data.page ?? page,
        };

        this.datos = resp.resultado;
        this.currentPage = resp.page;

        // si el backend trae "hasMore" úsalo; si no, fallback:
        this.hasMore = data.hasMore ?? (this.datos.length === this.pageSize);
        this.cargando = false;
      },
      error: (err) => {
        console.error('❌ Error al obtener datos:', err);
        this.error = 'Error al cargar los datos';
        this.cargando = false;
      }
    });
  }

  /** Actualizar categoría de un tweet */
  accion(tweetId: string, newCategoria: string, oldCategoria: string): void {
    this.apiService
      .updateCategory({ idTweet: tweetId, newCategory: newCategoria, oldCategory: oldCategoria })
      .subscribe({
        next: (resp) => {
          console.log('✅ Categoría actualizada:', resp);
          // opcional: refrescar lista sin resetear página
          this.loadByCategory(this.activeCategory, { page: this.currentPage });
        },
        error: (err) => console.error('❌ Error al actualizar categoría:', err),
      });
  }

  

}
