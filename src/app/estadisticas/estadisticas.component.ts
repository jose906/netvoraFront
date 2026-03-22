import {
  Component,
  OnInit
} from '@angular/core';

import { users } from '../interfaces/users';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';

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

@Component({
  selector: 'app-estadisticas',
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.css'
})
export class EstadisticasComponent implements OnInit {
  selectedComponent: VistaDashboard = 'todos';
  selectedCategoria = 'Panel principal';

  // =========================
  // FILTROS DEL FORMULARIO
  // =========================
  filterStartDate: Date | null = new Date();
  filterEndDate: Date | null = null;
  filterSelectedUsers: string[] = [];
  filterSearchText = '';

  // =========================
  // FILTROS APLICADOS
  // SOLO ESTOS SE MANDAN A LOS HIJOS
  // =========================
  appliedStartDate: Date | null = new Date();
  appliedEndDate: Date | null = null;
  appliedSelectedUsers: string[] = [];
  appliedSearchText = '';

  users: users[] = [];
  loadingUsers = false;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.goToView('todos', 'Panel principal', 'todos');
  }

  goToView(
    component: VistaDashboard,
    categoriaLabel: string,
    tipo: TipoCuenta = 'Medio'
  ): void {
    this.selectedComponent = component;
    this.selectedCategoria = categoriaLabel;

    // ✅ resetear filtros al cambiar de categoría
    this.resetFiltrosInterno();

    // ✅ como cambió la vista, también actualizamos los filtros aplicados
    this.syncAppliedFilters();

    // ✅ cargar usuarios del nuevo tipo
    this.loadUsers(tipo);
  }

  loadUsers(tipo: TipoCuenta): void {
    let tipoFinal: TipoCuenta = tipo;

    if (!['todos', 'Medio', 'Entidad', 'Persona'].includes(tipo)) {
      tipoFinal = 'Medio';
    }

    this.loadingUsers = true;

    this.apiService.getUsers2(tipoFinal).subscribe({
      next: (data) => {
        this.users = data || [];
        this.loadingUsers = false;
        
      },
      error: (error) => {
        this.loadingUsers = false;
        this.users = [];
        
      },
    });
  }

  aplicarFechas(): void {
    if (!this.filterStartDate) {
      
      return;
    }

    if (this.filterStartDate && this.filterEndDate && this.filterStartDate > this.filterEndDate) {
      
      return;
    }

    // ✅ solo aquí se disparan cambios hacia los hijos
    this.syncAppliedFilters();
  }

  resetFiltros(): void {
    // limpia formulario
    this.resetFiltrosInterno();

    // si quieres que "Limpiar" también recargue automáticamente:
    this.syncAppliedFilters();

    // si NO quieres recargar con el botón limpiar,
    // comenta la línea anterior.
  }

  private resetFiltrosInterno(): void {
    this.filterStartDate = new Date();
    this.filterEndDate = null;
    this.filterSelectedUsers = [];
    this.filterSearchText = '';
  }

  private syncAppliedFilters(): void {
    // ✅ nuevas referencias para disparar ngOnChanges solo al aplicar
    this.appliedStartDate = this.filterStartDate ? new Date(this.filterStartDate) : null;
    this.appliedEndDate = this.filterEndDate ? new Date(this.filterEndDate) : null;
    this.appliedSelectedUsers = [...this.filterSelectedUsers];
    this.appliedSearchText = `${this.filterSearchText}`;
  }

  trackByUserId = (_: number, user: users) => user.idTweetUser;
}