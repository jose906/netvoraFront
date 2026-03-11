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
  | 'social'
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

  startDate: Date | null = new Date();
  endDate: Date | null = null;

  users: users[] = [];
  selectedUsers: string[] = [];
  searchText = '';

  loadingUsers = false;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.goToView('todos', 'Panel principal', 'todos');
  }

  /**
   * Método único para cambiar de vista.
   * Aquí centralizas:
   * - componente
   * - etiqueta visible
   * - tipo de usuarios a cargar
   * - limpieza de selección previa
   */
  goToView(
    component: VistaDashboard,
    categoriaLabel: string,
    tipo: TipoCuenta = 'Medio'
  ): void {
    this.selectedComponent = component;
    this.selectedCategoria = categoriaLabel;

    // limpiamos selección manual porque puede venir de otro tipo de dashboard
    this.selectedUsers = [];

    // opcional: limpiar búsqueda al cambiar de dashboard
    // this.searchText = '';

    this.loadUsers(tipo);
  }

  /**
   * Carga solo el combo de usuarios.
   */
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
        console.log('✅ Usuarios cargados:', this.users);
      },
      error: (error) => {
        this.loadingUsers = false;
        this.users = [];
        console.error('❌ Error al cargar usuarios:', error);
      },
    });
  }

  /**
   * El botón aplicar NO necesita llamar manualmente al hijo
   * porque los hijos ya recargan con ngOnChanges.
   * Solo validamos y forzamos cambio de referencia si hace falta.
   */
  aplicarFechas(): void {
    if (!this.startDate) {
      console.warn('⚠ Debes seleccionar una fecha de inicio.');
      return;
    }

    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      console.warn('⚠ La fecha inicio no puede ser mayor que la fecha fin.');
      return;
    }

    // Fuerza nueva referencia para disparar ngOnChanges en hijos si Angular no detecta cambio
    this.startDate = this.startDate ? new Date(this.startDate) : null;
    this.endDate = this.endDate ? new Date(this.endDate) : null;
    this.selectedUsers = [...this.selectedUsers];
    this.searchText = `${this.searchText}`;
  }

  resetFiltros(): void {
    this.startDate = new Date();
    this.endDate = null;
    this.selectedUsers = [];
    this.searchText = '';
  }

  trackByUserId = (_: number, user: users) => user.idTweetUser;
}