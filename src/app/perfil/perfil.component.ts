import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  getAuth,
  updateProfile,
  updatePassword,
  User,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { EMPTY, Subscription, catchError, exhaustMap, timer } from 'rxjs';

import { AuthzService } from '../services/authz.service';
import { AccountService } from '../services/account.service';
import { AccountMeResponse, SubscriptionStatus } from '../interfaces/me';
import {
  BillingPlan,
  BillingService,
  QrPayment,
  QrPaymentStatus,
  UpcomingUserPlan
} from '../services/billing.service';

type Msg = { type: 'ok' | 'err'; text: string };
type BillingStep = 'plans' | 'qr';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit, OnDestroy {
  private subx = new Subscription();
  private paymentPolling?: Subscription;
  private msgTimer?: ReturnType<typeof setTimeout>;

  loading = {
    profile: false,
    pass: false,
    subscription: false,
    freeTrial: false
  };

  freeTrial = {
    available: false,
    used: false,
    hasActiveSubscription: false,
    loaded: false
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
    lastPayment: null as Date | null
  };
  upcomingPlan: UpcomingUserPlan | null = null;
loadingUpcoming = false;

  // Nuevo: estado para selección de plan y cobro por QR.
  billing = {
    open: false,
    step: 'plans' as BillingStep,
    plans: [] as BillingPlan[],
    selectedPlan: null as BillingPlan | null,
    payment: null as QrPayment | null,
    qrImageUrl: '',
    loadingPlans: false,
    generating: false,
    checking: false,
    cancelling: false,
    error: ''
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
    private account: AccountService,
    private billingService: BillingService
  ) {}

  ngOnInit(): void {
    this.loadUserFromFirebase();
    this.loadRole();
    this.loadSubscriptionFromApi();
    this.loadFreeTrialStatus();
  }

  ngOnDestroy(): void {
    this.stopPaymentPolling();
    if (this.msgTimer) clearTimeout(this.msgTimer);
    this.subx.unsubscribe();
  }

  private loadFreeTrialStatus(): void {
    const s = this.account.freeTrialStatus().subscribe({
      next: res => {
        this.freeTrial.available = res.available;
        this.freeTrial.used = res.used;
        this.freeTrial.hasActiveSubscription = res.has_active_subscription;
        this.freeTrial.loaded = true;
      },
      error: () => {
        this.freeTrial.available = false;
        this.freeTrial.loaded = true;
      }
    });
    this.subx.add(s);
  }

  activateFreeTrial(): void {
    if (this.loading.freeTrial || !this.freeTrial.available) return;

    this.loading.freeTrial = true;
    const s = this.account.activateFreeTrial().subscribe({
      next: res => {
        this.setMsg('ok', res.message || 'Tu prueba gratuita de 7 días fue activada.');
        this.freeTrial.available = false;
        this.freeTrial.used = true;
        this.loadSubscriptionFromApi();
        this.loadFreeTrialStatus();
        this.loading.freeTrial = false;
      },
      error: err => {
        this.setMsg('err', err?.error?.error || 'No se pudo activar la prueba gratuita.');
        this.loading.freeTrial = false;
        this.loadFreeTrialStatus();
      }
    });
    this.subx.add(s);
  }

  private setMsg(type: Msg['type'], text: string): void {
    this.msg = { type, text };
    if (this.msgTimer) clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msg.text = ''; }, 4500);
  }

  private loadUserFromFirebase(): void {
    const u = getAuth().currentUser;
    if (!u) {
      this.setMsg('err', 'No hay sesión activa.');
      return;
    }
    this.profile.displayName = u.displayName || '';
    this.profile.email = u.email || '';
  }

  private loadRole(): void {
    const s = this.authz.role$.subscribe(r => {
      this.role = r || 'usuario';
    });
    this.subx.add(s);
  }

  private loadSubscriptionFromApi(): void {
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
          ? new Date(res.subscription.start_date) : null;
        this.sub.expiresAt = res.subscription?.end_date
          ? new Date(res.subscription.end_date) : null;
        this.sub.cost = plan?.cost ?? null;
        this.sub.durationDays = plan?.duration_days ?? null;
        this.sub.description = plan?.description ?? '';
        this.sub.renewal = '—';
        this.sub.limits = '—';
        this.sub.lastPayment = null;

        this.loading.subscription = false;

        this.loadUpcomingSubscription();
      },
      error: () => {
        this.setMsg('err', 'No se pudo cargar tu cuenta. Revisa tu sesión o tu API.');
        this.loading.subscription = false;
      }
    });
    this.subx.add(s);
  }

  // ----------------------- COBROS / SUSCRIPCIONES -----------------------

  openBilling(): void {
    this.billing.open = true;
    this.billing.error = '';

    // Si el usuario cierra el diálogo, conserva el QR para poder volver a verlo.
    if (this.billing.payment?.status === 'PENDIENTE') {
      this.billing.step = 'qr';
      this.startPaymentPolling();
      return;
    }

    this.billing.step = 'plans';
    this.fetchBillingPlans();
  }

  closeBilling(): void {
    this.billing.open = false;
    this.stopPaymentPolling();
  }

  fetchBillingPlans(): void {
    if (this.billing.loadingPlans) return;
    this.billing.loadingPlans = true;
    this.billing.error = '';

    const s = this.billingService.getPlans().subscribe({
      next: res => {
        this.billing.plans = (res.plans || []).filter(
          p => (p.is_active == null || p.is_active === true || String(p.is_active) === '1')
            && Number.isFinite(Number(p.cost)) && Number(p.cost) > 0
            && Number.isSafeInteger(p.id) && p.id > 0
        );
        this.billing.loadingPlans = false;
      },
      error: err => {
        this.billing.loadingPlans = false;
        this.billing.error = this.billingError(err, 'No se pudieron cargar los planes.');
      }
    });
    this.subx.add(s);
  }

  selectPlanAndGenerateQr(plan: BillingPlan): void {
    if (this.billing.generating || this.billing.payment?.status === 'PENDIENTE') return;
    if (plan.currency !== 'BOB') {
      this.billing.error = 'Este plan aún no indica moneda BOB en la respuesta de /get_plans. Confirma la moneda y el precio antes de cobrar.';
      return;
    }

    this.billing.selectedPlan = plan;
    this.billing.generating = true;
    this.billing.error = '';

    const s = this.billingService.createQr(plan.id).subscribe({
      next: payment => {
        this.billing.generating = false;
        this.billing.payment = payment;
        this.billing.qrImageUrl = this.asQrDataUrl(payment.qr_base64);
        this.billing.step = 'qr';
        if (!this.billing.qrImageUrl && payment.status === 'PENDIENTE') {
          this.billing.error = 'El servidor no devolvió una imagen QR válida.';
        }
        this.applyPaymentStatus(payment.status);
        if (payment.status === 'PENDIENTE') this.startPaymentPolling();
      },
      error: err => {
        this.billing.generating = false;
        this.billing.error = this.billingError(err, 'No se pudo generar el QR.');
      }
    });
    this.subx.add(s);
  }


