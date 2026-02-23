import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import { Observable } from 'rxjs';

type CategoryKey =
  | 'inicio' | 'politica' | 'economia' | 'seguridad' | 'deportes' | 'salud'
  | 'sociedad' | 'educacion' | 'gestion' | 'otros' | 'entidades' | 'personas' | 'ambiente';

interface SavedPostsResponse {
  ok: boolean;
  items: NewsItem[];
  limit: number;
  offset: number;
}

@Component({
  selector: 'app-guardar',
  templateUrl: './guardar.component.html',
  styleUrls: ['./guardar.component.css']   // ✅ era styleUrl
})
export class GuardarComponent implements OnInit {
  datos: NewsItem[] = [];
  cargando = false;
  error = '';

  // (Estos filtros todavía NO los soporta tu endpoint actual, por ahora los dejamos para UI)
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

  activeCategory: CategoryKey = 'inicio';

  private readonly categoryApiMap: Record<CategoryKey, (limit: number, offset: number) => Observable<SavedPostsResponse>> = {
    inicio: (limit, offset) => this.apiService.getGuardados(limit, offset),
    politica: (limit, offset) => this.apiService.getGuardados(limit, offset, 'politica'),
    economia: (limit, offset) => this.apiService.getGuardados(limit, offset, 'economia'),
    seguridad: (limit, offset) => this.apiService.getGuardados(limit, offset, 'seguridad'),
    deportes: (limit, offset) => this.apiService.getGuardados(limit, offset, 'deportes'),
    salud: (limit, offset) => this.apiService.getGuardados(limit, offset, 'salud'),
    sociedad: (limit, offset) => this.apiService.getGuardados(limit, offset, 'sociedad'),
    educacion: (limit, offset) => this.apiService.getGuardados(limit, offset, 'educacion'),
    gestion: (limit, offset) => this.apiService.getGuardados(limit, offset, 'gestion'),
    otros: (limit, offset) => this.apiService.getGuardados(limit, offset, 'otros'),
    entidades: (limit, offset) => this.apiService.getGuardados(limit, offset, 'entidades'),
    personas: (limit, offset) => this.apiService.getGuardados(limit, offset, 'personas'),
    ambiente: (limit, offset) => this.apiService.getGuardados(limit, offset, 'ambiente'),
  };

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadByCategory(this.activeCategory, { resetPage: true });
  }

  loadUsers(): void {
    this.apiService.getUsers('Medio').subscribe({
      next: (data) => (this.users = data),
      error: (err) => console.error('❌ Error al cargar usuarios:', err),
    });
  }

  onSelect(categoria: CategoryKey): void {
    this.activeCategory = categoria;
    this.loadByCategory(categoria, { resetPage: true });
  }

  filtrar(): void {
    // ⚠️ tu endpoint actual NO filtra por fechas/users/searchText
    // si quieres, luego lo ampliamos en backend.
    this.loadByCategory(this.activeCategory, { resetPage: true });
  }

  limpiar(): void {
    this.startDate = undefined;
    this.endDate = undefined;
    this.selectedUsers = [];
    this.searchText = '';
    this.currentPage = 1;
    this.datos = [];
    this.error = '';
    this.hasMore = false;

    this.loadByCategory(this.activeCategory, { resetPage: true });
  }

  loadNextPage(): void {
    if (!this.hasMore || this.cargando) return;
    this.loadByCategory(this.activeCategory, { page: this.currentPage + 1 });
  }

  loadPreviousPage(): void {
    if (this.currentPage <= 1 || this.cargando) return;
    this.loadByCategory(this.activeCategory, { page: this.currentPage - 1 });
  }

  private loadByCategory(
    categoria: CategoryKey,
    opts?: { page?: number; resetPage?: boolean }
  ): void {
    this.cargando = true;
    this.error = '';

    const page = opts?.resetPage ? 1 : (opts?.page ?? this.currentPage);
    const offset = (page - 1) * this.pageSize;

    const apiCall = this.categoryApiMap[categoria];

    apiCall(this.pageSize, offset).subscribe({
      next: (data) => {
        this.datos = data.items || [];
        this.currentPage = page;
        this.hasMore = (this.datos.length === this.pageSize);
        this.cargando = false;
      },
      error: (err) => {
        console.error('❌ Error al obtener guardados:', err);
        this.error = 'Error al cargar los datos';
        this.cargando = false;
      }
    });
  }
}