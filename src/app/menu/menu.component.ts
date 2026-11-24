import { Component, ElementRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Observable, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthzService } from '../services/authz.service';
import { NavigationEnd, NavigationSkipped, Router } from '@angular/router';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {

  // =========================================================
  // USUARIO
  // =========================================================

  userEmail$: Observable<string>;
  userDisplayName$: Observable<string>;
  userInitial$: Observable<string>;

  // =========================================================
  // SIDEBAR MOBILE
  // =========================================================

  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;
  isSidebarOpen = false;

  constructor(
    private authService: AuthService,
    public authz: AuthzService,
    private router: Router,
    breakpoints: BreakpointObserver
  ) {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd || event instanceof NavigationSkipped) {
        this.closeSidebar();
      }
    });

    breakpoints.observe('(max-width: 900px)').pipe(takeUntilDestroyed()).subscribe(state => {
      if (!state.matches) this.closeSidebar();
    });

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

  // =========================================================
  // AUTH
  // =========================================================

  async logout(): Promise<void> {
    this.logoutError = '';
    try {
      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch {
      this.logoutError = 'No se pudo cerrar sesión. Intenta nuevamente.';
    }
  }

  logoutError = '';

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

  openSidebar(): void {
    this.isSidebarOpen = true;
  }

  closeSidebar(): void {
    if (!this.isSidebarOpen) return;

    this.isSidebarOpen = false;
    this.menuToggle?.nativeElement.focus();
  }

}
