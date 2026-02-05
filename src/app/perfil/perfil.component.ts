import { Component, OnDestroy, OnInit } from '@angular/core';
// Si usas Firebase:
import { getAuth, updateProfile, updatePassword, User } from 'firebase/auth';

// Si ya tienes servicios propios, reemplaza estas lecturas por tus Observables.
import { AuthzService } from '../services/authz.service'; // ajusta ruta si aplica

type Msg = { type: 'ok' | 'err'; text: string };
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent {
  private subx = new Subscription();

  loading = {
    profile: false,
    pass: false,
    subscription: false,
  };

  msg: Msg = { type: 'ok', text: '' };

  role = 'usuario';

  profile = {
    displayName: '',
    email: '',
    org: '',
    timezone: 'America/La_Paz'
  };

  // info de suscripción (ejemplo). Conecta con tu API si ya tienes.
  sub = {
    plan: 'Free',
    status: 'activa', // activa | vencida | suspendida
    expiresAt: null as Date | null,
    renewal: 'Manual',
    limits: '—',
    lastPayment: null as Date | null,
  };

  pass = {
    newPassword: '',
    repeatPassword: ''
  };

  ui = {
    showPass: false,
    showPass2: false
  };

  timezones = [
    'America/La_Paz',
    'America/Lima',
    'America/Bogota',
    'America/Santiago',
    'America/Argentina/Buenos_Aires',
    'America/Mexico_City',
    'America/New_York',
    'Europe/Madrid'
  ];

  constructor(public authz: AuthzService) {}

  ngOnInit(): void {
    this.loadUser();
    this.loadRole();
    this.loadSubscription();
  }

  ngOnDestroy(): void {
    this.subx.unsubscribe();
  }

  private setMsg(type: Msg['type'], text: string) {
    this.msg = { type, text };
    // auto-hide suave
    window.clearTimeout((this as any)._msgTimer);
    (this as any)._msgTimer = window.setTimeout(() => this.msg.text = '', 4500);
  }

  private loadUser() {
    const auth = getAuth();
    const u = auth.currentUser;
    if (!u) {
      this.setMsg('err', 'No hay sesión activa.');
      return;
    }

    this.profile.displayName = u.displayName || '';
    this.profile.email = u.email || '';
    // org / timezone puedes cargarlo desde tu DB si lo guardas (Firestore / SQL)
  }

  private loadRole() {
    // Tu servicio ya tiene role$ (como en sidebar)
    const s = this.authz.role$.subscribe(r => this.role = (r || 'usuario'));
    this.subx.add(s);
  }

  private loadSubscription() {
    // ✅ Reemplaza esta sección por tu API real
    // Ejemplo dummy:
    this.loading.subscription = true;

    setTimeout(() => {
      this.sub = {
        plan: (this.role === 'admin') ? 'Enterprise' : 'Pro',
        status: 'activa',
        expiresAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15),
        renewal: 'Auto',
        limits: '100k posts/mes • 10 dashboards',
        lastPayment: new Date(new Date().getFullYear(), new Date().getMonth(), 15)
      };
      this.loading.subscription = false;
    }, 350);
  }

  async saveProfile() {
    const auth = getAuth();
    const u = auth.currentUser;

    if (!u) return this.setMsg('err', 'No hay sesión activa.');
    if (!this.profile.displayName?.trim()) return this.setMsg('err', 'Nombre inválido.');

    try {
      this.loading.profile = true;
      await updateProfile(u, { displayName: this.profile.displayName.trim() });
      // Si guardas org/timezone en DB, aquí llamas a tu API/Firestore.
      this.setMsg('ok', 'Perfil actualizado correctamente.');
    } catch (e: any) {
      this.setMsg('err', this.humanFirebaseError(e));
    } finally {
      this.loading.profile = false;
    }
  }

  passwordsMatch() {
    return (this.pass.newPassword || '') === (this.pass.repeatPassword || '');
  }

  async changePassword() {
    const auth = getAuth();
    const u: User | null = auth.currentUser;

    if (!u) return this.setMsg('err', 'No hay sesión activa.');
    if (!this.passwordsMatch()) return this.setMsg('err', 'Las contraseñas no coinciden.');
    if ((this.pass.newPassword || '').length < 8) return this.setMsg('err', 'Mínimo 8 caracteres.');

    try {
      this.loading.pass = true;
      await updatePassword(u, this.pass.newPassword);

      this.pass.newPassword = '';
      this.pass.repeatPassword = '';
      this.setMsg('ok', 'Contraseña cambiada. ✅');
    } catch (e: any) {
      // Firebase puede pedir "recent login"
      this.setMsg('err', this.humanFirebaseError(e));
    } finally {
      this.loading.pass = false;
    }
  }

  private humanFirebaseError(e: any): string {
    const code = e?.code || '';
    if (code.includes('auth/requires-recent-login')) return 'Por seguridad, vuelve a iniciar sesión y repite el cambio de contraseña.';
    if (code.includes('auth/weak-password')) return 'Contraseña débil. Usa 8+ caracteres (ideal: 12+).';
    if (code.includes('auth/network-request-failed')) return 'Error de red. Revisa tu conexión.';
    return 'Ocurrió un error. Intenta nuevamente.';
  }

}
