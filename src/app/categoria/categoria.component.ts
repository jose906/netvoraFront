import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../services/api.service';

import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import { AccountService} from '../services/account.service';
import { AccountMeResponse } from '../interfaces/me';
import { linkifyText } from '../utils/helpers';
import { toPng } from 'html-to-image';
import { AuthzService,UserRole } from '../services/authz.service';

interface CategoryOption {
  label: string;
  value: string;
  path: string;
}
interface PulseActivity {
  date: string;
  total: number;
}

interface PulseSentiment {
  positivo: number;
  neutro: number;
  negativo: number;
}

interface PulseData {
  total_posts: number;
  total_sources: number;
  total_comments: number;
  dominant_sentiment: string;
  sentiment: PulseSentiment;
  activity_7d: PulseActivity[];
}


@Component({
  selector: 'app-categoria',
  templateUrl: './categoria.component.html',
  styleUrl: './categoria.component.css'
})
export class CategoriaComponent implements OnInit {

  // =========================================================
  // CATEGORÍA
  // =========================================================

  categoria: string = '';
  categoriaLabel: string = '';
  selectedCategoryPath: string = '';
  pulse: PulseData | null = null;
cargandoPulse = false;
errorPulse = '';


  categories: CategoryOption[] = [
    {
      label: 'Política',
      value: 'Politica',
      path: 'politica'
    },
    {
      label: 'Economía',
      value: 'Economia',
      path: 'economia'
    },
    {
      label: 'Seguridad',
      value: 'Seguridad',
      path: 'seguridad'
    },
    {
      label: 'Deportes',
      value: 'Deportes',
      path: 'deportes'
    },
    {
      label: 'Medio Ambiente',
      value: 'Ambiente',
      path: 'ambiente'
    },
    {
      label: 'Salud',
      value: 'Salud',
      path: 'salud'
    },
    {
      label: 'Sociedad',
      value: 'Social',
      path: 'social'
    },
    {
      label: 'Educación',
      value: 'Educacion',
      path: 'educacion'
    },
    {
      label: 'Gestiones públicas',
      value: 'Gestiones',
      path: 'gestiones'
    },
    {
      label: 'Otros temas',
      value: 'Otros',
      path: 'otros'
    }
  ];


  // =========================================================
  // DATOS
  // =========================================================

  datos: NewsItem[] = [];

  cargando: boolean = false;
  error: string = '';


  // =========================================================
  // FILTROS
  // =========================================================

  startDate: Date | undefined = new Date();
  endDate: Date | undefined;

  searchText: string = '';

  users: users[] = [];
  selectedUsers: string[] = [];


  // =========================================================
  // PAGINACIÓN
  // =========================================================

  currentPage: number = 1;
  pageSize: number = 10;
  hasMore: boolean = false;


  // =========================================================
  // REPLIES
  // =========================================================

  repliesByTweet: Record<
    string,
    {
      negativo: number;
      neutro: number;
      positivo: number;
    }
  > = {};


  // =========================================================
// PLAN / PERMISOS
// =========================================================


// =========================================================
// PLAN / ACCESO
// =========================================================

subscriptionPlan = '';
subscriptionStatus = '';

accessLoading = true;

currentRole: UserRole = 'viewer';

  // =========================================================
  // GUARDADOS
  // =========================================================

  guardados = new Set<string>();
  savingIds = new Set<string>();

  errorGuardar: string = '';

  private usersLoaded = false;


 constructor(
  private apiService: ApiService,
  private accountService: AccountService,
  private authzService: AuthzService,
  private route: ActivatedRoute,
  private router: Router
) {}

  // =========================================================
  // INIT
  // =========================================================

