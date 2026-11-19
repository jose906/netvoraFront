import { Component, DestroyRef, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthzService } from './services/authz.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { SubscriptionStatusResponse, SuscriptionService } from '../app/services/suscription.service';
import { EMPTY, Observable, catchError, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {

  sub$!: Observable<SubscriptionStatusResponse | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private authz: AuthzService,
    private router: Router,
    private sub: SuscriptionService,
    private destroyRef: DestroyRef
  ) {
    this.sub$ = this.sub.status$;
  }

  ngOnInit(): void {
    this.afAuth.authState.pipe(
      switchMap(user => {
        this.authz.reset();
        this.sub.clear();
        if (!user) return EMPTY;

        void this.authz.refreshMe();
        return this.sub.fetchStatus().pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  esLogin() {
    return this.router.url.split(/[?#]/, 1)[0] === '/login';
  }
}
