import { Component, OnInit } from '@angular/core';

import { ApiService } from '../services/api.service';

import {
  user,
  users
} from '../interfaces/users';

import {
  AuthzService,
  UserRole
} from '../services/authz.service';

import {
  AccountService
} from '../services/account.service';

import {
  AccountMeResponse
} from '../interfaces/me';


type ToastType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info';


type UserFilter =
  | 'todos'
  | 'medio'
  | 'persona'
  | 'entidad';


@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {

  // =========================================================
  // CUENTAS
  // =========================================================

  users: users[] = [];

  selectedTipo: UserFilter = 'todos';

  searchText = '';

  followingUsers = new Set<string>();

  cargando = false;

  user: user | null = null;


  // =========================================================
  // DRAWER
  // =========================================================

  sourceDrawerOpen = false;

  searching = false;

  adding = false;

  followBusyIds = new Set<string>();


  // =========================================================
  // CUENTA / PLAN
  // =========================================================

  accessLoading = true;

  currentRole: UserRole = 'viewer';

  subscriptionPlan = '';

  subscriptionStatus = '';

  subscriptionStartDate: Date | null = null;

  subscriptionEndDate: Date | null = null;

  subscriptionCost: number | null = null;

  subscriptionDescription = '';


  // =========================================================
  // TOAST
  // =========================================================

  toast = {
    show: false,
    type: 'info' as ToastType,
    title: '',
    message: ''
  };

  private toastTimer: any = null;


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private apiService: ApiService,
    private authzService: AuthzService,
    private accountService: AccountService
  ) {}


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadAccess();

    this.loadUsers();

    this.loadFollowingUsers();
  }


  // =========================================================
  // CARGAR ACCESO / PLAN
  // =========================================================

  private async loadAccess(): Promise<void> {

    this.accessLoading = true;

    // Primero cargamos el rol.
    try {

      if (!this.authzService.isLoaded()) {

        await this.authzService.refreshMe();
      }

      this.currentRole =
        this.authzService.role;

    } catch {

      this.currentRole = 'viewer';
    }


    // Después cargamos la cuenta y el plan
    // usando EL MISMO endpoint que PerfilComponent.
    this.accountService
      .me()
      .subscribe({

        next: (
          res: AccountMeResponse
        ) => {

          // ===============================================
          // ROLE
          // ===============================================

          if (res?.user?.role) {

            const role =
              res.user.role
                .toString()
                .trim()
                .toLowerCase();

            if (
              role === 'admin' ||
              role === 'analista' ||
              role === 'viewer'
            ) {

              this.currentRole =
                role as UserRole;
            }
          }


          // ===============================================
          // PLAN
          // ===============================================

          const plan =
            res?.subscription?.plan;

          this.subscriptionPlan =
            plan?.name
              ?.toString()
              .trim() || '';


          // ===============================================
          // STATUS
          // ===============================================

          this.subscriptionStatus =
            res?.subscription?.status
              ?.toString()
              .trim()
              .toLowerCase() || '';


          // ===============================================
          // FECHAS
          // ===============================================

          this.subscriptionStartDate =
            res?.subscription?.start_date
              ? new Date(
                  res.subscription.start_date
                )
              : null;


          this.subscriptionEndDate =
            res?.subscription?.end_date
              ? new Date(
                  res.subscription.end_date
                )
              : null;


          // ===============================================
          // INFO DEL PLAN
          // ===============================================

          this.subscriptionCost =
            plan?.cost ?? null;


          this.subscriptionDescription =
            plan?.description || '';


          this.accessLoading = false;
        },


        error: (error) => {

          console.error(
            'Error cargando cuenta/plan:',
            error
          );

          this.subscriptionPlan = '';

          this.subscriptionStatus = '';

          this.subscriptionStartDate = null;

          this.subscriptionEndDate = null;

          this.subscriptionCost = null;

          this.subscriptionDescription = '';

          this.accessLoading = false;

          this.showToast(
            'error',
            'No pudimos cargar tu plan',
            'La información de tu cuenta no está disponible.'
          );
        }
      });
  }


  // =========================================================
  // ROLE
  // =========================================================

  get isAdmin(): boolean {

    return this.currentRole === 'admin';
  }


  // =========================================================
  // PLAN NORMALIZADO
  // =========================================================

  get normalizedPlan(): string {

    return (
      this.subscriptionPlan || ''
    )
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      );
  }


  // =========================================================
  // TIPOS DE PLAN
  // =========================================================

  get isPro(): boolean {

    return this.normalizedPlan === 'pro';
  }


  get isBasic(): boolean {

    return (
      this.normalizedPlan === 'basico'
    );
  }


  get isFree(): boolean {

    return (
      this.normalizedPlan === 'free'
    );
  }


  // =========================================================
  // SUSCRIPCIÓN ACTIVA
  // =========================================================

  get subscriptionIsActive(): boolean {

    const status =
      (
        this.subscriptionStatus || ''
      )
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        );

    /*
     * Soportamos ambos formatos:
     *
     * activa  -> endpoint AccountService
     * active  -> por compatibilidad
     */
    return (
      status === 'activa' ||
      status === 'active'
    );
  }


  // =========================================================
  // PUEDE AGREGAR CUENTAS DE X
  // =========================================================

  get canManageXUsers(): boolean {

    /*
     * ADMIN:
     * siempre puede.
     */
    if (this.isAdmin) {

      return true;
    }


    /*
     * PRO:
     * debe tener suscripción activa.
     */
    return (
      this.isPro &&
      this.subscriptionIsActive
    );
  }


  // =========================================================
  // NOMBRE DEL PLAN
  // =========================================================

  get planDisplayName(): string {

    /*
     * Mostramos Admin como acceso especial.
     *
     * Si prefieres mostrar también su plan
     * aunque sea admin, podemos cambiar esto.
     */
    if (this.isAdmin) {

      return 'Admin';
    }


    switch (
      this.normalizedPlan
    ) {

      case 'pro':

        return 'Pro';


      case 'basico':

        return 'Básico';


      case 'free':

        return 'Free';


      default:

        return 'Sin plan';
    }
  }


  // =========================================================
  // RESUMEN
  // =========================================================

  get totalUsers(): number {

    return this.users.length;
  }


  get totalFollowing(): number {

    return this.followingUsers.size;
  }


  get totalMedios(): number {

    return this.countByType(
      'medio'
    );
  }


  get totalPersonas(): number {

    return this.countByType(
      'persona'
    );
  }


  get totalEntidades(): number {

    return this.countByType(
      'entidad'
    );
  }


  private countByType(
    tipo: UserFilter
  ): number {

    if (tipo === 'todos') {

      return this.users.length;
    }


    return this.users.filter(
      u =>
        this.normalizeUserType(u) ===
        tipo
    ).length;
  }


  // =========================================================
  // CARGAR USUARIOS
  // =========================================================

  loadUsers(): void {

    this.cargando = true;


    this.apiService
      .getUsers('todos')
      .subscribe({

        next: (data) => {

          this.users =
            Array.isArray(data)
              ? data
              : [];

          this.cargando = false;
        },


        error: (error) => {

          console.error(
            'Error cargando usuarios:',
            error
          );

          this.users = [];

          this.cargando = false;

          this.showToast(
            'error',
            'No pudimos cargar las fuentes',
            'Intenta nuevamente en unos segundos.'
          );
        }
      });
  }


  // =========================================================
  // FILTROS
  // =========================================================

  changeTipo(
    tipo: UserFilter
  ): void {

    this.selectedTipo = tipo;
  }


  // =========================================================
  // BÚSQUEDA LOCAL
  // =========================================================

  updateSearch(
    value: string
  ): void {

    this.searchText =
      (value || '')
        .trim();
  }


  clearSearch(
    input?: HTMLInputElement
  ): void {

    this.searchText = '';

    if (input) {

      input.value = '';

      input.focus();
    }
  }


  // =========================================================
  // USUARIOS FILTRADOS
  // =========================================================

  filteredUsers(): users[] {

    let result =
      [...this.users];


    // ===============================================
    // FILTRO TIPO
    // ===============================================

    if (
      this.selectedTipo !==
      'todos'
    ) {

      result =
        result.filter(
          u =>
            this.normalizeUserType(u) ===
            this.selectedTipo
        );
    }


    // ===============================================
    // FILTRO TEXTO
    // ===============================================

    const search =
      this.searchText
        .trim()
        .toLowerCase();


    if (search) {

      result =
        result.filter(
          u => {

            const username =
              (
                u.TweetUser || ''
              )
                .toString()
                .toLowerCase();


            const name =
              (
                u.nameUser || ''
              )
                .toString()
                .toLowerCase();


            const id =
              String(
                u.idTweetUser || ''
              )
                .toLowerCase();


            return (
              username.includes(search) ||
              name.includes(search) ||
              id.includes(search)
            );
          }
        );
    }


    return result;
  }


  // =========================================================
  // NORMALIZAR TIPO
  // =========================================================

  private normalizeUserType(
    u: users
  ): string {

    return (
      u.tipeUser ||
      (u as any).tipo_cuenta ||
      ''
    )
      .toString()
      .trim()
      .toLowerCase();
  }


  // =========================================================
  // TIPO PARA UI
  // =========================================================

  getUserType(
    u: users
  ): string {

    switch (
      this.normalizeUserType(u)
    ) {

      case 'medio':

        return 'Medio';


      case 'persona':

        return 'Persona';


      case 'entidad':

        return 'Entidad';


      default:

        return 'Sin clasificar';
    }
  }


  // =========================================================
  // INICIAL
  // =========================================================

  getInitial(
    u: users
  ): string {

    const value =
      u.TweetUser ||
      u.nameUser ||
      String(
        u.idTweetUser || 'U'
      );


    return value
      .toString()
      .charAt(0)
      .toUpperCase();
  }


  // =========================================================
  // TRACK
  // =========================================================

  trackById = (
    _: number,
    u: users
  ) => String(
    u.idTweetUser
  );


  // =========================================================
  // CARGAR CUENTAS MONITOREADAS
  // =========================================================

  private loadFollowingUsers(): void {

    this.apiService
      .getFollowedTweetUsers()
      .subscribe({

        next: (res) => {

          const ids =
            (res?.rows || [])
              .map(
                (r: any) =>
                  String(
                    r.tweetuser_id
                  )
              );


          this.followingUsers =
            new Set(ids);
        },


        error: (error) => {

          console.error(
            'Error cargando monitoreo:',
            error
          );

          this.showToast(
            'error',
            'No pudimos cargar tu monitoreo',
            'La lista de cuentas activas no está disponible.'
          );
        }
      });
  }


  // =========================================================
  // SIGUIENDO
  // =========================================================

  isFollowingTweetUser(
    tweetuserId:
      string |
      number
  ): boolean {

    return this.followingUsers.has(
      String(tweetuserId)
    );
  }


  // =========================================================
  // BUSY FOLLOW
  // =========================================================

  isFollowBusy(
    tweetuserId:
      string |
      number
  ): boolean {

    return this.followBusyIds.has(
      String(tweetuserId)
    );
  }


  // =========================================================
  // TOGGLE MONITOREO
  // =========================================================

  toggleFollowTweetUser(
    tuId:
      string |
      number,
    label: string
  ): void {

    const id =
      String(tuId);


    if (
      this.followBusyIds.has(id)
    ) {

      return;
    }


    const currently =
      this.isFollowingTweetUser(id);


    const ok =
      currently
        ? confirm(
            `¿Dejar de monitorear a "${label}"?`
          )
        : confirm(
            `¿Comenzar a monitorear a "${label}"?`
          );


    if (!ok) {

      return;
    }


    this.followBusyIds.add(id);


    // ===============================================
    // OPTIMISTIC UPDATE
    // ===============================================

    if (currently) {

      this.followingUsers.delete(id);

    } else {

      this.followingUsers.add(id);
    }


    const req$ =
      currently
        ? this.apiService
            .unfollowTweetUser(id)
        : this.apiService
            .followTweetUser(id);


    req$.subscribe({

      next: () => {

        this.followBusyIds.delete(id);


        this.showToast(

          currently
            ? 'info'
            : 'success',

          currently
            ? 'Fuente desactivada'
            : 'Fuente activada',

          currently
            ? `${label} dejó de formar parte del monitoreo.`
            : `${label} ahora forma parte del monitoreo.`
        );
      },


      error: (error) => {

        console.error(
          'Error actualizando monitoreo:',
          error
        );


        // ===========================================
        // ROLLBACK
        // ===========================================

        if (currently) {

          this.followingUsers.add(id);

        } else {

          this.followingUsers.delete(id);
        }


        this.followBusyIds.delete(id);


        this.showToast(
          'error',
          'No se pudo actualizar',
          'El monitoreo no pudo modificarse.'
        );
      }
    });
  }


  // =========================================================
  // ABRIR DRAWER
  // =========================================================

  openSourceDrawer(): void {

    this.user = null;

    this.searching = false;

    this.adding = false;

    this.sourceDrawerOpen = true;
  }


  // =========================================================
  // CERRAR DRAWER
  // =========================================================

  closeSourceDrawer(): void {

    this.sourceDrawerOpen = false;

    this.user = null;

    this.searching = false;

    this.adding = false;
  }


  // =========================================================
  // BUSCAR CUENTA EN X
  // =========================================================

  buscar(
    userName: string,
    id: string
  ): void {

    // ===============================================
    // PERMISO
    // ===============================================

    if (
      !this.canManageXUsers
    ) {

      this.showProRequired();

      return;
    }


    if (this.searching) {

      return;
    }


    const nameTrim =
      (userName || '')
        .trim()
        .replace(/^@/, '');


    const idTrim =
      (id || '')
        .trim();


    if (
      !nameTrim &&
      !idTrim
    ) {

      this.user = null;


      this.showToast(
        'warning',
        'Faltan datos',
        'Escribe un usuario de X o un ID.'
      );


      return;
    }


    this.searching = true;

    this.user = null;


    // =======================================================
    // BUSCAR POR USERNAME
    // =======================================================

    if (nameTrim) {

      this.apiService
        .searchbyname(
          nameTrim
        )
        .subscribe({

          next: (data) => {

            this.searching =
              false;


            this.user =
              data || null;


            if (!this.user) {

              this.showToast(
                'info',
                'Sin resultados',
                'No encontramos una cuenta con ese usuario.'
              );

              return;
            }


            this.showToast(
              'success',
              'Cuenta encontrada',
              `@${this.user.username} está lista para agregar.`
            );
          },


          error: (error) => {

            console.error(
              'Error buscando por username:',
              error
            );


            this.searching =
              false;


            this.user =
              null;


            this.showToast(
              'error',
              'No pudimos buscar la cuenta',
              'Intenta nuevamente.'
            );
          }
        });


      return;
    }


    // =======================================================
    // BUSCAR POR ID
    // =======================================================

    const numId =
      Number(idTrim);


    if (
      Number.isNaN(numId) ||
      numId <= 0
    ) {

      this.searching =
        false;


      this.showToast(
        'warning',
        'ID inválido',
        'El ID debe ser numérico y mayor a cero.'
      );


      return;
    }


    this.apiService
      .searchbyid(
        numId
      )
      .subscribe({

        next: (data) => {

          this.searching =
            false;


          this.user =
            data || null;


          if (!this.user) {

            this.showToast(
              'info',
              'Sin resultados',
              'No encontramos una cuenta con ese ID.'
            );


            return;
          }


          this.showToast(
            'success',
            'Cuenta encontrada',
            `@${this.user.username} está lista para agregar.`
          );
        },


        error: (error) => {

          console.error(
            'Error buscando por ID:',
            error
          );


          this.searching =
            false;


          this.user =
            null;


          this.showToast(
            'error',
            'No pudimos buscar la cuenta',
            'Intenta nuevamente.'
          );
        }
      });
  }


  // =========================================================
  // AGREGAR CUENTA
  // =========================================================

  agregar(
    userName: string,
    id:
      string |
      number,
    name: string,
    tipo: string
  ): void {

    // ===============================================
    // PERMISO
    // ===============================================

    if (
      !this.canManageXUsers
    ) {

      this.showProRequired();

      return;
    }


    if (this.adding) {

      return;
    }


    const username =
      (userName || '')
        .trim();


    const tid =
      String(
        id || ''
      )
        .trim();


    const display =
      (name || '')
        .trim();


    const tipoNorm =
      (tipo || '')
        .trim()
        .toLowerCase();


    if (
      !username ||
      !tid
    ) {

      this.showToast(
        'warning',
        'Busca una cuenta primero',
        'Selecciona una cuenta de X antes de continuar.'
      );


      return;
    }


    if (!tipoNorm) {

      this.showToast(
        'warning',
        'Falta la clasificación',
        'Indica si es un medio, persona o entidad.'
      );


      return;
    }


    // =======================================================
    // DUPLICADO
    // =======================================================

    const exists =
      this.users.some(
        u =>
          String(
            u.idTweetUser
          ) === tid
      );


    if (exists) {

      this.showToast(
        'info',
        'La fuente ya existe',
        `@${username} ya forma parte de NetVora.`
      );


      return;
    }


    // =======================================================
    // CONFIRMACIÓN
    // =======================================================

    const ok =
      confirm(
        `¿Agregar @${username} como ${tipoNorm}?`
      );


    if (!ok) {

      return;
    }


    this.adding = true;


    const newUser: users = {

      idTweetUser:
        tid,

      TweetUser:
        username,

      nameUser:
        display,

      tipeUser:
        tipoNorm
    };


    this.apiService
      .addUser(
        newUser
      )
      .subscribe({

        next: () => {

          this.adding =
            false;


          this.showToast(
            'success',
            'Fuente agregada',
            `@${username} ya está disponible en NetVora.`
          );


          this.closeSourceDrawer();


          this.loadUsers();
        },


        error: (error) => {

          console.error(
            'Error agregando fuente:',
            error
          );


          this.adding =
            false;


          this.showToast(
            'error',
            'No pudimos agregar la fuente',
            'Verifica que la cuenta no exista e intenta nuevamente.'
          );
        }
      });
  }


  // =========================================================
  // LIMPIAR BÚSQUEDA DEL DRAWER
  // =========================================================

  cancelarBusqueda(
    inputNombre?: HTMLInputElement,
    inputId?: HTMLInputElement
  ): void {

    this.user = null;


    if (inputNombre) {

      inputNombre.value = '';
    }


    if (inputId) {

      inputId.value = '';
    }
  }


  // =========================================================
  // PRO REQUIRED
  // =========================================================

  private showProRequired(): void {

    this.showToast(
      'warning',
      'Disponible con Pro',
      'Buscar y agregar nuevas fuentes de X requiere el plan Pro.'
    );
  }


  // =========================================================
  // TOAST
  // =========================================================

  showToast(
    type: ToastType,
    title: string,
    message: string,
    ms = 3200
  ): void {

    this.toast = {

      show: true,

      type,

      title,

      message
    };


    if (
      this.toastTimer
    ) {

      clearTimeout(
        this.toastTimer
      );
    }


    this.toastTimer =
      setTimeout(
        () =>
          this.hideToast(),
        ms
      );
  }


  hideToast(): void {

    this.toast.show =
      false;


    if (
      this.toastTimer
    ) {

      clearTimeout(
        this.toastTimer
      );
    }


    this.toastTimer =
      null;
  }
}