 ngOnInit(): void {

  this.route.data.subscribe(data => {

    this.categoria =
      String(
        data['categoria'] ?? ''
      );

    this.categoriaLabel =
      String(
        data['categoriaLabel'] ??
        this.categoria
      );

    this.selectedCategoryPath =
      String(
        data['categoryPath'] ?? ''
      );


    if (
      this.usersLoaded &&
      this.categoria
    ) {

      this.currentPage = 1;

      this.load(
        this.startDate,
        this.endDate,
        this.selectedUsers,
        1,
        this.searchText
      );

      this.loadPulse();

    }

  });


  this.loadAccess();

}


  // =========================================================
  // CAMBIAR CATEGORÍA
  // =========================================================

  cambiarCategoria(): void {

    if (!this.selectedCategoryPath) {
      return;
    }

    this.router.navigate([
      '/',
      this.selectedCategoryPath
    ]);
  }


  // =========================================================
  // USUARIOS
  // =========================================================

  loadUsers(): void {

  this.apiService
    .getUsers2('Medio')
    .subscribe({

      next: (data: users[]) => {

        this.users = data ?? [];
        this.usersLoaded = true;

        this.currentPage = 1;

        this.load(
          this.startDate,
          this.endDate,
          this.users.map(
            u =>
              u.idTweetUser.toString()
          ),
          1,
          this.searchText
        );

        this.loadPulse();

      },

      error: (err) => {

        console.error(
          'Error cargando usuarios',
          err
        );

        this.usersLoaded = true;

      }

    });

}


  // =========================================================
  // FILTRAR
  // =========================================================

 filtrar(): void {

  this.currentPage = 1;

  this.load(
    this.startDate,
    this.endDate,
    this.selectedUsers,
    1,
    this.searchText
  );

  this.loadPulse();

}


  // =========================================================
  // LIMPIAR
  // =========================================================

  resetFiltros(): void {

  this.startDate = undefined;
  this.endDate = undefined;
  this.selectedUsers = [];
  this.searchText = '';

  this.currentPage = 1;

  this.load(
    undefined,
    undefined,
    [],
    1,
    ''
  );

  this.loadPulse();

}

loadPulse(): void {

  if (!this.categoria) {
    return;
  }

  this.cargandoPulse = true;
  this.errorPulse = '';

  const body: {
    type: 'Medio';
    categoria: string;
    startDate?: string;
    endDate?: string;
    users?: string[];
    searchText?: string;
  } = {
    type: 'Medio',
    categoria: this.categoria
  };


  // =====================================================
  // FECHAS
  // =====================================================

  if (this.startDate) {
    body.startDate = this.toYMD(this.startDate);
  }

  if (this.endDate) {
    body.endDate = this.toYMD(this.endDate);
  }


  // =====================================================
  // USUARIOS
  // =====================================================

  if (this.selectedUsers?.length) {

    body.users = this.selectedUsers.map(String);

  } else {

    body.users = this.users.map(
      user => String(user.idTweetUser)
    );

  }


  // =====================================================
  // BÚSQUEDA
  // =====================================================

  const text = this.searchText.trim();

  if (text) {
    body.searchText = text;
  }


  // =====================================================
  // API
  // =====================================================

  this.apiService
    .getPulse(body)
    .subscribe({

      next: (response: any) => {

        this.pulse =
          response?.pulse ?? null;

        this.cargandoPulse = false;

      },

      error: (error) => {

        console.error(
          'Error cargando Pulse:',
          error
        );

        this.errorPulse =
          'No se pudo cargar el pulso de la conversación.';

        this.pulse = null;

        this.cargandoPulse = false;

      }

    });

}
// =========================================================
// CUENTA / PLAN
// =========================================================




private inicializarContenido(): void {

  this.loadUsers();
  this.cargarGuardados();

}

  // =========================================================
  // CARGAR PUBLICACIONES
  // =========================================================

