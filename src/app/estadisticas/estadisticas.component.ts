import { Component, ViewChild,ViewChildren, QueryList, AfterViewInit, OnInit } from '@angular/core';
import { TodosComponent } from '../data/todos/todos.component';
import { PoliticaEstadisticasComponent } from '../data/politica-estadisticas/politica-estadisticas.component';
import { users } from '../interfaces/users';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { EstadisticasEntiPersonasComponent } from '../data/estadisticas-enti-personas/estadisticas-enti-personas.component';
import e from 'express';

@Component({
  selector: 'app-estadisticas',
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.css'
})


export class EstadisticasComponent implements OnInit, AfterViewInit {
  @ViewChild(TodosComponent) todosComponent!: TodosComponent;

  @ViewChildren(PoliticaEstadisticasComponent)
  politicaComponents!: QueryList<PoliticaEstadisticasComponent>;

  @ViewChildren(EstadisticasEntiPersonasComponent)
  entiPersonasComponents!: QueryList<EstadisticasEntiPersonasComponent>;

  selectedComponent: string = 'todos';

  startDate: Date | null = new Date();
  endDate: Date | null = null;

  users: users[] = [];
  selectedUsers: string[] = [];
  searchText: string = ''; 

  private didInitialLoad = false;

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadUsers(); // solo carga el combo, no dispara dashboard
  }

  ngAfterViewInit(): void {
    // ✅ primer load automático al entrar
    queueMicrotask(() => {
      this.initialLoadCurrentComponent();
    });
  }

  private initialLoadCurrentComponent(): void {
    if (this.didInitialLoad) return;
    this.didInitialLoad = true;

    // 🔥 aquí disparas la carga SIN apretar "Aplicar"
    this.reloadSelectedComponent();
  }

  private reloadSelectedComponent(): void {
    if (this.selectedComponent === 'todos') {
      console.log('Cargando datos para TODOS con usuarios:', this.users);
      this.todosComponent?.cargarDatos();
      return;
    }

    if (this.selectedComponent === 'entidades' || this.selectedComponent === 'personas') {
      const ep = this.getEntiPersonaCompByCategoria(this.selectedComponent);
      ep?.cargarDatos?.();
      return;
    }

    const comp = this.getPoliticaCompByCategoria(this.selectedComponent);
    comp?.cargarDatos();
  }

  cambiarGrafico(componente: string) {
    this.selectedComponent = componente;

    queueMicrotask(() => {
      // ✅ cuando cambias de vista, si ya hay startDate, carga automático también
      this.reloadSelectedComponent();
    });
  }

  loadUsers(): void {
  var tipo = this.mapSelectedToTipo(this.selectedComponent);

  if (tipo !== 'todos' && tipo !== 'Entidad' && tipo !== 'Persona') {
    
    tipo = 'Medio'; // fallback si el mapping falla por alguna razón
  
  }

  this.apiService.getUsers2(tipo).subscribe({
    next: (data) => {
      this.users = data;
      console.log('Usuarios cargados:', this.users);
    },
    error: (error) => console.error('❌ Error al cargar usuarios:', error),
  });
}

private mapSelectedToTipo(selected: string): string {
  const map: Record<string, string> = {
    todos: 'todos',
    entidades: 'Entidad',
    personas: 'Persona',
    medios: 'Medio', // si tenés esta opción en el UI
  };

  return map[selected] ?? 'Medio'; // fallback
}
  aplicarFechas() {
    // Si quieres permitir aplicar manual SOLO cuando el usuario define endDate:
    // (o deja tu lógica actual)
    if (!this.startDate) {
      console.warn('⚠ Debes seleccionar startDate.');
      return;
    }
    this.reloadSelectedComponent();
  }

  private getPoliticaCompByCategoria(categoria: string) {
    return this.politicaComponents?.toArray().find(c => (c as any)?.categoria === categoria);
  }

  private getEntiPersonaCompByCategoria(categoria: string) {
    return this.entiPersonasComponents?.toArray().find(c => (c as any)?.categoria === categoria);
  }
  navQuery = '';

navItems = [
  { key: 'politica',   label: 'Política',         icon: 'account_balance' },
  { key: 'economia',   label: 'Economía',         icon: 'payments' },
  { key: 'deportes',   label: 'Deportes',         icon: 'sports_soccer' },
  { key: 'seguridad',  label: 'Seguridad',        icon: 'shield' },
  { key: 'social',     label: 'Sociedad',         icon: 'groups' },
  { key: 'salud',      label: 'Salud',            icon: 'favorite' },
  { key: 'educacion',  label: 'Educación',        icon: 'school' },
  { key: 'ambiente',   label: 'Medio Ambiente',   icon: 'eco' },
  { key: 'gestiones',  label: 'Gestiones',        icon: 'apartment' },
  { key: 'otros',      label: 'Otros',            icon: 'layers' },
  { key: 'entidades',  label: 'Entidades',        icon: 'domain' },
  { key: 'personas',   label: 'Personas',         icon: 'badge' },
];

get navItemsFiltered() {
  const q = (this.navQuery || '').trim().toLowerCase();
  if (!q) return this.navItems;
  return this.navItems.filter(x =>
    (x.label || '').toLowerCase().includes(q) ||
    (x.key || '').toLowerCase().includes(q)
  );
}

resetFiltros(){
  this.startDate = null as any;
  this.endDate = null as any;
  this.selectedUsers = [];
}

}



