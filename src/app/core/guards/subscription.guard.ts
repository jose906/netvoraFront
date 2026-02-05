import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, catchError, of } from 'rxjs';
import { SuscriptionService } from '../../services/suscription.service';
import { AuthzService } from '../../services/authz.service';

@Injectable({ providedIn: 'root' })
export class SubscriptionGuard implements CanActivate {
  constructor(private sub: SuscriptionService, private router: Router, private authz: AuthzService) {}
  
  canActivate(): Observable<boolean | UrlTree> {

    if (this.authz.role === 'admin') {
      return of(true);
    }
    return this.sub.fetchStatus().pipe(
      map(res => {
        const s = res.subscription;
        console.log('🔒 SubscriptionGuard: status=%o',s);
        // Admin u otros roles -> sin bloqueo
        if (s.status === 'skip_role') return true;

        // Activa -> OK
        if (s.ok && s.status === 'active') return true;

        // No activa -> mandar a renovar
        return this.router.createUrlTree(['/perfil'], {
          queryParams: {
            reason: s.status,
            end: s.end_date ?? ''
          }
        });
      }),
      catchError(() => of(this.router.createUrlTree(['/perfil'], { queryParams: { reason: 'error' } })))
    );
  }
}