  load(
    startDate?: Date,
    endDate?: Date,
    selectedUsers?: string[],
    pageToLoad: number = 1,
    searchText: string = ''
  ): void {

    if (!this.categoria) {

      this.error =
        'No se pudo determinar la categoría.';

      return;
    }


    this.cargando = true;
    this.error = '';

    this.datos = [];
    this.repliesByTweet = {};


    const body: {
      categoria: string;
      startDate?: string;
      endDate?: string;
      users?: string[];
      searchText?: string;
      page: number;
      limit: number;
    } = {

      categoria: this.categoria,

      page: pageToLoad,
      limit: this.pageSize

    };


    // =======================================================
    // FECHAS
    // =======================================================

    if (startDate) {
      body.startDate =
        this.toYMD(startDate);
    }

    if (endDate) {
      body.endDate =
        this.toYMD(endDate);
    }


    // =======================================================
    // MEDIOS
    // =======================================================

    if (
      selectedUsers &&
      selectedUsers.length > 0
    ) {

      body.users =
        selectedUsers.map(String);

    } else {

      body.users =
        this.users.map(
          user =>
            String(user.idTweetUser)
        );

    }


    // =======================================================
    // BÚSQUEDA
    // =======================================================

    const text =
      searchText.trim();

    if (text) {
      body.searchText = text;
    }

    console.log(
      'Cargando categoría:',
      this.categoria,
      'con filtros:',
      body
    );
    // =======================================================
    // API
    // =======================================================

    this.apiService
      .getPostsCategoria(body)
      .subscribe({

        next: (data: any) => {
          console.log('Datos recibidos de la API:', data);
          this.datos =
            data?.resultado ??
            data?.items ??
            data?.data ??
            [];

          this.currentPage =
            Number(
              data?.page ??
              pageToLoad
            );

          this.hasMore =
            this.datos.length ===
            this.pageSize;

          this.cargarReplies();

          this.cargando = false;
        },

        error: (error) => {

          console.error(
            `Error cargando categoría ${this.categoria}:`,
            error
          );

          this.error =
            'No se pudieron cargar las publicaciones.';

          this.datos = [];
          this.hasMore = false;
          this.repliesByTweet = {};

          this.cargando = false;
        }

      });
  }


  // =========================================================
  // REPLIES
  // =========================================================

  // =========================================================
// REPLIES / COMENTARIOS
// Solo disponible para PLAN PRO
// =========================================================

cargarReplies(): void {

  // =====================================================
  // SOLO PLAN PRO
  // =====================================================

 if (!this.canViewReplies) {

  this.repliesByTweet = {};

  return;

}


  // =====================================================
  // IDS
  // =====================================================

  const tweetIds =
    this.datos.map(
      item =>
        String(item.tweetid)
    );


  if (!tweetIds.length) {

    this.repliesByTweet = {};

    return;

  }


  // =====================================================
  // API
  // =====================================================

  this.apiService
    .getRepliesSummaryMany(tweetIds)
    .subscribe({

      next: (rows: any[]) => {

        const map: Record<
          string,
          {
            negativo: number;
            neutro: number;
            positivo: number;
          }
        > = {};


        for (const row of rows || []) {

          const key =
            String(row.tweetid);


          if (!map[key]) {

            map[key] = {
              negativo: 0,
              neutro: 0,
              positivo: 0
            };

          }


          const sentimiento =
            String(
              row.sentimiento ?? ''
            )
              .trim()
              .toLowerCase();


          const total =
            Number(row.total) || 0;


          if (
            sentimiento === 'negativo'
          ) {

            map[key].negativo =
              total;

          }


          if (
            sentimiento === 'neutro'
          ) {

            map[key].neutro =
              total;

          }


          if (
            sentimiento === 'positivo'
          ) {

            map[key].positivo =
              total;

          }

        }


        this.repliesByTweet =
          map;

      },


      error: (error) => {

        console.error(
          'Error cargando comentarios:',
          error
        );

        this.repliesByTweet = {};

      }

    });

}

