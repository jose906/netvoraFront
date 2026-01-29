import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { NewsData } from '../interfaces/NewsData';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import { Dateformater } from '../utils/dateformater';

// ajusta la ruta a tu interfaz

@Component({
  selector: 'app-personas',
  templateUrl: './personas.component.html',
  styleUrl: './personas.component.css'
})
export class PersonasComponent implements OnInit {

  datos: NewsItem[] = [];
    newsData: NewsData[] = [];
    cargando: boolean = false;
    error: string = '';
    startDate: Date | undefined = new Date(); // 🔹 Puede no tener fecha
    endDate: Date | undefined ; // 🔹 Puede no tener fecha
    hoy: Date = new Date();
    currentPage: number = 1;
    pageSize: number = 10;  // cantidad de resultados por página
    hasMore: boolean = false;
  
  
    users: users[] = [];
    selectedUsers: number[] = []; // 🔹 lista de IDs seleccionados
  
    constructor(
      private apiService: ApiService,
      private router: Router
    ) {}
  
    ngOnInit(): void {
      this.loadUsers();
       // 🔹 Cargar todas las noticias sin filtros al inicio
       
    }
  
    /** Cargar usuarios */
    loadUsers(): void {
      this.apiService.getUsers("Persona").subscribe({
        next: (data) => {
          this.users = data;
          this.load(this.startDate?.toISOString().split('T')[0]); // Cargar noticias después de obtener los usuarios
        },
        error: (error) => {
          console.error('❌ Error al cargar usuarios:', error);
        }
      });
    }
  
    /** Filtrar solo cuando se presiona el botón */
    filtrar(): void {
      let dateFormatted: string | undefined = undefined;
      let dateFormattedEnd: string | undefined = undefined;
  
    
      if (this.startDate) dateFormatted = this.startDate.toISOString().split('T')[0];
      if (this.endDate) dateFormattedEnd = this.endDate.toISOString().split('T')[0];
      this.load(dateFormatted, dateFormattedEnd, this.selectedUsers);
    }
    getFormattedDate(): string | undefined {
    if (this.startDate) {
      return new Dateformater().formatearFechaAyyyymmdd(this.startDate);
    }
    return undefined;
  }
  
  
    /** Cargar noticias — puede recibir o no filtros */
    load(startDate?: string, endDate?: string, users?: number[], page: number = 1): void {
        this.cargando = true;
        this.error = '';
        this.datos = [];
  
        const body: any = {
          page: page,
          limit: this.pageSize
        };
  
  
        if (startDate) body.startDate = startDate;
        if (endDate) body.endDate = endDate;
        if (users && users.length > 0) body.users = users;
  
        this.apiService.getPostPer(body).subscribe({
          next: (data: any) => {
            this.datos = data.resultado || [];
            this.currentPage = data.page;
            this.hasMore = this.datos.length === this.pageSize;
            this.cargando = false;
          },
          error: (error) => {
            console.error('❌ Error al obtener datos:', error);
            this.error = 'Error al cargar los datos';
            this.cargando = false;
          }
        });
  }
  
  
    /** Navegar al detalle */
    irADetalle(datos: NewsItem): void {
      this.router.navigate(['/resumen'], { state: { datos } });
    }
      private normCat(cat?: string): string {
  return (cat || 'otros')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .trim();
}

categoryClass(cat?: string): string {
  const c = this.normCat(cat);

  if (c.includes('econom')) return 'cat-economia';
  if (c.includes('polit')) return 'cat-politica';
  if (c.includes('segur')) return 'cat-seguridad';
  if (c.includes('deport')) return 'cat-deportes';
  if (c.includes('educ')) return 'cat-educacion';
  if (c.includes('salud')) return 'cat-salud';
  if (c.includes('socied')) return 'cat-sociedad';

  return 'cat-otros';
}

categoryIcon(cat?: string): string {
  const c = this.normCat(cat);

  if (c.includes('econom')) return '💰';
  if (c.includes('polit')) return '🏛️';
  if (c.includes('segur')) return '🛡️';
  if (c.includes('deport')) return '🏅';
  if (c.includes('educ')) return '🎓';
  if (c.includes('salud')) return '🩺';
  if (c.includes('socied')) return '👥';

  return '🧩';
}
    

}
