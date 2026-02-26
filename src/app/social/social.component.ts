import { Component } from '@angular/core';
import { NewsData } from '../interfaces/NewsData';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { Dateformater } from '../utils/dateformater';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';

@Component({
  selector: 'app-social',
  templateUrl: './social.component.html',
  styleUrl: './social.component.css'
})
export class SocialComponent {

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

   repliesByTweet: Record<string, { negativo: number; neutro: number; positivo: number }> = {};
  loadingReplies: Record<string, boolean> = {};

   guardados = new Set<string>();
  savingIds = new Set<string>(); // para bloquear doble click
  errorGuardar = '';


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

      this.apiService.getNews(body).subscribe({
        next: (data: any) => {
          console.log(data);
          this.datos = data.resultado || [];
          this.currentPage = data.page;
          
          const tweetIds = this.datos.map(x => x.tweetid);
           
        
          this.apiService.getRepliesSummaryMany(tweetIds).subscribe({
          next: (rows: any[]) => {
            // Construir mapa tweetid -> counts
            const map: Record<string, { negativo: number; neutro: number; positivo: number }> = {};
            
            for (const r of rows || []) {
              const key = String(r.tweetid);
              
              if (!map[key]) map[key] = { negativo: 0, neutro: 0, positivo: 0 };

              if (r.sentimiento === 'negativo') map[key].negativo = r.total;
              if (r.sentimiento === 'neutro') map[key].neutro = r.total;
              if (r.sentimiento === 'positivo') map[key].positivo = r.total;
              
            }
            

            this.repliesByTweet = map;
          },
          error: (e) => console.error('❌ Error summary many:', e)
        });
          
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

getRepliesCounts(tweetid: string) {

  
  return this.repliesByTweet[tweetid] ?? { negativo: 0, neutro: 0, positivo: 0 };
}
toggleGuardar(item: any) {

    const id = item.tweetid.toString();
    console.log('Toggle guardar para ID:', id);
    if (this.savingIds.has(id)) return;

    this.errorGuardar = '';
    this.savingIds.add(id);

    // Si ya está guardado => DELETE
    if (this.guardados.has(id)) {
      this.apiService.borrarGuardado(id).subscribe({
        next: () => {
          this.guardados.delete(id);
          this.savingIds.delete(id);
        },
        error: (e) => {
          console.error('Error borrando guardado', e);
          this.errorGuardar = 'No se pudo quitar de guardados.';
          this.savingIds.delete(id);
        }
      });
      return;
    }

    // Si no está guardado => POST
    this.apiService.guardarTweet(id).subscribe({
      next: () => {
        this.guardados.add(id);
        this.savingIds.delete(id);
      },
      error: (e) => {
        console.error('Error guardando', e);
        this.errorGuardar = 'No se pudo guardar.';
        this.savingIds.delete(id);
      }
    });
  }

 cargarGuardados() {
  this.apiService.getGuardados().subscribe({
    next: (res) => {
      const rows = res.items ?? [];
      this.guardados = new Set(rows.map(r => String(r.tweetid)));
      console.log('Guardados cargados:', this.guardados);
    },
    error: (e) => console.error('Error cargando guardados', e)
  });
}

  isGuardado(tweetid: any): boolean {
    return this.guardados.has(tweetid.toString());
  }

  resetFiltros(){
  this.startDate = null as any;
  this.endDate = null as any;
  this.selectedUsers = [];
  this.searchText = '';
}





}
