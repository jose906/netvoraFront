import { environment } from '../../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, defer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private afAuth: AngularFireAuth) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!req.url.startsWith(`${environment.apiUrl}/`)) {
      return next.handle(req);
    }

    return defer(() => this.afAuth.currentUser).pipe(
      switchMap(async (user) => {
        if (!user) return req;
        const token = await user.getIdToken();

        return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      }),
      switchMap(authReq => next.handle(authReq))
    );
  }
}
