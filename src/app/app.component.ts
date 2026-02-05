import { Component,OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthzService } from './services/authz.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { SubscriptionStatusResponse, SuscriptionService } from '../app/services/suscription.service';
import { Observable } from 'rxjs';


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
    private sub: SuscriptionService
  ) {

    this.sub$ = this.sub.status$;
  }
  

  ngOnInit(): void {
    this.afAuth.authState.subscribe(async (user) => {
      console.log('🔥 authState changed:', user?.uid);

      if (user) {
        // IMPORTANTE: espera un micro-tick para que currentUser esté listo
        await this.authz.refreshMe();
      } else {
        this.authz.reset();
      }
    });
    this.sub.fetchStatus().subscribe({ error: () => {} });

  }

  esLogin() {
    return this.router.url === '/login';
  }
}
