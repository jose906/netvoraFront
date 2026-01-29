import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthzService } from './services/authz.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  constructor(
    private afAuth: AngularFireAuth,
    private authz: AuthzService,
    private router: Router
  ) {}

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
  }

  esLogin() {
    return this.router.url === '/login';
  }
}
