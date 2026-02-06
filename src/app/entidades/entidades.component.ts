import { Component,OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { NewsData } from '../interfaces/NewsData';
import { Dateformater } from '../utils/dateformater';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';

@Component({
  selector: 'app-entidades',
  templateUrl: './entidades.component.html',
  styleUrl: './entidades.component.css'
})
export class EntidadesComponent  implements OnInit {
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
        this.apiService.getUsers("Entidad").subscribe({
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
        console.log('Cargando página:', this.currentPage);
        if (this.startDate) dateFormatted = this.startDate.toISOString().split('T')[0];
        if (this.endDate) dateFormattedEnd = this.endDate.toISOString().split('T')[0];
        this.currentPage += 1;
        console.log('Página actualizada a:', this.currentPage);
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
          
          const pageToLoad = page ?? this.currentPage;
    
          const body: any = {
            page: pageToLoad,
            limit: this.pageSize
          };
    
    
          if (startDate) body.startDate = startDate;
          if (endDate) body.endDate = endDate;
          if (users && users.length > 0) body.users = users;
          if (searchText) body.searchText = searchText;
    
          this.apiService.getPostsEntidades(body).subscribe({
            next: (data: any) => {
              console.log(data);
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
