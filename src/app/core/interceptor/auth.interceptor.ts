import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private afAuth: AngularFireAuth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return from(this.afAuth.currentUser).pipe(
      switchMap(async (user) => {
        if (!user) return req;
        const token = await user.getIdToken();
        console.log('TOKEN?', token?.slice(0, 20));
        return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      }),
      switchMap((authReq) => next.handle(authReq))
    );
  }
}
