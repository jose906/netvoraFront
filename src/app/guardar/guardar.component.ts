import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import { Observable } from 'rxjs';

type CategoryKey =
  | 'inicio' | 'politica' | 'economia' | 'seguridad' | 'deportes' | 'salud'
  | 'sociedad' | 'educacion' | 'gestion' | 'otros' | 'entidades' | 'personas' | 'ambiente';

interface SavedPostsResponse {
  ok: boolean;
  items: NewsItem[];
  limit: number;
  offset: number;
}

@Component({
  selector: 'app-guardar',
  templateUrl: './guardar.component.html',
  styleUrls: ['./guardar.component.css']   // ✅ era styleUrl
})
export class GuardarComponent implements OnInit {
  datos: NewsItem[] = [];
  cargando = false;
  error = '';

  // (Estos filtros todavía NO los soporta tu endpoint actual, por ahora los dejamos para UI)
  startDate: Date | undefined = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' })
  );
  endDate: Date | undefined;

  currentPage = 1;
  pageSize = 10;
  hasMore = false;

  searchText = '';
  users: users[] = [];
  selectedUsers: number[] = [];

   guardados = new Set<string>();
  savingIds = new Set<string>(); // para bloquear doble click
  errorGuardar = '';

  repliesByTweet: Record<string, { negativo: number; neutro: number; positivo: number }> = {};
  loadingReplies: Record<string, boolean> = {};


// Nota por tweetid
notesByTweet = new Map<string, string>();

// texto que el usuario escribe (draft)
noteDraft: Record<string, string> = {};

// estados (para deshabilitar botones mientras guarda)
savingNoteIds = new Set<string>();



  activeCategory: CategoryKey = 'inicio';

  private readonly categoryApiMap: Record<CategoryKey, (limit: number, offset: number) => Observable<SavedPostsResponse>> = {
    inicio: (limit, offset) => this.apiService.getGuardados(limit, offset),
    politica: (limit, offset) => this.apiService.getGuardados(limit, offset, 'politica'),
    economia: (limit, offset) => this.apiService.getGuardados(limit, offset, 'economia'),
    seguridad: (limit, offset) => this.apiService.getGuardados(limit, offset, 'seguridad'),
    deportes: (limit, offset) => this.apiService.getGuardados(limit, offset, 'deportes'),
    salud: (limit, offset) => this.apiService.getGuardados(limit, offset, 'salud'),
    sociedad: (limit, offset) => this.apiService.getGuardados(limit, offset, 'sociedad'),
    educacion: (limit, offset) => this.apiService.getGuardados(limit, offset, 'educacion'),
    gestion: (limit, offset) => this.apiService.getGuardados(limit, offset, 'gestion'),
    otros: (limit, offset) => this.apiService.getGuardados(limit, offset, 'otros'),
    entidades: (limit, offset) => this.apiService.getGuardados(limit, offset, 'entidades'),
    personas: (limit, offset) => this.apiService.getGuardados(limit, offset, 'personas'),
    ambiente: (limit, offset) => this.apiService.getGuardados(limit, offset, 'ambiente'),
  };

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadByCategory(this.activeCategory, { resetPage: true });
    
  }

  loadUsers(): void {
    this.apiService.getUsers('Medio').subscribe({
      next: (data) => (this.users = data),
      error: (err) => {},
    });
  }

  onSelect(categoria: CategoryKey): void {
    this.activeCategory = categoria;
    this.loadByCategory(categoria, { resetPage: true });
  }

  filtrar(): void {
    // ⚠️ tu endpoint actual NO filtra por fechas/users/searchText
    // si quieres, luego lo ampliamos en backend.
    this.loadByCategory(this.activeCategory, { resetPage: true });
  }

  limpiar(): void {
    this.startDate = undefined;
    this.endDate = undefined;
    this.selectedUsers = [];
    this.searchText = '';
    this.currentPage = 1;
    this.datos = [];
    this.error = '';
    this.hasMore = false;

    this.loadByCategory(this.activeCategory, { resetPage: true });
  }

  loadNextPage(): void {
    if (!this.hasMore || this.cargando) return;
    this.loadByCategory(this.activeCategory, { page: this.currentPage + 1 });
  }

  loadPreviousPage(): void {
    if (this.currentPage <= 1 || this.cargando) return;
    this.loadByCategory(this.activeCategory, { page: this.currentPage - 1 });
  }

  private loadByCategory(
    categoria: CategoryKey,
    opts?: { page?: number; resetPage?: boolean }
  ): void {
    this.cargando = true;
    this.error = '';
    
   
    const page = opts?.resetPage ? 1 : (opts?.page ?? this.currentPage);
    const offset = (page - 1) * this.pageSize;

    const apiCall = this.categoryApiMap[categoria];

    apiCall(this.pageSize, offset).subscribe({
      next: (data) => {
        this.datos = data.items || [];
        // ✅ inicializar notas (vienen en data.items desde ut.note)
this.notesByTweet.clear(); // opcional: para no mezclar páginas
// this.noteDraft = {};     // opcional: si quieres reset total por página

    for (const it of this.datos) {
      const id = this.tid(it.tweetid);
      const note = (it.note ?? '').toString();   // 👈 viene del backend
      this.notesByTweet.set(id, note);

      // solo setea draft si aún no existe (para no pisar lo que el usuario está escribiendo)
      if (this.noteDraft[id] === undefined) {
        this.noteDraft[id] = note;
      }
    }
        
        this.currentPage = page;
         this.guardados = new Set(
      this.datos.map(d => String(d.tweetid))
        );
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
          error: (e) => {}
        });
        this.hasMore = (this.datos.length === this.pageSize);
        this.cargando = false;
      },
      error: (err) => {
        
        this.error = 'Error al cargar los datos';
        this.cargando = false;
      }
    });
  }
  toggleGuardar(item: any) {

    const id = item.tweetid.toString();
    
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
      
      
    },
    error: (e) => {}
  });
}

  isGuardado(tweetid: any): boolean {
    return this.guardados.has(tweetid.toString());
  }

  getRepliesCounts(tweetid: string) {

  
  return this.repliesByTweet[tweetid] ?? { negativo: 0, neutro: 0, positivo: 0 };
}

