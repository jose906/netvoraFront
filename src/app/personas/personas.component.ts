import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { NewsData } from '../interfaces/NewsData';
import { NewsItem } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';
import { Dateformater } from '../utils/dateformater';
import { linkifyText } from '../utils/helpers'
import { toPng } from 'html-to-image';
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

// ajusta la ruta a tu interfaz
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
  selector: 'app-personas',
  templateUrl: './personas.component.html',
  styleUrl: './personas.component.css'
})
export class PersonasComponent implements OnInit {


  // =========================================================
    // DATOS
    // =========================================================
  
    datos: NewsItem[] = [];
  
    cargando = false;
    error = '';
    pulse: PulseData | null = null;
    cargandoPulse = false;
    errorPulse = '';
  
    private usersLoaded = false;
  
  
    // =========================================================
    // FILTROS
    // =========================================================
  
    startDate: Date | undefined = new Date();
    endDate: Date | undefined;
  
    searchText = '';
  
    users: users[] = [];
    selectedUsers: string[] = [];
  
  
    // =========================================================
    // PAGINACIÓN
    // =========================================================
  
    currentPage = 1;
    pageSize = 10;
    hasMore = false;
  
  
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
// PLAN / ACCESO
// =========================================================

accessLoading = true;

currentRole: UserRole = 'viewer';

subscriptionPlan = '';

subscriptionStatus = '';
  
  
    // =========================================================
    // GUARDADOS
    // =========================================================
  
    guardados = new Set<string>();
    savingIds = new Set<string>();
  
    errorGuardar = '';
  
  
    constructor(
  private apiService: ApiService,
  private router: Router,
  private authzService: AuthzService,
  private accountService: AccountService
) {}
  
  
    // =========================================================
    // INIT
    // =========================================================
  ngOnInit(): void {

  this.loadAccess();

}

// =========================================================
// CUENTA / PLAN / ROL
// =========================================================

private async loadAccess(): Promise<void> {

  this.accessLoading = true;

  try {

    if (!this.authzService.isLoaded()) {
      await this.authzService.refreshMe();
    }

    this.currentRole =
      this.authzService.role;

  } catch (error) {

    console.error(
      'Error cargando rol:',
      error
    );

    this.currentRole = 'viewer';

  }


  this.accountService
    .me()
    .subscribe({

      next: (
        res: AccountMeResponse
      ) => {

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


        this.accessLoading = false;


        // ===============================================
        // CARGA NORMAL
        // ===============================================

        this.loadUsers();

        this.cargarGuardados();


        // Si por alguna razón las publicaciones
        // ya estaban cargadas
        if (
          this.canViewReplies &&
          this.datos.length > 0
        ) {

          this.cargarReplies();

        }

      },


      error: (error) => {

        console.error(
          'Error cargando cuenta/plan:',
          error
        );

        this.subscriptionPlan = '';

        this.subscriptionStatus = '';

        this.accessLoading = false;

        this.repliesByTweet = {};


        // Seguimos mostrando publicaciones,
        // pero sin análisis de comentarios
        this.loadUsers();

        this.cargarGuardados();

      }

    });

}
  
  
    // =========================================================
    // CARGAR ENTIDADES
    // =========================================================
  
