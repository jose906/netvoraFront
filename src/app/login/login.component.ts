import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthzService } from '../services/authz.service';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  // ================== LOGIN ==================
  email: string = '';
  password: string = '';

  // ================== FORGOT ==================
  showForgot: boolean = false;
  forgotEmail: string = '';
  msg: string = '';
  resetSent = false;
  loading: boolean = false;

  // ================== SIGNUP ==================
  showSignup: boolean = false;

  loadingSignup: boolean = false;
  signupMsg: string = '';

  email2: string = '';
  password2: string = '';
  passwordConfirm2: string = '';
  nombre2: string = '';
  organizacion2: string = '';

  loginMsg: string = '';
loadingLogin: boolean = false;

  constructor(
    private auth: AuthService,
    private authz: AuthzService,
    private router: Router,
    private apiService: ApiService
  ) {
    this.auth.authState$().pipe(takeUntilDestroyed()).subscribe(user => {
      if (user && !this.loadingLogin && !this.loadingSignup && !this.registroPendiente) {
        void this.router.navigate(['/']);
      }
    });
  }

  // ================== ESC CLOSE ==================
 

  // ================== LOGIN ==================
 async loginEmail() {
  const email = this.cleanEmail(this.email);
  if (this.loadingLogin) return;
  const password = this.password;

  this.loginMsg = '';
  this.loadingLogin = true;

  if (!email || !this.isValidEmail(email)) {
    this.loginMsg = 'Ingresa un correo válido.';
    this.loadingLogin = false;
    return;
  }

  if (!password) {
    this.loginMsg = 'Ingresa tu contraseña.';
    this.loadingLogin = false;
    return;
  }

  try {
    await this.auth.login(email, password);
    
    this.router.navigate(['/']);
  } catch (error: any) {
   

    const code = error?.code;

    if (
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential'
    ) {
      this.loginMsg = 'Correo o contraseña incorrectos.';
    } else if (code === 'auth/invalid-email') {
      this.loginMsg = 'Correo inválido.';
    } else {
      this.loginMsg = 'No se pudo iniciar sesión. Intenta nuevamente.';
    }
  } finally {
    this.loadingLogin = false;
  }
}

  // ================== FORGOT MODAL ==================
  openForgot() {
    this.showForgot = true;
    this.msg = '';
    if (!this.forgotEmail && this.email) this.forgotEmail = this.email;
  }

  closeForgot() {
    this.showForgot = false;
    this.loading = false;
    this.msg = '';
  }

  async sendReset() {
    this.resetSent = false;
    const email = this.cleanEmail(this.forgotEmail);

    if (!email || !this.isValidEmail(email)) {
      this.msg = 'Escribe un correo válido (ej: usuario@dominio.com).';
      return;
    }

    this.loading = true;
    this.msg = '';

    try {
      await this.auth.forgotPassword(email);
      this.resetSent = true;
      this.msg = 'Si el correo existe, te llegará un email para restablecer la contraseña.';
    } catch (e: any) {
      
      this.msg = 'No se pudo enviar el correo. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  private registroPendiente: {
    name: string;
    organizacion: string;
  } | null = null;

  get sincronizacionPendiente(): boolean {
    return this.registroPendiente !== null;
  }

  async registrarUsuario(): Promise<void> {
    if (this.loadingSignup) return;
    this.signupMsg = '';
    this.loadingSignup = true;

    try {
      if (!this.registroPendiente) {
        const email = this.cleanEmail(this.email2);
        if (!this.isValidEmail(email) || !this.nombre2.trim() || !this.organizacion2.trim()) {
          this.signupMsg = 'Completa el nombre, la organización y un correo válido.';
          return;
        }
        if (this.password2.length < 6 || this.password2 !== this.passwordConfirm2) {
          this.signupMsg = 'Usa al menos 6 caracteres y confirma la misma contraseña.';
          return;
        }

        const datos = {
          name: this.nombre2.trim(),
          organizacion: this.organizacion2.trim()
        };
        await this.auth.register(email, this.password2);
        this.registroPendiente = datos;
      }

      await firstValueFrom(this.apiService.syncUsers(this.registroPendiente));
      this.registroPendiente = null;
      this.authz.reset();
      await this.authz.refreshMe();
      await this.router.navigate(['/']);
    } catch (error: unknown) {
      if (this.registroPendiente) {
        this.signupMsg = 'La cuenta se creó. Reintenta la sincronización para continuar.';
      } else if ((error as { code?: string })?.code === 'auth/email-already-in-use') {
        this.signupMsg = 'Esa cuenta ya existe. Inicia sesión o recupera tu contraseña.';
      } else {
        this.signupMsg = 'No se pudo completar el registro. Intenta nuevamente.';
      }
    } finally { 
      this.loadingSignup = false;
    }
  }

  cancelar(): void {
    this.clearSignup();
  }

  closesignup(): void {
    if (!this.loadingSignup && !this.sincronizacionPendiente) this.showSignup = false;
  }

  clearSignup(): void {
    if (this.loadingSignup || this.sincronizacionPendiente) return;
    this.nombre2 = '';
    this.organizacion2 = '';
    this.email2 = '';
    this.password2 = '';
    this.passwordConfirm2 = '';
    this.signupMsg = '';
  }

  openSignup(): void {
    this.showSignup = true;
    if (!this.email2) this.email2 = this.email;
  }

  // ================== HELPERS ==================
  private cleanEmail(raw: string): string {
    return (raw || '').trim();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }
}
