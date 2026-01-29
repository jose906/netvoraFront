import { Component, ViewChild,ViewChildren, QueryList, AfterViewInit, OnInit } from '@angular/core';
import { TodosComponent } from '../data/todos/todos.component';
import { PoliticaEstadisticasComponent } from '../data/politica-estadisticas/politica-estadisticas.component';
import { users } from '../interfaces/users';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { EstadisticasEntiPersonasComponent } from '../data/estadisticas-enti-personas/estadisticas-enti-personas.component';

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
  selectedUsers: number[] = [];

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
    this.apiService.getUsers('todos').subscribe({
      next: (data) => {
        this.users = data;
        // ❌ ya NO llames cargarDatos aquí
      },
      error: (error) => console.error('❌ Error al cargar usuarios:', error),
    });
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
}



