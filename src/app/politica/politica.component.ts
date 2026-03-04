import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { NewsData } from '../interfaces/NewsData';
import { Dateformater } from '../utils/dateformater';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';

@Component({
  selector: 'app-politica',
  templateUrl: './politica.component.html',
  styleUrls: ['./politica.component.css']
})
export class PoliticaComponent implements OnInit {

  datos: NewsItem[] = [];
  newsData: NewsData[] = [];
  cargando: boolean = false;
  error: string = '';
  startDate: Date | undefined = new Date();
  endDate: Date | undefined;

  currentPage: number = 1;
  pageSize: number = 10;
  hasMore: boolean = false;

  searchText: string = '';
  users: users[] = [];
  selectedUsers: string[] = [];

  repliesByTweet: Record<string, { negativo: number; neutro: number; positivo: number }> = {};
  loadingReplies: Record<string, boolean> = {};

  // Guardados
  guardados = new Set<string>();
  savingIds = new Set<string>();
  errorGuardar = '';

  // Notas (traídas desde saved_posts_map)
  notesByTweet = new Map<string, string>();
  noteDraft: Record<string, string> = {};
  savingNoteIds = new Set<string>();

  // UI expandible de nota
  openNotes = new Set<string>();

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    // hydrateSavedState() se llama después de cargar feed en load()
  }

  /** Cargar usuarios */
  loadUsers(): void {
    this.apiService.getUsers2("Medio").subscribe({
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
    if (!this.hasMore || this.cargando) return;

    let dateFormatted: Date | undefined = undefined;
    let dateFormattedEnd: Date | undefined = undefined;

    if (this.startDate) dateFormatted = this.startDate;
    if (this.endDate) dateFormattedEnd = this.endDate;

    this.currentPage += 1;
    
  
    this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, this.currentPage, this.searchText);
  
  }

  loadPreviousPage(): void {
    if (this.currentPage <= 1 || this.cargando) return;

    let dateFormatted: Date | undefined = undefined;
    let dateFormattedEnd: Date | undefined = undefined;

    if (this.startDate) dateFormatted = this.startDate;
    if (this.endDate) dateFormattedEnd = this.endDate;

    this.currentPage -= 1;
    this.load(dateFormatted, dateFormattedEnd, this.selectedUsers, this.currentPage, this.searchText);
  }

  /** Cargar noticias — puede recibir o no filtros */
  load(startDate?: Date, endDate?: Date, users?: string[], page?: number, searchText?: string): void {
    this.cargando = true;
    this.error = '';

    const pageToLoad = page ?? this.currentPage;

    const body: any = {
      page: pageToLoad,
      limit: this.pageSize
    };

    if (startDate) body.startDate = startDate;
    if (endDate) body.endDate = endDate;
    if (users && users.length > 0) body.users = users; else body.users = this.users.map(u => u.idTweetUser.toString());
    if (searchText) body.searchText = searchText;

    console.log('Cargando con filtros:', body);

    this.apiService.getNews(body).subscribe({
      next: (data: any) => {
        this.datos = data.resultado || [];
        this.currentPage = data.page ?? pageToLoad;

        // 1) Resumen de replies por tweet
        const tweetIds = (this.datos || []).map(x => x.tweetid);
        this.apiService.getRepliesSummaryMany(tweetIds).subscribe({
          next: (rows: any[]) => {
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

        // 2) Hidratar guardados + notas (lookup global)
        //    Esto marca el botón "Guardado" y precarga notas si existen
        this.hydrateSavedState();

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

  toLocalYMD(date: Date): string {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Helpers tweetid -> string estable */
  private tid(tweetid: any): string {
    return tweetid?.toString?.() ?? String(tweetid);
  }

  /** Cargar mapa de guardados+nota del usuario (endpoint nuevo saved_posts_map) */
  private hydrateSavedState(category?: string) {
    this.apiService.getSavedMap(category).subscribe({
      next: (res: any) => {
        if (!res?.ok) return;

        const saved = res.saved || {};

        // Set para marcar guardados
        this.guardados = new Set(Object.keys(saved));

        // Notas
        this.notesByTweet.clear();

        for (const tid of Object.keys(saved)) {
          const note = (saved[tid]?.note ?? '').toString();
          this.notesByTweet.set(tid, note);

          // no pisar lo que el usuario está escribiendo
          if (this.noteDraft[tid] === undefined) {
            this.noteDraft[tid] = note;
          }
        }
      },
      error: (e: any) => console.error('❌ saved map error', e)
    });
  }

  getRepliesCounts(tweetid: string) {
    return this.repliesByTweet[String(tweetid)] ?? { negativo: 0, neutro: 0, positivo: 0 };
  }

  // =========================
  // Guardar / Desguardar
  // =========================
  toggleGuardar(item: any) {
    const id = this.tid(item.tweetid);
    if (this.savingIds.has(id)) return;

    this.errorGuardar = '';
    this.savingIds.add(id);

    // Si ya está guardado => DELETE
    if (this.guardados.has(id)) {
      this.apiService.borrarGuardado(id).subscribe({
        next: () => {
          this.guardados.delete(id);
          // también limpiar nota local si quieres
          this.notesByTweet.set(id, '');
          this.noteDraft[id] = '';
          this.savingIds.delete(id);
        },
        error: (e: any) => {
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
        // opcional: abrir nota automáticamente
        // this.openNotes.add(id);
        this.savingIds.delete(id);
      },
      error: (e: any) => {
        console.error('Error guardando', e);
        this.errorGuardar = 'No se pudo guardar.';
        this.savingIds.delete(id);
      }
    });
  }

  isGuardado(tweetid: any): boolean {
    return this.guardados.has(this.tid(tweetid));
  }

  // =========================
  // Notas (requiere tus endpoints upsertNote/deleteNote)
  // =========================
  hasNote(tweetid: any): boolean {
    const id = this.tid(tweetid);
    const saved = (this.notesByTweet.get(id) ?? '').trim();
    return saved.length > 0;
  }

  getNote(tweetid: any): string {
    return this.notesByTweet.get(this.tid(tweetid)) ?? '';
  }

  noteChanged(tweetid: any): boolean {
    const id = this.tid(tweetid);
    return (this.noteDraft[id] ?? '').trim() !== (this.notesByTweet.get(id) ?? '').trim();
  }

  guardarNota(tweetid: any) {
    const id = this.tid(tweetid);

    // (opcional) si no está guardado, no permitir nota
    if (!this.guardados.has(id)) {
      this.errorGuardar = 'Guarda el post primero para agregar una nota.';
      return;
    }

    const note = (this.noteDraft[id] ?? '').trim();
    if (!note) return;

    this.savingNoteIds.add(id);

    this.apiService.upsertNote(id, note).subscribe({
      next: (res: any) => {
        if (res?.ok) {
          this.notesByTweet.set(id, note);
          this.noteDraft[id] = note;
        }
        this.savingNoteIds.delete(id);
      },
      error: (e: any) => {
        console.error('Error guardando nota', e);
        this.savingNoteIds.delete(id);
      }
    });
  }

  borrarNota(tweetid: any) {
    const id = this.tid(tweetid);

    this.savingNoteIds.add(id);
    this.apiService.deleteNote(id).subscribe({
      next: (res: any) => {
        if (res?.ok) {
          this.notesByTweet.set(id, '');
          this.noteDraft[id] = '';
        }
        this.savingNoteIds.delete(id);
      },
      error: (e: any) => {
        console.error('Error borrando nota', e);
        this.savingNoteIds.delete(id);
      }
    });
  }

  // =========================
  // UI Nota expandible
  // =========================
  toggleNote(tweetid: any) {
    const id = this.tid(tweetid);
    if (this.openNotes.has(id)) this.openNotes.delete(id);
    else this.openNotes.add(id);
  }

  isNoteOpen(tweetid: any): boolean {
    return this.openNotes.has(this.tid(tweetid));
  }

  // =========================
  // Reset filtros
  // =========================
  resetFiltros() {
    this.startDate = undefined;
    this.endDate = undefined;
    this.selectedUsers = [];
    this.searchText = '';
    this.currentPage = 1;
    this.load(); // recargar sin filtros
  }
}