private tid(tweetid: any): string {
  return tweetid?.toString?.() ?? String(tweetid);
}

hasNote(tweetid: any): boolean {
  const id = this.tid(tweetid);
  const saved = (this.notesByTweet.get(id) ?? '').trim();
  return saved.length > 0;
}

getNote(tweetid: any): string {
  return this.notesByTweet.get(this.tid(tweetid)) ?? '';
}

// ✅ Llamar esto después de cargar `datos`
cargarNotasDePagina() {
  const tweetids = this.datos.map(d => this.tid(d.tweetid));
  if (!tweetids.length) return;

  
}

// POST/PUT (upsert)
guardarNota(tweetid: any) {
  const id = this.tid(tweetid);
  const note = (this.noteDraft[id] ?? '').trim();
  if (!note) return;

  this.savingNoteIds.add(id);

  this.apiService.upsertNote(id, note).subscribe({
    next: (res) => {
      if (res?.ok) {
        this.notesByTweet.set(id, note);
        this.noteDraft[id] = note;
      }
      this.savingNoteIds.delete(id);
    },
    error: (e) => {
      
      this.savingNoteIds.delete(id);
    }
  });
}

borrarNota(tweetid: any) {
  const id = this.tid(tweetid);

  this.savingNoteIds.add(id);
  this.apiService.deleteNote(id).subscribe({
    next: (res) => {
      if (res?.ok) {
        this.notesByTweet.set(id, '');
        this.noteDraft[id] = '';
      }
      this.savingNoteIds.delete(id);
    },
    error: (e) => {
    
      this.savingNoteIds.delete(id);
    }
  });
}

// útil para deshabilitar el botón "Modificar" si no cambió nada
noteChanged(tweetid: any): boolean {
  const id = this.tid(tweetid);
  return (this.noteDraft[id] ?? '').trim() !== (this.notesByTweet.get(id) ?? '').trim();
}
// Control de apertura por tweet
openNotes = new Set<string>();

toggleNote(tweetid: any) {
  const id = tweetid.toString();
  if (this.openNotes.has(id)) {
    this.openNotes.delete(id);
  } else {
    this.openNotes.add(id);
  }
}

isNoteOpen(tweetid: any): boolean {
  return this.openNotes.has(tweetid.toString());
}


}