import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  getAuth,
  updateProfile,
  updatePassword,
  User,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { Subscription } from 'rxjs';

import { AuthzService } from '../services/authz.service';
import { AccountService } from '../services/account.service';
import { AccountMeResponse, SubscriptionStatus } from '../interfaces/me';

type Msg = { type: 'ok' | 'err'; text: string };

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit, OnDestroy {
  private subx = new Subscription();

  loading = {
    profile: false,
    pass: false,
    subscription: false,
  };

  msg: Msg = { type: 'ok', text: '' };

  role = 'usuario';
  estadoUser: string | null = null;

  profile = {
    displayName: '',
    email: '',
    org: '',
    timezone: 'America/La_Paz'
  };

  sub = {
    plan: '—',
    status: 'sin_plan' as SubscriptionStatus,
    expiresAt: null as Date | null,
    startDate: null as Date | null,
    cost: null as number | null,
    durationDays: null as number | null,
    description: '' as string,
    renewal: '—',
    limits: '—',
    lastPayment: null as Date | null,
  };

  pass = {
    currentPassword: '',
    newPassword: '',
    repeatPassword: ''
  };

  ui = {
    showPass: false,
    showPass2: false,
    showCurrentPass: false
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

  constructor(
    public authz: AuthzService,
    private account: AccountService
  ) {}

  ngOnInit(): void {
    this.loadUserFromFirebase();
    this.loadRole();
    this.loadSubscriptionFromApi();
  }

  ngOnDestroy(): void {
    this.subx.unsubscribe();
  }

  private setMsg(type: Msg['type'], text: string) {
    this.msg = { type, text };
    window.clearTimeout((this as any)._msgTimer);
    (this as any)._msgTimer = window.setTimeout(() => (this.msg.text = ''), 4500);
  }

  private loadUserFromFirebase() {
    const u = getAuth().currentUser;
    if (!u) {
      this.setMsg('err', 'No hay sesión activa.');
      return;
    }

    this.profile.displayName = u.displayName || '';
    this.profile.email = u.email || '';
  }

  private loadRole() {
    const s = this.authz.role$.subscribe(r => {
      this.role = r || 'usuario';
    });
    this.subx.add(s);
  }

  private loadSubscriptionFromApi() {
    this.loading.subscription = true;

    const s = this.account.me().subscribe({
      next: (res: AccountMeResponse) => {
        this.estadoUser = res.user.estadoUser;

        if (res.user.display_name) this.profile.displayName = res.user.display_name;
        if (res.user.email) this.profile.email = res.user.email;
        if (res.user.role) this.role = res.user.role;

        const plan = res.subscription?.plan;

        this.sub.status = res.subscription?.status || 'sin_plan';
        this.sub.plan = plan?.name || '—';

        this.sub.startDate = res.subscription?.start_date
          ? new Date(res.subscription.start_date)
          : null;

        this.sub.expiresAt = res.subscription?.end_date
          ? new Date(res.subscription.end_date)
          : null;

        this.sub.cost = plan?.cost ?? null;
        this.sub.durationDays = plan?.duration_days ?? null;
        this.sub.description = plan?.description ?? '';

        this.sub.renewal = this.sub.status === 'activa' ? '—' : '—';
        this.sub.limits = '—';
        this.sub.lastPayment = null;
      },
      error: () => {
        this.setMsg('err', 'No se pudo cargar tu cuenta. Revisa tu sesión o tu API.');
        this.loading.subscription = false;
      },
      complete: () => {
        this.loading.subscription = false;
      }
    });

    this.subx.add(s);
  }

  async saveProfile() {
    const u = getAuth().currentUser;
    if (!u) return this.setMsg('err', 'No hay sesión activa.');
    if (!this.profile.displayName?.trim()) return this.setMsg('err', 'Nombre inválido.');

    try {
      this.loading.profile = true;
      await updateProfile(u, { displayName: this.profile.displayName.trim() });
      this.setMsg('ok', 'Perfil actualizado correctamente.');
    } catch (e: any) {
      this.setMsg('err', this.humanFirebaseError(e));
    } finally {
      this.loading.profile = false;
    }
  }

  passwordsMatch(): boolean {
    return (this.pass.newPassword || '') === (this.pass.repeatPassword || '');
  }

  async changePassword() {
    const u: User | null = getAuth().currentUser;

    if (!u) return this.setMsg('err', 'No hay sesión activa.');
    if (!u.email) return this.setMsg('err', 'No se encontró el email.');
    if (!this.pass.currentPassword) return this.setMsg('err', 'Debes ingresar tu contraseña actual.');
    if (!this.passwordsMatch()) return this.setMsg('err', 'Las contraseñas no coinciden.');
    if ((this.pass.newPassword || '').length < 8) return this.setMsg('err', 'Mínimo 8 caracteres.');

    try {
      this.loading.pass = true;

      const credential = EmailAuthProvider.credential(
        u.email,
        this.pass.currentPassword
      );

      await reauthenticateWithCredential(u, credential);
      await updatePassword(u, this.pass.newPassword);

      this.pass.currentPassword = '';
      this.pass.newPassword = '';
      this.pass.repeatPassword = '';

      this.setMsg('ok', 'Contraseña cambiada correctamente.');
    } catch (e: any) {
      this.setMsg('err', this.humanFirebaseError(e));
    } finally {
      this.loading.pass = false;
    }
  }

  private humanFirebaseError(e: any): string {
    const code = e?.code || '';

    if (code.includes('auth/requires-recent-login')) {
      return 'Por seguridad, vuelve a iniciar sesión y repite el cambio de contraseña.';
    }

    if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) {
      return 'La contraseña actual es incorrecta.';
    }

    if (code.includes('auth/weak-password')) {
      return 'Contraseña débil. Usa 8+ caracteres.';
    }

    if (code.includes('auth/network-request-failed')) {
      return 'Error de red. Revisa tu conexión.';
    }

    return 'Ocurrió un error. Intenta nuevamente.';
  }
}