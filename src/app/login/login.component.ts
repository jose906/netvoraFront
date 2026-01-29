import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AuthzService } from '../services/authz.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = '';
  password: string = '';

  constructor(
    private auth: AuthService,
    private authz: AuthzService,
    private router: Router
  ) {}

  ngOnInit() {
    this.auth.authState$().subscribe(async user => {
      if (user) {
        // ✅ importante
        this.router.navigate(['/']);
      }
    });
  }

  async loginEmail() {
  try {
    await this.auth.login(this.email, this.password);

    // ✅ NO llames getCurrentUser como función, ni pases nada
    // AppComponent ya se encarga de refreshMe cuando authState cambia
    console.log('✅ Usuario logueado con éxito');
    this.router.navigate(['/']);

  } catch (error) {
    console.error('❌ Error al loguearse:', error);
  }
}
}
