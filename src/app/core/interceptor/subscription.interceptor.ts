import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthzService } from '../../services/authz.service';

@Injectable()
export class SubscriptionInterceptor implements HttpInterceptor {
  constructor(private router: Router, private authz: AuthzService) {}
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (this.authz.role === 'admin') {
          return throwError(() => err);
        }
        if (err.status === 402 && req.url.startsWith(`${environment.apiUrl}/`) &&
            req.url !== `${environment.apiUrl}/subscription/status`) {
          // opcional: guardar detalle que llega del backend
          // err.error.subscription -> { status, end_date, days_left, ... }
          this.router.navigate(['/perfil'], {
            queryParams: {
              reason: err?.error?.subscription?.status ?? 'subscription_required',
              end: err?.error?.subscription?.end_date ?? ''
            }
          });
        }
        return throwError(() => err);
      })
    );
  }
}