    loadUsers(): void {
  
    this.apiService
      .getUsers2('Persona')
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
    // LIMPIAR FILTROS
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
  
   
  
    this.cargandoPulse = true;
    this.errorPulse = '';
  
    const body: {
      type: 'Persona';
      startDate?: string;
      endDate?: string;
      users?: string[];
      searchText?: string;
    } = {
      type: 'Persona'
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
  
    } else if (this.users.length > 0) {
  
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
  
    this.apiService.getPulse(body).subscribe({
  
      next: (response: any) => {
  
        this.pulse = response?.pulse ?? null;
  
        this.cargandoPulse = false;
  
      },
  
      error: (err) => {
  
        console.error(
          'Error cargando Pulse:',
          err
        );
  
        this.errorPulse =
          'No se pudo cargar el pulso de las entidades.';
  
        this.pulse = null;
  
        this.cargandoPulse = false;
  
      }
  
    });
  
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
  
      this.cargando = true;
      this.error = '';
  
      this.datos = [];
      this.repliesByTweet = {};
  
  
      const body: {
        startDate?: string;
        endDate?: string;
        users?: string[];
        searchText?: string;
        page: number;
        limit: number;
      } = {
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
      // ENTIDADES
      // =======================================================
  
      if (
        selectedUsers &&
        selectedUsers.length > 0
      ) {
  
        body.users =
          selectedUsers.map(String);
  
      } else if (this.users.length > 0) {
  
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
  
  
      // =======================================================
      // API
      // =======================================================
  
      this.apiService
        .getPostPer(body)
        .subscribe({
  
          next: (data: any) => {
  
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
  
            if (this.canViewReplies) {

  this.cargarReplies();

} else {

  this.repliesByTweet = {};

}

this.cargando = false;
  
          },
  
          error: (error) => {
  
            console.error(
              'Error cargando publicaciones de entidades:',
              error
            );
  
            this.error =
              'No se pudieron cargar las publicaciones.';
  
            this.datos = [];
            this.repliesByTweet = {};
            this.hasMore = false;
  
            this.cargando = false;
  
          }
  
        });
    }
  
  
    // =========================================================
    // REPLIES
    // =========================================================
  
    cargarReplies(): void {

  // =====================================================
  // PERMISO
  // ADMIN O PRO ACTIVO
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
    // NETVORA PULSE
    // Datos reales del período seleccionado
    // =========================================================
  
   get totalPublicaciones(): number {
    return this.pulse?.total_posts ?? 0;
  }
  
  
  get totalPersonas(): number {
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
// ADMIN
// =========================================================

get isAdmin(): boolean {

  return (
    this.currentRole === 'admin'
  );

}


// =========================================================
// PRO
// =========================================================

get isPro(): boolean {

  return (
    this.normalizedPlan === 'pro'
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
// PERMISO PARA COMENTARIOS
// =========================================================

get canViewReplies(): boolean {

  if (this.isAdmin) {
    return true;
  }

  return (
    this.isPro &&
    this.subscriptionIsActive
  );

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
    // CATEGORÍAS
    // =========================================================
  
    private normCat(
      cat?: string
    ): string {
  
      return (
        cat ||
        'otros'
      )
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .trim();
    }
  
  
    categoryClass(
      cat?: string
    ): string {
  
      const c =
        this.normCat(cat);
  
  
      if (c.includes('econom')) {
        return 'cat-economia';
      }
  
      if (c.includes('polit')) {
        return 'cat-politica';
      }
  
      if (c.includes('segur')) {
        return 'cat-seguridad';
      }
  
      if (c.includes('deport')) {
        return 'cat-deportes';
      }
  
      if (c.includes('educ')) {
        return 'cat-educacion';
      }
  
      if (c.includes('salud')) {
        return 'cat-salud';
      }
  
      if (
        c.includes('socied') ||
        c.includes('social')
      ) {
        return 'cat-sociedad';
      }
  
      if (
        c.includes('ambient')
      ) {
        return 'cat-ambiente';
      }
  
      if (
        c.includes('gestion')
      ) {
        return 'cat-gestiones';
      }
  
  
      return 'cat-otros';
    }
  
  
    // =========================================================
    // GUARDADOS
    // =========================================================
  
    toggleGuardar(
      item: NewsItem
    ): void {
  
      const id =
        String(item.tweetid);
  
  
      if (
        this.savingIds.has(id)
      ) {
        return;
      }
  
  
      this.errorGuardar = '';
      this.savingIds.add(id);
  
  
      if (
        this.guardados.has(id)
      ) {
  
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
    // FECHA
    // =========================================================
  
    private toYMD(
      date: Date
    ): string {
  
      const year =
        date.getFullYear();
  
      const month =
        String(
          date.getMonth() + 1
        ).padStart(
          2,
          '0'
        );
  
      const day =
        String(
          date.getDate()
        ).padStart(
          2,
          '0'
        );
  
  
      return (
        `${year}-${month}-${day}`
      );
    }
  
  
    formatBoliviaDate(
      value: unknown
    ): string {
  
      if (!value) {
        return '';
      }
  
  
      let date: Date;
  
  
      if (
        value instanceof Date
      ) {
  
        date =
          new Date(
            value.getTime()
          );
  
      } else {
  
        let raw =
          String(value)
            .trim()
            .replace(
              ' ',
              'T'
            );
  
  
        if (
          !/(?:Z|[+-]\d{2}:?\d{2})$/i
            .test(raw)
        ) {
          raw += 'Z';
        }
  
  
        date =
          new Date(raw);
  
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
          timeZone:
            'America/La_Paz',
  
          day:
            '2-digit',
  
          month:
            '2-digit',
  
          year:
            'numeric',
  
          hour:
            '2-digit',
  
          minute:
            '2-digit',
  
          hour12:
            false
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
    // DETALLE
    // =========================================================
  
    irADetalle(
      datos: NewsItem
    ): void {
  
      this.router.navigate(
        ['/resumen'],
        {
          state: {
            datos
          }
        }
      );
    }
  
  
    // =========================================================
    // DESCARGAR
    // =========================================================
  
    async downloadCard(
      cardElement: HTMLElement,
      tweetId: string | number
    ): Promise<void> {
  
      if (!cardElement) {
        return;
      }
  
  
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
  
        link.href =
          dataUrl;
  
        link.download =
          `entidad-${tweetId}.png`;
  
        link.click();
  
      } catch (error) {
  
        console.error(
          'Error descargando publicación:',
          error
        );
  
      }
    }

    

}