private loadUpcomingSubscription(): void {
  this.loadingUpcoming = true;

  const s = this.billingService
    .getUpcomingSubscription()
    .subscribe({
      next: res => {
        this.upcomingPlan = res.upcoming;
        this.loadingUpcoming = false;
      },

      error: err => {
        console.error(
          'Error consultando renovación:',
          err
        );

        this.upcomingPlan = null;
        this.loadingUpcoming = false;
      }
    });

  this.subx.add(s);
}


  
checkPaymentNow(): void {
  if (!this.billing.payment || this.billing.checking) return;

  this.billing.checking = true;
  this.billing.error = '';

  const paymentId = this.billing.payment.payment_id;

  const s = this.billingService.getPayment(paymentId)
    .subscribe({
      next: res => {
        this.billing.checking = false;

        this.applyPaymentStatus(res.status);

        if (res.status === 'PENDIENTE') {
          this.billing.error =
            'El pago todavía está pendiente. Si ya pagaste, espera la confirmación automática.';
          return;
        }

        if (
          res.status === 'PAGADO' &&
          res.subscription_activated === false
        ) {
          this.billing.error =
            'El pago está confirmado, pero la activación de la suscripción sigue pendiente.';
          return;
        }

        if (res.status === 'PAGADO') {
          this.loadSubscriptionFromApi();
          this.loadFreeTrialStatus();
        }
      },

      error: err => {
        this.billing.checking = false;

        this.billing.error = this.billingError(
          err,
          'No se pudo verificar el pago.'
        );
      }
    });

  this.subx.add(s);
}


  
cancelQr(): void {
  const payment = this.billing.payment;

  if (
    !payment ||
    payment.status !== 'PENDIENTE' ||
    this.billing.cancelling
  ) return;

  this.billing.cancelling = true;
  this.billing.error = '';

  const s = this.billingService.cancelPayment(
    payment.payment_id
  ).subscribe({
    next: res => {
      this.billing.cancelling = false;

      if (res.status === 'PAGADO') {
        this.applyPaymentStatus('PAGADO');
        return;
      }

      if (res.dismissed === true) {
        this.stopPaymentPolling();

        this.billing.payment = null;
        this.billing.selectedPlan = null;
        this.billing.qrImageUrl = '';
        this.billing.step = 'plans';
        this.billing.error = '';

        this.fetchBillingPlans();

        this.setMsg(
          'ok',
          'QR cerrado en NetVora. Puede seguir vigente en CobraFácil.'
        );
        return;
      }

      if (
        res.status === 'CANCELADO' ||
        res.status === 'EXPIRADO'
      ) {
        this.applyPaymentStatus(res.status);
        this.backToPlans();
        return;
      }

      this.billing.error =
        res.message || 'No se pudo cerrar el QR.';
    },

    error: err => {
      this.billing.cancelling = false;

      this.billing.error = this.billingError(
        err,
        'No se pudo cerrar el QR.'
      );

      this.checkPaymentNow();
    }
  });

  this.subx.add(s);
}


  backToPlans(): void {
    if (this.billing.payment?.status === 'PENDIENTE') {
      this.billing.error = 'Cancela el QR pendiente antes de cambiar de plan.';
      return;
    }
    this.stopPaymentPolling();
    this.billing.payment = null;
    this.billing.selectedPlan = null;
    this.billing.qrImageUrl = '';
    this.billing.step = 'plans';
    this.billing.error = '';
    this.fetchBillingPlans();
  }

  private startPaymentPolling(): void {
    const payment = this.billing.payment;
    if (!payment || payment.status !== 'PENDIENTE') return;
    this.stopPaymentPolling();

    // Consultar a Flask, NO a Red Enlace desde el navegador.
    this.paymentPolling = timer(0, 5000).pipe(
      exhaustMap(() => this.billingService.getPayment(payment.payment_id).pipe(
        catchError(() => EMPTY)
      ))
    ).subscribe(res => this.applyPaymentStatus(res.status));
  }

  private stopPaymentPolling(): void {
    this.paymentPolling?.unsubscribe();
    this.paymentPolling = undefined;
  }

  private applyPaymentStatus(status: QrPaymentStatus): void {
    if (!this.billing.payment) return;
    const previous = this.billing.payment.status;
    this.billing.payment = { ...this.billing.payment, status };

    if (status === 'PENDIENTE') return;
    this.stopPaymentPolling();

    if (status === 'PAGADO' && previous !== 'PAGADO') {
      // La activación REAL ocurre exclusivamente en Flask, previa verificación.
      this.loadSubscriptionFromApi();
      this.loadFreeTrialStatus();
      this.setMsg('ok', 'Pago confirmado. Actualizando el estado de tu suscripción.');
    }
  }

  private asQrDataUrl(value: string): string {
    const base64 = (value || '')
      .replace(/^data:image\/png;base64,/i, '')
      .replace(/\s/g, '');
    return /^[A-Za-z0-9+/]+={0,2}$/.test(base64)
      ? `data:image/png;base64,${base64}`
      : '';
  }

  private billingError(err: any, fallback: string): string {
    const detail = err?.error?.error || err?.error?.message || err?.message;
    return typeof detail === 'string' && detail.trim() ? detail : fallback;
  }

  // ----------------------- PERFIL / CONTRASEÑA -------------------------

  async saveProfile(): Promise<void> {
    const u = getAuth().currentUser;
    if (!u) { this.setMsg('err', 'No hay sesión activa.'); return; }
    if (!this.profile.displayName?.trim()) {
      this.setMsg('err', 'Nombre inválido.'); return;
    }

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

  async changePassword(): Promise<void> {
    const u: User | null = getAuth().currentUser;
    if (!u) { this.setMsg('err', 'No hay sesión activa.'); return; }
    if (!u.email) { this.setMsg('err', 'No se encontró el email.'); return; }
    if (!this.pass.currentPassword) {
      this.setMsg('err', 'Debes ingresar tu contraseña actual.'); return;
    }
    if (!this.passwordsMatch()) {
      this.setMsg('err', 'Las contraseñas no coinciden.'); return;
    }
    if ((this.pass.newPassword || '').length < 8) {
      this.setMsg('err', 'Mínimo 8 caracteres.'); return;
    }

    try {
      this.loading.pass = true;
      const credential = EmailAuthProvider.credential(u.email, this.pass.currentPassword);
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