  getRepliesCounts(
    tweetid: string | number
  ) {

    return (
      this.repliesByTweet[
        String(tweetid)
      ] ??
      {
        negativo: 0,
        neutro: 0,
        positivo: 0
      }
    );
  }
  // =========================================================
// RESUMEN VISUAL - NETVORA PULSE
// Solo usa los datos que ya están cargados
// =========================================================

get totalPublicaciones(): number {
  return this.pulse?.total_posts ?? 0;
}


get totalMedios(): number {
  return this.pulse?.total_sources ?? 0;
}


get totalComentarios(): number {
  return this.pulse?.total_comments ?? 0;
}


get positivos(): number {
  return this.pulse?.sentiment?.positivo ?? 0;
}


get neutros(): number {
  return this.pulse?.sentiment?.neutro ?? 0;
}


get negativos(): number {
  return this.pulse?.sentiment?.negativo ?? 0;
}


get totalSentimientos(): number {

  return (
    this.positivos +
    this.neutros +
    this.negativos
  );

}


get porcentajePositivo(): number {

  if (!this.totalSentimientos) {
    return 0;
  }

  return Math.round(
    (
      this.positivos /
      this.totalSentimientos
    ) * 100
  );

}


get porcentajeNeutro(): number {

  if (!this.totalSentimientos) {
    return 0;
  }

  return Math.round(
    (
      this.neutros /
      this.totalSentimientos
    ) * 100
  );

}


get porcentajeNegativo(): number {

  if (!this.totalSentimientos) {
    return 0;
  }

  return Math.round(
    (
      this.negativos /
      this.totalSentimientos
    ) * 100
  );

}


get sentimientoDominante(): string {

  const value =
    this.pulse?.dominant_sentiment;

  if (!value || value === 'sin datos') {
    return 'Sin datos';
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );

}
get pulseActivity(): PulseActivity[] {
  return this.pulse?.activity_7d ?? [];
}


get pulseMax(): number {

  if (!this.pulseActivity.length) {
    return 0;
  }

  return Math.max(
    ...this.pulseActivity.map(
      item => item.total
    )
  );

}


get pulseTotal7d(): number {

  return this.pulseActivity.reduce(
    (total, item) =>
      total + item.total,
    0
  );

}


get pulseAverage7d(): number {

  if (!this.pulseActivity.length) {
    return 0;
  }

  return Math.round(
    this.pulseTotal7d /
    this.pulseActivity.length
  );

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
// PLAN PRO
// =========================================================

get isPro(): boolean {

  return (
    this.normalizedPlan === 'pro' &&
    this.subscriptionIsActive
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

  return (
    status === 'activo' ||
    status === 'activa' ||
    status === 'active'
  );
}

// =========================================================
// ADMIN
// =========================================================

get isAdmin(): boolean {

  return (
    this.currentRole === 'admin'
  );

}


// =========================================================
// PERMISO REPLIES
// =========================================================

get canViewReplies(): boolean {

  // Admin siempre puede ver comentarios
  if (this.isAdmin) {
    return true;
  }

  // Usuario normal necesita Pro activo
  return (
    this.isPro &&
    this.subscriptionIsActive
  );

}
// =========================================================
// CARGAR PLAN / ACCESO
// =========================================================

private loadAccess(): void {

  this.accessLoading = true;

  this.accountService
    .me()
    .subscribe({

      next: (
        res: AccountMeResponse
      ) => {

        // ===============================================
        // PLAN
        // ===============================================

        // ===============================================
// ROL
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


        this.accessLoading = false;


        console.log(
          'Plan:',
          this.subscriptionPlan,
          'Status:',
          this.subscriptionStatus,
          'Pro:',
          this.isPro
        );


        // Ya conocemos el plan.
        // Ahora podemos cargar el contenido.
        this.loadUsers();

        this.cargarGuardados();

      },


      error: (error) => {

        console.error(
          'Error cargando cuenta/plan:',
          error
        );

        this.subscriptionPlan = '';
        this.subscriptionStatus = '';

        this.accessLoading = false;


        // Aunque falle la consulta del plan,
        // cargamos las publicaciones,
        // pero NO habilitamos comentarios Pro.

        this.loadUsers();

        this.cargarGuardados();

      }

    });
}


getPulseHeight(total: number): number {

  if (!this.pulseMax) {
    return 0;
  }

  return Math.max(
    8,
    Math.round(
      (total / this.pulseMax) * 100
    )
  );

}


formatPulseDate(date: string): string {

  if (!date) {
    return '';
  }

  const parts = date.split('-');

  if (parts.length !== 3) {
    return date;
  }

  const monthNames = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic'
  ];

  const month =
    Number(parts[1]) - 1;

  return `${Number(parts[2])} ${monthNames[month]}`;

}

  // =========================================================
  // PAGINACIÓN
  // =========================================================

  loadNextPage(): void {

    if (!this.hasMore) {
      return;
    }

    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      this.currentPage + 1,
      this.searchText
    );
  }


