import { Component, OnInit } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthzService } from '../services/authz.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit {

  // ✅ Streams para el footer
  userEmail$: Observable<string>;
  userDisplayName$: Observable<string>;
  userInitial$: Observable<string>;

  constructor(
    private authService: AuthService,
    public authz: AuthzService,
    private router: Router
  ) {
    // 🔹 Ajusta esto según tu AuthService:
    // Idea: que authService exponga algo como `user$` (Firebase user) o `currentUser$`.
    const user$ = (this.authService as any).user$ as Observable<any> | undefined;

    if (!user$) {
      // fallback si no existe user$ (no rompe el menú)
      this.userEmail$ = of('');
      this.userDisplayName$ = of('');
      this.userInitial$ = of('U');
    } else {
      this.userEmail$ = user$.pipe(map(u => (u?.email || '').toString()));
      this.userDisplayName$ = user$.pipe(
        map(u => (u?.displayName || u?.email || 'Usuario').toString())
      );
      this.userInitial$ = this.userDisplayName$.pipe(
        map(name => (name?.trim()?.[0] || 'U').toUpperCase())
      );
    }
  }

  async ngOnInit() {
    // ✅ Si tu AuthzService necesita cargar role desde backend (/api/auth/me), hazlo aquí:
    // await this.authz.loadRole?.();
  }

  logout() {
    this.authService.logout();
    window.location.reload();
    this.router.navigate(['/login']);
  }

  canAdmin(): boolean {
    return this.authz.hasRole('admin');
  }

  canEditCategories(): boolean {
    return this.authz.hasRole('admin', 'analista');
  }
}
