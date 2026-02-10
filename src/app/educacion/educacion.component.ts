import { Component,OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { NewsData } from '../interfaces/NewsData';
import { Dateformater } from '../utils/dateformater';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';

@Component({
  selector: 'app-educacion',
  templateUrl: './educacion.component.html',
  styleUrl: './educacion.component.css'
})
export class EducacionComponent implements OnInit {
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
  
    searchText: string = ''; // 🔹 texto de búsqueda
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
      this.apiService.getUsers("Medio").subscribe({
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
      this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, 1, this.searchText);
    }
    getFormattedDate(): string | undefined {
    if (this.startDate) {
      return new Dateformater().formatearFechaAyyyymmdd(this.startDate);
    }
    return undefined;
  }
  loadNextPage(): void {
      let dateFormatted: string | undefined = undefined;
      let dateFormattedEnd: string | undefined = undefined;
  
      if (this.startDate) dateFormatted = this.startDate.toISOString().split('T')[0];
      if (this.endDate) dateFormattedEnd = this.endDate.toISOString().split('T')[0];
      this.currentPage += 1;
      this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, this.currentPage, this.searchText);
    }
    loadPreviousPage(): void {
      let dateFormatted: string | undefined = undefined;
      let dateFormattedEnd: string | undefined = undefined;
      
      if (this.startDate) dateFormatted = this.startDate.toISOString().split('T')[0];
      if (this.endDate) dateFormattedEnd = this.endDate.toISOString().split('T')[0]; 
      if (this.currentPage > 1) {
        this.currentPage -= 1;
        this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, this.currentPage, this.searchText);
      }
    }
  
    /** Cargar noticias — puede recibir o no filtros */
    load(startDate?: string, endDate?: string, users?: number[], page?:number, searchText?: string): void {
        this.cargando = true;
        this.error = '';
        this.datos = [];
  
        const body: any = {
          page: page,
          limit: this.pageSize
        };
  
  
        if (startDate) body.startDate = this.toLocalYMD(new Date(startDate));
        if (endDate) body.endDate = endDate;
        if (users && users.length > 0) body.users = users;
        if (searchText) body.searchText = searchText;
  
        this.apiService.getPostsEduca(body).subscribe({
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
  guardarClasificacion(tweetid: number, categoria: string, sentimiento: string): void {
   
    
  
  }
  
    /** Navegar al detalle */
    irADetalle(datos: NewsItem): void {
      this.router.navigate(['/resumen'], { state: { datos } });
    }
    toLocalYMD(date: Date): string {
  // reconstruye la fecha usando componentes locales (evita desfase)
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
    




}
