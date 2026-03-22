import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { user, users } from '../interfaces/users';

type ToastType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {

  users: users[] = [];
  selectedTipo: string = 'todos';

  // seguimos como strings (BIGINT safe)
  followingUsers = new Set<string>();

  cargando: boolean = false;

  user: user | null = null;

  // UI states
  searching = false;
  adding = false;

  // evita doble click por id
  followBusyIds = new Set<string>();

  // toast
  toast = {
    show: false,
    type: 'info' as ToastType,
    title: '',
    message: ''
  };
  private toastTimer: any = null;

  constructor(private apiService: ApiService) {}
 
  ngOnInit(): void {
    this.loadUsers('todos');

    this.apiService.getFollowedTweetUsers().subscribe({
      next: (res) => {
        const ids = (res?.rows || []).map((r: any) => String(r.tweetuser_id));
        this.followingUsers = new Set(ids);
        console.log(res)
      },
      error: (e) => {
        
        this.showToast('error', 'Error', 'No se pudo cargar la lista de seguidos.');
      }
    });
  }

  trackById = (_: number, u: users) => String(u.idTweetUser);

  showToast(type: ToastType, title: string, message: string, ms = 3200) {
    this.toast = { show: true, type, title, message };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), ms);
  }

  hideToast() {
    this.toast.show = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
  }

  // normaliza
  isFollowingTweetUser(tweetuserId: string | number): boolean {
    return this.followingUsers.has(String(tweetuserId));
  }

  toggleFollowTweetUser(tuId: string | number, label: string) {
    const id = String(tuId);
    if (this.followBusyIds.has(id)) return;

    const currently = this.isFollowingTweetUser(id);

    // confirmación
    const ok = currently
      ? confirm(`¿Dejar de seguir a "${label}" (ID ${id})?`)
      : confirm(`¿Seguir a "${label}" (ID ${id})?`);

    if (!ok) return;

    this.followBusyIds.add(id);

    // optimistic UI
    if (currently) this.followingUsers.delete(id);
    else this.followingUsers.add(id);

    const req$ = currently
      ? this.apiService.unfollowTweetUser(id)
      : this.apiService.followTweetUser(id);

    req$.subscribe({
      next: () => {
        this.followBusyIds.delete(id);
        if (currently) this.showToast('info', 'Listo', `Dejaste de seguir a ${label}.`);
        else this.showToast('success', 'Listo', `Ahora sigues a ${label}.`);
      },
      error: (e) => {
        
        // rollback
        if (currently) this.followingUsers.add(id);
        else this.followingUsers.delete(id);

        this.followBusyIds.delete(id);
        this.showToast('error', 'Error', 'No se pudo actualizar el seguimiento. Intenta de nuevo.');
      }
    });
  }

  loadUsers(tipo: string): void {
    this.cargando = true;
    this.apiService.getUsers(tipo).subscribe({
      next: (data) => {
        this.users = data || [];
        this.cargando = false;
      },
      error: (error) => {
        
        this.cargando = false;
        this.showToast('error', 'Error', 'No se pudo cargar la lista de usuarios.');
      }
    });
  }

  changeTipo(tipo: string) {
    this.selectedTipo = tipo;
    this.loadUsers(tipo);
  }

  filteredUsers(): users[] {
    if (this.selectedTipo === 'todos') return this.users;

    // prioridad: tipeUser si existe, sino tipo_cuenta si lo agregas luego, sino nameUser
    return this.users.filter(u => {
      const t = (u.tipeUser || (u as any).tipo_cuenta || u.nameUser || '').toLowerCase();
      return t === this.selectedTipo;
    });
  }

  buscar(userName: string, id: string): void {
    const nameTrim = (userName || '').trim();
    const idTrim = (id || '').trim();

    if (!nameTrim && !idTrim) {
      this.user = null;
      this.showToast('warning', 'Faltan datos', 'Escribe un nombre o un ID para buscar.');
      return;
    }

    this.searching = true;
    this.user = null;

    if (nameTrim) {
      this.apiService.searchbyname(nameTrim).subscribe({
        next: (data) => {
          this.searching = false;
          this.user = data || null;

          if (!this.user) {
            this.showToast('info', 'Sin resultados', 'No se encontró usuario con ese nombre.');
          } else {
            this.showToast('success', 'Encontrado', `Usuario @${this.user.username} listo para agregar.`);
          }
        },
        error: (error) => {
          
          this.searching = false;
          this.user = null;
          this.showToast('error', 'Error', 'Falló la búsqueda por nombre.');
        }
      });
      return;
    }

    // buscar por ID
    const numId = Number(idTrim);
    if (Number.isNaN(numId) || numId <= 0) {
      this.searching = false;
      this.showToast('warning', 'ID inválido', 'El ID debe ser numérico y mayor a 0.');
      return;
    }

    this.apiService.searchbyid(numId).subscribe({
      next: (data) => {
        this.searching = false;
        this.user = data || null;

        if (!this.user) {
          this.showToast('info', 'Sin resultados', 'No se encontró usuario con ese ID.');
        } else {
          this.showToast('success', 'Encontrado', `Usuario @${this.user.username} listo para agregar.`);
        }
      },
      error: (error) => {
        
        this.searching = false;
        this.user = null;
        this.showToast('error', 'Error', 'Falló la búsqueda por ID.');
      }
    });
  }

  cancelar(inputNombre?: HTMLInputElement, inputId?: HTMLInputElement): void {
    this.user = null;
    if (inputNombre) inputNombre.value = '';
    if (inputId) inputId.value = '';
    this.showToast('info', 'Listo', 'Formulario limpio.');
  }

  agregar(userName: string, id: string, name: string, tipo: string): void {
    if (this.adding) return;

    const username = (userName || '').trim();
    const tid = String(id || '').trim();
    const display = (name || '').trim();
    const tipoNorm = (tipo || '').trim().toLowerCase(); // medio/persona/entidad

    if (!username || !tid) {
      this.showToast('warning', 'Faltan datos', 'No hay usuario seleccionado para agregar.');
      return;
    }

    if (!tipoNorm) {
      this.showToast('warning', 'Clasificación requerida', 'Selecciona Medio / Persona / Entidad antes de agregar.');
      return;
    }

    // Evita agregar duplicado si ya está en la lista
    const exists = this.users.some(u => String(u.idTweetUser) === tid);
    if (exists) {
      this.showToast('info', 'Ya existe', `El usuario (ID ${tid}) ya está en tu sistema.`);
      return;
    }

    const ok = confirm(`¿Agregar @${username} (ID ${tid}) como "${tipoNorm}"?`);
    if (!ok) return;

    this.adding = true;

    const newUser: users = {
      idTweetUser: tid,
      TweetUser: username,
      nameUser: display,
      tipeUser: tipoNorm
    };

    this.apiService.addUser(newUser).subscribe({
      next: (_data) => {
        this.adding = false;
        this.showToast('success', 'Agregado', `Se agregó @${username} correctamente.`);

        // refresca lista según filtro actual
        this.loadUsers(this.selectedTipo);

        // limpia “usuario encontrado”
        this.user = null;
      },
      error: (error) => {
        
        this.adding = false;
        this.showToast('error', 'Error', 'No se pudo agregar el usuario. Revisa backend/duplicados.');
      }
    });
  }
}