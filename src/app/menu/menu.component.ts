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

  // =========================================================
  // USUARIO
  // =========================================================

  userEmail$: Observable<string>;
  userDisplayName$: Observable<string>;
  userInitial$: Observable<string>;

  // =========================================================
  // SIDEBAR MOBILE
  // =========================================================

  isSidebarOpen = false;

  constructor(
    private authService: AuthService,
    public authz: AuthzService,
    private router: Router
  ) {

    const user$ = (this.authService as any).user$ as Observable<any> | undefined;

    if (!user$) {

      this.userEmail$ = of('');
      this.userDisplayName$ = of('');
      this.userInitial$ = of('U');

    } else {

      this.userEmail$ = user$.pipe(
        map(u => (u?.email || '').toString())
      );

      this.userDisplayName$ = user$.pipe(
        map(u =>
          (
            u?.displayName ||
            u?.email ||
            'Usuario'
          ).toString()
        )
      );

      this.userInitial$ = this.userDisplayName$.pipe(
        map(name =>
          (name?.trim()?.[0] || 'U').toUpperCase()
        )
      );
    }
  }

  async ngOnInit() {

    // Si AuthzService necesita cargar role:
    // await this.authz.loadRole?.();

  }

  // =========================================================
  // AUTH
  // =========================================================

  logout() {
    this.authService.logout();
    window.location.reload();
    this.router.navigate(['/login']);
  }

  // =========================================================
  // PERMISOS
  // =========================================================

  canAdmin(): boolean {
    return this.authz.hasRole('admin');
  }

  canEditCategories(): boolean {
    return this.authz.hasRole('admin', 'analista');
  }

  // =========================================================
  // MOBILE SIDEBAR
  // =========================================================

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

}