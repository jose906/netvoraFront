import { Component, HostListener } from '@angular/core';
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
  loading: boolean = false;

  // ================== SIGNUP ==================
  showSignup: boolean = false;

  signupName: string = '';
  signupUsername: string = '';
  signupEmail: string = '';
  signupPassword: string = '';
  signupPassword2: string = '';
  acceptTerms: boolean = false;

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
  ) {}

  ngOnInit() {
    this.auth.authState$().subscribe(async (user) => {
      if (user) {
        this.router.navigate(['/']);
      }
    });
  }

  // ================== ESC CLOSE ==================
 

  // ================== LOGIN ==================
 async loginEmail() {
  const email = this.cleanEmail(this.email);
  const password = (this.password || '').trim();

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
    console.log('✅ Usuario logueado con éxito');
    this.router.navigate(['/']);
  } catch (error: any) {
    console.error('❌ Error al loguearse:', error);

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
      console.error('Reset error:', e?.code, e);
      this.msg = 'No se pudo enviar el correo. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

   async registrarUsuario() {
  const email = this.cleanEmail(this.email2);
  const pass = (this.password2 || '').trim();

  this.signupMsg = '';
  this.loadingSignup = true;

  try {
    // (opcional) validaciones rápidas
    if (!email || !this.isValidEmail(email)) {
      this.signupMsg = 'Escribe un correo válido.';
      return;
    }
    if (!pass) {
      this.signupMsg = 'Escribe una contraseña.';
      return;
    }

    await this.auth.register(email, pass);

    const token = await this.auth.getIdToken();
    const body = {
      name: this.nombre2,
      email,
      organizacion: this.organizacion2,
      tipeUser: "Usuario",
      estadoUser: "Activo"
    };

    this.apiService.syncUsers(body, token).subscribe({
      next: (data) => {
        console.log('✅ Usuarios sincronizados:', data);
        this.signupMsg = '✅ Usuario registrado con éxito.';
      },
      error: (error) => {
        console.error('❌ Error al sincronizar usuarios:', error);
        this.signupMsg = 'Se creó la cuenta, pero falló la sincronización.';
      }
    });

  } catch (e: any) {
    console.error('❌ Error al registrar usuario:', e);

    const code = e?.code || e?.error?.code;

    if (code === 'auth/email-already-in-use') {
      this.signupMsg = '⚠️ Esa cuenta ya existe. Inicia sesión o recupera tu contraseña.';
    } else if (code === 'auth/invalid-email') {
      this.signupMsg = 'Correo inválido.';
    } else if (code === 'auth/weak-password') {
      this.signupMsg = 'La contraseña es muy débil (mínimo 6 caracteres).';
    } else {
      this.signupMsg = 'No se pudo crear la cuenta. Intenta nuevamente.';
    }
  } finally {
    this.loadingSignup = false;
  }
}
     cancelar(): void {
    this.nombre2 = '';
    this.email2 = '';
    this.password2 = '';
  }

  closesignup() {
    this.showSignup = false;
  }

  clearSignup() {
   
  }
  openSignup() {
    this.showSignup = true;
    if (!this.signupEmail && this.email) this.signupEmail = this.email;
  }


  // ================== HELPERS ==================
  private cleanEmail(raw: string): string {
    return (raw || '').trim().replace(/\s+/g, '');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }
}
