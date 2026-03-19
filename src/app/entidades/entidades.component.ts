import { Component,OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { NewsData } from '../interfaces/NewsData';
import { Dateformater } from '../utils/dateformater';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import {linkifyText} from '../utils/helpers'
import { toPng } from 'html-to-image';

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
      selectedUsers: string[] = []; // 🔹 lista de IDs seleccionados

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
    this.apiService.getUsers2("Entidad").subscribe({
      next: (data) => {
        this.users = data;
        // Cargar noticias iniciales
        this.load(this.startDate, undefined, this.users.map(u => u.idTweetUser.toString()));
      },
      error: (error) => {
        console.error('❌ Error al cargar usuarios:', error);
      }
    });
  }
    
      
    
      /** Filtrar solo cuando se presiona el botón */
      filtrar(): void {
        let dateFormatted: Date | undefined = undefined;
        let dateFormattedEnd: Date | undefined = undefined;
    
      
        if (this.startDate) dateFormatted = this.startDate;
        if (this.endDate) dateFormattedEnd = this.endDate;
        this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, 1, this.searchText);
      }
      getFormattedDate(): string | undefined {
      if (this.startDate) {
        return new Dateformater().formatearFechaAyyyymmdd(this.startDate);
      }
      return undefined;
    }
    loadNextPage(): void {
        let dateFormatted: Date | undefined = undefined;
        let dateFormattedEnd: Date | undefined = undefined;
        console.log('Cargando página:', this.currentPage);
        if (this.startDate) dateFormatted = this.startDate;
        if (this.endDate) dateFormattedEnd = this.endDate;
        this.currentPage += 1;
        console.log('Página actualizada a:', this.currentPage);
        this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, this.currentPage, this.searchText);
      }
      loadPreviousPage(): void {
        let dateFormatted: Date | undefined = undefined;
        let dateFormattedEnd: Date | undefined = undefined;
        
        if (this.startDate) dateFormatted = this.startDate;
        if (this.endDate) dateFormattedEnd = this.endDate; 
        if (this.currentPage > 1) {
          this.currentPage -= 1;
          this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, this.currentPage, this.searchText);
        }
      }
    
      /** Cargar noticias — puede recibir o no filtros */
      load(startDate?: Date, endDate?: Date, users?: string[], page?:number, searchText?: string): void {
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
          if (users && users.length > 0) body.users = users; else body.users = this.users.map(u => u.idTweetUser.toString());
          if (searchText) body.searchText = searchText;
    
          this.apiService.getPostsEntidades(body).subscribe({
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


  resetFiltros() {
    this.startDate = null as any;
    this.endDate = null as any;
    this.selectedUsers = [];
    this.searchText = '';
  }
  formatText(text: string): string {
      return linkifyText(text);
    }

    async downloadCard(cardElement: HTMLElement, tweetId: string | number): Promise<void> {
      try {
        if (!cardElement) return;
    
        const dataUrl = await toPng(cardElement, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true
        });
    
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `tweet-${tweetId}.png`;
        link.click();
      } catch (error) {
        console.error('Error al descargar la imagen:', error);
      }
    }
    
  

  



}
