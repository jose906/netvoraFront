import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AuthzService } from '../services/authz.service';
import { Router } from '@angular/router';
import { HostListener } from '@angular/core';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  showForgot: boolean = false;
  forgotEmail: string = '';
  msg: string = '';
  loading: boolean = false;

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
  openForgot() {
  this.showForgot = true;
  this.msg = '';
  // opcional: precargar el email del login
  if (!this.forgotEmail && this.email) this.forgotEmail = this.email;
}
@HostListener('document:keydown.escape')
onEsc() {
  if (this.showForgot) this.closeForgot();
}

  async loginEmail() {
  const email = this.cleanEmail(this.email);
  const password = (this.password || '').trim();

  if (!email || !this.isValidEmail(email)) {
    console.error('❌ Email inválido:', JSON.stringify(this.email));
    return;
  }
  if (!password) {
    console.error('❌ Password vacío');
    return;
  }

  try {
    await this.auth.login(email, password);
    console.log('✅ Usuario logueado con éxito');
    this.router.navigate(['/']);
  } catch (error: any) {
    console.error('❌ Error al loguearse:', error);
  }
}

closeForgot() {
  this.showForgot = false;
  this.loading = false;
  this.msg = '';
}

async sendReset() {
  const email = this.cleanEmail(this.forgotEmail);

  if (!email || !this.isValidEmail(email)) {
    this.msg = 'Escribe un correo válido (ej: usuario@dominio.com).';
    return;
  }

  this.loading = true;
  this.msg = '';

  try {
    await this.auth.forgotPassword(email);
    this.msg = 'Si el correo existe, te llegará un email para restablecer la contraseña.';
  } catch (e: any) {
    // Puedes loguear el code real para debug
    console.error('Reset error:', e?.code, e);
    this.msg = 'No se pudo enviar el correo. Intenta nuevamente.';
  } finally {
    this.loading = false;
  }
}

  private cleanEmail(raw: string): string {
  return (raw || '').trim().replace(/\s+/g, ''); // quita espacios incluso en medio
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

}