  loadPreviousPage(): void {

    if (this.currentPage <= 1) {
      return;
    }

    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      this.currentPage - 1,
      this.searchText
    );
  }


  // =========================================================
  // GUARDADOS
  // =========================================================

  toggleGuardar(
    item: NewsItem
  ): void {

    const id =
      String(item.tweetid);

    if (this.savingIds.has(id)) {
      return;
    }

    this.errorGuardar = '';
    this.savingIds.add(id);


    if (this.guardados.has(id)) {

      this.apiService
        .borrarGuardado(id)
        .subscribe({

          next: () => {

            this.guardados.delete(id);
            this.savingIds.delete(id);

          },

          error: () => {

            this.errorGuardar =
              'No se pudo quitar de guardados.';

            this.savingIds.delete(id);

          }

        });

      return;
    }


    this.apiService
      .guardarTweet(id)
      .subscribe({

        next: () => {

          this.guardados.add(id);
          this.savingIds.delete(id);

        },

        error: () => {

          this.errorGuardar =
            'No se pudo guardar.';

          this.savingIds.delete(id);

        }

      });
  }


  cargarGuardados(): void {

    this.apiService
      .getGuardados()
      .subscribe({

        next: (res: any) => {

          const rows =
            res?.items ??
            res?.resultado ??
            [];

          this.guardados =
            new Set(
              rows.map(
                (row: any) =>
                  String(row.tweetid)
              )
            );

        },

        error: () => {

          this.guardados =
            new Set<string>();

        }

      });
  }

  


  isGuardado(
    tweetid: string | number
  ): boolean {

    return this.guardados.has(
      String(tweetid)
    );
  }


  // =========================================================
  // FECHAS
  // =========================================================

  private toYMD(
    date: Date
  ): string {

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }


  formatBoliviaDate(
    value: unknown
  ): string {

    if (!value) {
      return '';
    }

    let date: Date;

    if (value instanceof Date) {

      date =
        new Date(value.getTime());

    } else {

      let raw =
        String(value)
          .trim()
          .replace(' ', 'T');

      if (
        !/(?:Z|[+-]\d{2}:?\d{2})$/i
          .test(raw)
      ) {
        raw += 'Z';
      }

      date = new Date(raw);

    }

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      'es-BO',
      {
        timeZone: 'America/La_Paz',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }
    ).format(date);
  }


  // =========================================================
  // TEXTO
  // =========================================================

  formatText(
    text: string
  ): string {

    return linkifyText(text);
  }


  // =========================================================
  // DESCARGAR
  // =========================================================

  async downloadCard(
    cardElement: HTMLElement,
    tweetId: string | number
  ): Promise<void> {

    try {

      const dataUrl =
        await toPng(
          cardElement,
          {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true
          }
        );

      const link =
        document.createElement('a');

      link.href = dataUrl;

      link.download =
        `${this.categoria.toLowerCase()}-${tweetId}.png`;

      link.click();

    } catch (error) {

      console.error(
        'Error descargando publicación:',
        error
      );

    }
  }
}