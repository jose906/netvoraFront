import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthzService, UserRole } from '../../services/authz.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authz: AuthzService, private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const allowed = (route.data['roles'] as UserRole[]) || [];
    if (!allowed.length) return true;

    // ✅ si todavía no cargó el rol, lo cargamos ahora
    if (!this.authz.isLoaded()) {
      await this.authz.refreshMe();
    }

    if (this.authz.hasRole(...allowed)) return true;

    this.router.navigate(['/']);
    return false;
  }
}
