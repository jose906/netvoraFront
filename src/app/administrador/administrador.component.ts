import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { user, users } from '../interfaces/users';
import { AuthService } from '../services/auth.service';

type AdminTab = 'sistema' | 'x';

type Plan = {
  id: number;
  name: string;
  duration_days: number;
  cost: string;
  is_active: number;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AppUser = {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string;
  role?: string;
  tipeUser?: string;
  estadoUser: string;
  created_at?: string;
  updated_at?: string;

  // Campos adicionales que deberá incluir getAppUsers() en el backend.
  subscription_plan_name?: string | null;
  subscription_end_date?: string | null;
};

type XAccount = users & {
  // Campos adicionales que deberá incluir getUsers('Todos') en el backend.
  // following_count: número de cuentas que sigue esta cuenta de X.
  // tweet_count: publicaciones totales de esta cuenta en X.
  following_count?: number | null;
  tweet_count?: number | null;
};

@Component({
  selector: 'app-administrador',
  templateUrl: './administrador.component.html',
  styleUrls: ['./administrador.component.css']
})
export class AdministradorComponent implements OnInit {
  activeTab: AdminTab = 'sistema';

  users: XAccount[] = [];
  appUsers: AppUser[] = [];
  plans: Plan[] = [];

  cargando = false;
  loadingAppUsers = false;
  xSearchTerm = '';
  systemSearchTerm = '';

  email = '';
  password = '';
  nombre2 = '';
  estado = '';
  tipo = '';

  selectedUserId: number | null = null;
  selectedPlanId: number | null = null;
  startDate = '';
  endDate = '';
  creatingSub = false;
  subMsg = '';

  user: user | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private AuthService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadPlans();
    this.loadAppUsers();
    this.startDate = this.toDateInputValue(new Date());
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
  }

  get filteredXUsers(): XAccount[] {
    const term = this.xSearchTerm.trim().toLowerCase();
    if (!term) return this.users;
    return this.users.filter(item =>
      [item.TweetUser, item.nameUser, item.idTweetUser, item.tipeUser]
        .some(value => String(value ?? '').toLowerCase().includes(term))
    );
  }

  get filteredAppUsers(): AppUser[] {
    const term = this.systemSearchTerm.trim().toLowerCase();
    if (!term) return this.appUsers;
    return this.appUsers.filter(item =>
      [item.display_name, item.email, item.role, item.tipeUser, item.estadoUser]
        .some(value => String(value ?? '').toLowerCase().includes(term))
    );
  }

  get activeAppUsers(): AppUser[] {
    return this.appUsers.filter(u =>
      String(u.estadoUser ?? '').toLowerCase() === 'activo'
    );
  }

  get activeSystemUsersCount(): number {
    return this.activeAppUsers.length;
  }

 async loadUsers(): Promise<void> {
  this.cargando = true;

  try {
    const token = await this.AuthService.getIdToken();

    this.apiService.getAdminXSources().subscribe({
      next: (data: XAccount[]) => {
        this.users = data || [];
        this.cargando = false;
      },
      error: err => {
        console.error('Error al cargar fuentes X:', err);
        this.cargando = false;
      }
    });

  } catch (err) {
    console.error('Error de autenticación:', err);
    this.cargando = false;
  }
}

  loadPlans(): void {
    this.apiService.getPlans().subscribe({
      next: (data: Plan[]) => {
        this.plans = (data || []).filter(p => Number(p.is_active) === 1);
      },
      error: err => console.error('Error al cargar planes:', err)
    });
  }

 async loadAppUsers(): Promise<void> {
  this.loadingAppUsers = true;

  try {
    

    this.apiService.getAdminSystemUsers().subscribe({
      next: (data: AppUser[]) => {
        this.appUsers = data || [];
        this.loadingAppUsers = false;
      },
      error: err => {
        console.error('Error al cargar usuarios:', err);
        this.loadingAppUsers = false;
      }
    });

  } catch (err) {
    console.error('Error de autenticación:', err);
    this.loadingAppUsers = false;
  }
}

  // Para evitar mostrar una fecha incorrecta por conversión de zona horaria.
  formatSubscriptionDate(value?: string | null): string {
    if (!value) return '—';
    const ymd = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }

  subscriptionState(item: AppUser): 'vigente' | 'vencida' | 'sin-datos' {
    if (!item.subscription_end_date) return 'sin-datos';
    const end = item.subscription_end_date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'sin-datos';
    return end >= this.toDateInputValue(new Date()) ? 'vigente' : 'vencida';
  }

  subscriptionStateLabel(item: AppUser): string {
    const state = this.subscriptionState(item);
    if (state === 'vigente') return 'No vencida';
    if (state === 'vencida') return 'Vencida';
    return 'Sin datos';
  }

  // Devuelve — cuando el backend aún no dispone de la métrica; el 0 se muestra.
  formatXMetric(value?: number | null): string {
    if (value == null) return '—';
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-BO') : '—';
  }

  async crearSuscripcion(): Promise<void> {
    if (!this.canCreateSubscription() || this.creatingSub) return;

    try {
      this.creatingSub = true;
      this.subMsg = '';
      const token = await this.AuthService.getIdToken();
      const body = {
        user_id: this.selectedUserId,
        plan_id: this.selectedPlanId,
        start_date: this.startDate,
        end_date: this.endDate
      };

      this.apiService.createUserPlan(body, token).subscribe({
        next: () => {
          this.subMsg = '✅ Suscripción creada correctamente.';
          this.creatingSub = false;
          this.loadAppUsers();
        },
        error: err => {
          console.error('Error al crear suscripción:', err);
          this.subMsg = '❌ No se pudo crear la suscripción.';
          this.creatingSub = false;
        }
      });
    } catch (err) {
      console.error('Error de autenticación:', err);
      this.subMsg = '❌ Error de autenticación.';
      this.creatingSub = false;
    }
  }

  agregarUsuario(name: string, mail: string, tipo: string, estado: string): void {
    this.apiService.createNewUser({ name, mail, tipo, estado }).subscribe({
      next: () => this.loadUsers(),
      error: err => console.error('Error al agregar usuario:', err)
    });
  }

  async registrarUsuario(): Promise<void> {
    try {
      await this.AuthService.register(this.email, this.password);
      const token = await this.AuthService.getIdToken();
      const body = {
        name: this.nombre2,
        email: this.email,
        tipeUser: this.tipo,
        estadoUser: this.estado
      };
      this.apiService.syncUsers(body, token).subscribe({
        next: () => {
          this.loadAppUsers();
          this.resetNewUserForm();
        },
        error: err => console.error('Error al sincronizar usuario:', err)
      });
    } catch (err) {
      console.error('Error al registrar usuario:', err);
    }
  }

  resetNewUserForm(): void {
    this.nombre2 = '';
    this.email = '';
    this.password = '';
    this.tipo = '';
    this.estado = '';
  }

  buscar(userName: string, id: string): void {
    const nameTrim = userName.trim();
    const idTrim = id.trim();
    if (!nameTrim && !idTrim) {
      this.user = null;
      this.loadUsers();
      return;
    }

    if (nameTrim) {
      this.apiService.searchbyname(nameTrim).subscribe({
        next: (data: user) => this.user = data,
        error: err => {
          console.error('Error al buscar por nombre:', err);
          this.user = null;
        }
      });
      return;
    }

    if (idTrim) {
      this.apiService.searchbyid(Number(idTrim)).subscribe({
        next: (data: user) => this.user = data,
        error: err => {
          console.error('Error al buscar por ID:', err);
          this.user = null;
        }
      });
    }
  }

  cancelar(): void {
    this.user = null;
  }

  agregar(userName: string, id: string, name: string, tipo: string): void {
    if (!tipo || !userName || !id) return;

    const newUser: users = {
      idTweetUser: id,
      TweetUser: userName,
      nameUser: name,
      tipeUser: tipo
    };
    this.apiService.addUser(newUser).subscribe({
      next: () => {
        this.cancelar();
        this.loadUsers();
      },
      error: err => console.error('Error al agregar fuente de X:', err)
    });
  }

  get selectedPlan(): Plan | null {
    if (this.selectedPlanId == null) return null;
    return this.plans.find(p => p.id === this.selectedPlanId) || null;
  }

  onPlanChange(): void {
    this.recalcEndDate();
  }

  recalcEndDate(): void {
    const plan = this.selectedPlan;
    if (!plan || !this.startDate) {
      this.endDate = '';
      return;
    }

    const start = new Date(this.startDate + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + Number(plan.duration_days));
    this.endDate = this.toDateInputValue(end);
  }

  toDateInputValue(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  canCreateSubscription(): boolean {
    return this.selectedUserId != null &&
      this.selectedPlanId != null &&
      !!this.startDate && !!this.endDate;
  }

  resetPlanForm(): void {
    this.selectedUserId = null;
    this.selectedPlanId = null;
    this.startDate = this.toDateInputValue(new Date());
    this.endDate = '';
    this.subMsg = '';
  }
}
