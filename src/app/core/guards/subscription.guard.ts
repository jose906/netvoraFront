import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, catchError, from, map, of, switchMap, take } from 'rxjs';
import { AuthzService } from '../../services/authz.service';
import { SuscriptionService } from '../../services/suscription.service';

@Injectable({ providedIn: 'root' })
export class SubscriptionGuard implements CanActivate {
  constructor(
    private auth: AngularFireAuth,
    private authz: AuthzService,
    private sub: SuscriptionService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.auth.authState.pipe(
      take(1),
      switchMap(user => {
        if (!user) return of(this.router.createUrlTree(['/login']));

        const roleReady = this.authz.isLoaded() ? of(undefined) : from(this.authz.refreshMe());
        return roleReady.pipe(
          switchMap(() => this.authz.role === 'admin' ? of(true) : this.checkSubscription())
        );
      })
    );
  }

  private checkSubscription(): Observable<boolean | UrlTree> {
    return this.sub.fetchStatus().pipe(
      map(({ role, subscription }) => {
        if (!subscription || role?.trim().toLowerCase() === 'admin') return true;
        if (subscription.status === 'skip_role') return true;
        if (subscription.ok && subscription.status === 'active') return true;
        return this.renew(subscription.status, subscription.end_date);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) return of(this.router.createUrlTree(['/login']));
        if (error.status === 402) {
          return of(this.renew(error.error?.subscription?.status, error.error?.subscription?.end_date));
        }
        // Protected API requests continue to enforce access if the status check is unavailable.
        return of(true);
      })
    );
  }

  private renew(reason = 'subscription_required', end = ''): UrlTree {
    return this.router.createUrlTree(['/perfil'], { queryParams: { reason, end } });
  }
}
