import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { ApiService } from '../services/api.service';

import {
  TopicItem,
  TopicOption
} from '../interfaces/NewsItem';

import { users } from '../interfaces/users';

import { linkifyText } from '../utils/helpers';
import { toPng } from 'html-to-image';

import { AccountService } from '../services/account.service';
import { AccountMeResponse } from '../interfaces/me';

import {
  AuthzService,
  UserRole
} from '../services/authz.service';


// =========================================================
// PULSE
// =========================================================

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
  selector: 'app-topics',
  templateUrl: './topics.component.html',
  styleUrl: './topics.component.css'
})
export class TopicsComponent implements OnInit {


  // =========================================================
  // DATOS
  // =========================================================

  datos: TopicItem[] = [];

  cargando: boolean = false;
  error: string = '';


  // =========================================================
  // TÓPICO
  // =========================================================

  topics: TopicOption[] = [];

  topicId: number | null = null;
  topicName: string = '';


  // =========================================================
  // PULSE
  // =========================================================

  pulse: PulseData | null = null;

  cargandoPulse: boolean = false;
  errorPulse: string = '';


  // =========================================================
  // FILTROS
  // =========================================================

  /*
   * Al entrar mostramos inicialmente
   * publicaciones del día actual.
   */
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
  // ACCESO / PLAN
  // =========================================================

  accessLoading: boolean = true;

  currentRole: UserRole = 'viewer';

  subscriptionPlan: string = '';

  subscriptionStatus: string = '';


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


  loadingReplies: Record<
    string,
    boolean
  > = {};


  // =========================================================
  // GUARDADOS
  // =========================================================

  guardados =
    new Set<string>();

  savingIds =
    new Set<string>();

  errorGuardar: string = '';


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private authzService: AuthzService,
    private accountService: AccountService
  ) {}


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    const navigationState =
      history.state;


    // =======================================================
    // TÓPICO DESDE HISTORY.STATE
    // =======================================================

    if (
      navigationState?.topic_id
    ) {

      this.topicId =
        Number(
          navigationState.topic_id
        );

    }


    if (
      navigationState?.topic_name
    ) {

      this.topicName =
        String(
          navigationState.topic_name
        );

    }


    // =======================================================
    // FILTROS DESDE DASHBOARD
    // =======================================================

    if (
      navigationState?.startDate
    ) {

      this.startDate =
        this.parseNavigationDate(
          navigationState.startDate
        );

    }


    if (
      navigationState?.endDate
    ) {

      this.endDate =
        this.parseNavigationDate(
          navigationState.endDate
        );

    }


    if (
      Array.isArray(
        navigationState
          ?.selectedUsers
      )
    ) {

      this.selectedUsers =
        navigationState
          .selectedUsers
          .map(
            (id: unknown) =>
              String(id)
          )
          .filter(Boolean);

    }


    if (
      typeof navigationState
        ?.searchText ===
      'string'
    ) {

      this.searchText =
        navigationState
          .searchText;

    }


    // =======================================================
    // TÓPICO DESDE URL
    // =======================================================

    if (!this.topicId) {

      const routeId =
        this.route
          .snapshot
          .paramMap
          .get(
            'topic_id'
          );


      if (routeId) {

        const parsed =
          Number(routeId);


        if (
          Number.isFinite(parsed) &&
          parsed > 0
        ) {

          this.topicId =
            parsed;

        }

      }

    }


    // =======================================================
    // CARGAS INICIALES
    // =======================================================

    this.loadAccess();

    this.loadUsers();

    this.loadTopics();

    this.cargarGuardados();

  }


  // =========================================================
  // ACCESO / PLAN
  // =========================================================

  private async loadAccess(): Promise<void> {

    this.accessLoading = true;


    try {

      if (
        !this.authzService
          .isLoaded()
      ) {

        await this.authzService
          .refreshMe();

      }


      this.currentRole =
        this.authzService.role;

    }

    catch (error) {

      console.error(
        'Error cargando rol:',
        error
      );


      this.currentRole =
        'viewer';

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

          if (
            res?.user?.role
          ) {

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
              .trim() ||
            '';


          // ===============================================
          // ESTADO
          // ===============================================

          this.subscriptionStatus =
            res?.subscription?.status
              ?.toString()
              .trim()
              .toLowerCase() ||
            '';


          this.accessLoading =
            false;


          // ===============================================
          // CARGAR REPLIES SI YA HAY POSTS
          // ===============================================

          if (
            this.canViewReplies &&
            this.datos.length > 0
          ) {

            this.cargarReplies();

          }

        },


        error: (error) => {

          console.error(
            'Error cargando plan:',
            error
          );


          this.subscriptionPlan =
            '';

          this.subscriptionStatus =
            '';

          this.accessLoading =
            false;

          this.repliesByTweet =
            {};

        }

      });

  }


  // =========================================================
  // PLAN NORMALIZADO
  // =========================================================

  get normalizedPlan(): string {

    return (
      this.subscriptionPlan ||
      ''
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
      this.currentRole ===
      'admin'
    );

  }


  // =========================================================
  // PRO
  // =========================================================

  get isPro(): boolean {

    return (
      this.normalizedPlan ===
      'pro'
    );

  }


  // =========================================================
  // SUSCRIPCIÓN ACTIVA
  // =========================================================

  get subscriptionIsActive(): boolean {

    const status =
      (
        this.subscriptionStatus ||
        ''
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
  // PERMISO REPLIES
  // =========================================================

  get canViewReplies(): boolean {

    /*
     * Admin siempre puede ver.
     */
    if (
      this.isAdmin
    ) {

      return true;

    }


    /*
     * Usuario normal:
     * Pro + suscripción activa.
     */
    return (
      this.isPro &&
      this.subscriptionIsActive
    );

  }


  // =========================================================
  // CARGAR USUARIOS
  // =========================================================

  loadUsers(): void {

    this.apiService
      .getUsers2(
        'Medio'
      )
      .subscribe({

        next: (data) => {

          this.users =
            Array.isArray(data)
              ? data
              : [];


          if (
            this.topicId
          ) {

            this.load(
              this.startDate,
              this.endDate,
              this.selectedUsers,
              1,
              this.searchText
            );


            this.loadPulse();

          }

        },


        error: (error) => {

          console.error(
            'Error cargando usuarios:',
            error
          );


          this.users =
            [];


          /*
           * Aunque falle la carga
           * de medios, intentamos
           * cargar el tópico.
           */
          if (
            this.topicId
          ) {

            this.load(
              this.startDate,
              this.endDate,
              this.selectedUsers,
              1,
              this.searchText
            );


            this.loadPulse();

          }

        }

      });

  }


  // =========================================================
  // CARGAR LISTA DE TÓPICOS
  // =========================================================

  loadTopics(): void {

    this.apiService
      .getTopics()
      .subscribe({

        next: (
          data: TopicOption[]
        ) => {

          this.topics =
            Array.isArray(data)
              ? data
              : [];


          /*
           * Si recargamos /topics/:id,
           * buscamos el nombre.
           */
          if (
            this.topicId &&
            !this.topicName
          ) {

            const selected =
              this.topics.find(
                topic =>
                  Number(
                    topic.topic_id
                  ) ===
                  Number(
                    this.topicId
                  )
              );


            if (selected) {

              this.topicName =
                selected.topic_name;

            }

          }

        },


        error: (error) => {

          console.error(
            'Error cargando tópicos:',
            error
          );


          this.topics =
            [];

        }

      });

  }


  // =========================================================
  // CAMBIAR TÓPICO
  // =========================================================

  cambiarTopico(): void {

    if (
      !this.topicId
    ) {

      return;

    }


    const selected =
      this.topics.find(
        topic =>
          Number(
            topic.topic_id
          ) ===
          Number(
            this.topicId
          )
      );


    this.topicName =
      selected?.topic_name ??
      '';


    this.currentPage =
      1;


    /*
     * Limpiamos el Pulse anterior
     * mientras se carga el nuevo.
     */
    this.pulse =
      null;

    this.errorPulse =
      '';


    // =======================================================
    // ACTUALIZAR URL
    // =======================================================

    this.router.navigate(
      [
        '/topics',
        this.topicId
      ],
      {

        replaceUrl: true,

        state: {

          topic_id:
            this.topicId,

          topic_name:
            this.topicName,

          startDate:
            this.startDate
              ? this.toYMD(
                  this.startDate
                )
              : null,

          endDate:
            this.endDate
              ? this.toYMD(
                  this.endDate
                )
              : null,

          selectedUsers: [
            ...this.selectedUsers
          ],

          searchText:
            this.searchText

        }

      }
    );


    // =======================================================
    // RECARGAR
    // =======================================================

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
  // FILTRAR
  // =========================================================

  filtrar(): void {

    if (
      !this.topicId
    ) {

      this.error =
        'Selecciona un tópico.';

      return;

    }


    this.currentPage =
      1;


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

    /*
     * Conservamos:
     * topicId
     * topicName
     */

    this.startDate =
      undefined;

    this.endDate =
      undefined;

    this.selectedUsers =
      [];

    this.searchText =
      '';

    this.currentPage =
      1;


    if (
      this.topicId
    ) {

      this.load(
        undefined,
        undefined,
        [],
        1,
        ''
      );


      this.loadPulse();

    }

  }


  // =========================================================
  // PULSE DEL TÓPICO
  // =========================================================

  loadPulse(): void {

    if (
      !this.topicId
    ) {

      this.pulse =
        null;

      return;

    }


    this.cargandoPulse =
      true;

    this.errorPulse =
      '';


    const body: {

      topicId: number;

      startDate?: string;

      endDate?: string;

      users?: string[];

      searchText?: string;

    } = {

      topicId:
        this.topicId

    };


    // =======================================================
    // FECHA INICIAL
    // =======================================================

    if (
      this.startDate
    ) {

      body.startDate =
        this.toYMD(
          this.startDate
        );

    }


    // =======================================================
    // FECHA FINAL
    // =======================================================

    if (
      this.endDate
    ) {

      body.endDate =
        this.toYMD(
          this.endDate
        );

    }


    // =======================================================
    // MEDIOS
    // =======================================================

    if (
      this.selectedUsers &&
      this.selectedUsers.length > 0
    ) {

      body.users =
        this.selectedUsers
          .map(String);

    }

    else {

      body.users =
        this.users.map(
          user =>
            String(
              user.idTweetUser
            )
        );

    }


    // =======================================================
    // TEXTO
    // =======================================================

    const text =
      this.searchText
        .trim();


    if (text) {

      body.searchText =
        text;

    }


    // =======================================================
    // API
    // =======================================================

    this.apiService
      .getTopicPulse(
        body
      )
      .subscribe({

        next: (
          response: any
        ) => {

          this.pulse =
            response?.pulse ??
            null;


          this.cargandoPulse =
            false;

        },


        error: (error) => {

          console.error(
            'Error cargando Pulse del tópico:',
            error
          );


          this.errorPulse =
            'No se pudo cargar el pulso del tópico.';


          this.pulse =
            null;


          this.cargandoPulse =
            false;

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

    if (
      !this.topicId
    ) {

      this.error =
        'Selecciona un tópico.';

      return;

    }


    this.cargando =
      true;

    this.error =
      '';

    this.datos =
      [];

    this.repliesByTweet =
      {};


    const body: {

      topicId: number;

      startDate?: string;

      endDate?: string;

      users?: string[];

      searchText?: string;

      page: number;

      limit: number;

    } = {

      topicId:
        this.topicId,

      page:
        pageToLoad,

      limit:
        this.pageSize

    };


    // =======================================================
    // FECHAS
    // =======================================================

    if (
      startDate
    ) {

      body.startDate =
        this.toYMD(
          startDate
        );

    }


    if (
      endDate
    ) {

      body.endDate =
        this.toYMD(
          endDate
        );

    }


    // =======================================================
    // USUARIOS
    // =======================================================

    if (
      selectedUsers &&
      selectedUsers.length > 0
    ) {

      body.users =
        selectedUsers
          .map(String);

    }

    else {

      body.users =
        this.users.map(
          user =>
            String(
              user.idTweetUser
            )
        );

    }


    // =======================================================
    // TEXTO
    // =======================================================

    const text =
      searchText
        ?.trim();


    if (text) {

      body.searchText =
        text;

    }


    // =======================================================
    // API
    // =======================================================

    this.apiService
      .getTopic(
        body
      )
      .subscribe({

        next: (
          data: any
        ) => {


          // ===============================================
          // NORMALIZAR RESPUESTA
          // ===============================================

          if (
            Array.isArray(data)
          ) {

            this.datos =
              data;


            this.currentPage =
              pageToLoad;

          }

          else {

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

          }


          // ===============================================
          // NOMBRE DEL TÓPICO
          // ===============================================

          if (
            this.datos.length > 0 &&
            this.datos[0].topic_name
          ) {

            this.topicName =
              this.datos[0]
                .topic_name;

          }


          // ===============================================
          // PAGINACIÓN
          // ===============================================

          this.hasMore =
            this.datos.length ===
            this.pageSize;


          // ===============================================
          // REPLIES
          // ===============================================

          if (
            this.canViewReplies
          ) {

            this.cargarReplies();

          }

          else {

            this.repliesByTweet =
              {};

          }


          this.cargando =
            false;

        },


        error: (error) => {

          console.error(
            'Error cargando tópico:',
            error
          );


          this.error =
            'No se pudieron cargar las publicaciones.';


          this.datos =
            [];

          this.hasMore =
            false;

          this.repliesByTweet =
            {};

          this.cargando =
            false;

        }

      });

  }


  // =========================================================
  // REPLIES
  // =========================================================

  cargarReplies(): void {

    // =======================================================
    // CONTROL DE PLAN
    // =======================================================

    if (
      !this.canViewReplies
    ) {

      this.repliesByTweet =
        {};

      return;

    }


    // =======================================================
    // IDS
    // =======================================================

    const tweetIds =
      this.datos.map(
        item =>
          String(
            item.tweetid
          )
      );


    if (
      tweetIds.length === 0
    ) {

      this.repliesByTweet =
        {};

      return;

    }


    // =======================================================
    // API
    // =======================================================

    this.apiService
      .getRepliesSummaryMany(
        tweetIds
      )
      .subscribe({

        next: (
          rows: any[]
        ) => {

          const map: Record<
            string,
            {
              negativo: number;
              neutro: number;
              positivo: number;
            }
          > = {};


          for (
            const row of
            rows || []
          ) {

            const key =
              String(
                row.tweetid
              );


            if (
              !map[key]
            ) {

              map[key] = {

                negativo: 0,

                neutro: 0,

                positivo: 0

              };

            }


            const sentimiento =
              String(
                row.sentimiento ??
                ''
              )
                .trim()
                .toLowerCase();


            const total =
              Number(
                row.total
              ) ||
              0;


            if (
              sentimiento ===
              'negativo'
            ) {

              map[key].negativo =
                total;

            }


            else if (
              sentimiento ===
              'neutro'
            ) {

              map[key].neutro =
                total;

            }


            else if (
              sentimiento ===
              'positivo'
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
            'Error cargando replies:',
            error
          );


          this.repliesByTweet =
            {};

        }

      });

  }


  // =========================================================
  // CONTADORES DE REPLIES
  // =========================================================

  getRepliesCounts(
    tweetid: string | number
  ): {
    negativo: number;
    neutro: number;
    positivo: number;
  } {

    return (

      this.repliesByTweet[
        String(
          tweetid
        )
      ] ??

      {
        negativo: 0,
        neutro: 0,
        positivo: 0
      }

    );

  }


  // =========================================================
  // PULSE - PUBLICACIONES
  // =========================================================

  get totalPublicaciones(): number {

    return (
      this.pulse?.total_posts ??
      0
    );

  }


  // =========================================================
  // PULSE - FUENTES
  // =========================================================

  get totalFuentes(): number {

    return (
      this.pulse?.total_sources ??
      0
    );

  }


  // =========================================================
  // PULSE - COMENTARIOS
  // =========================================================

  get totalComentarios(): number {

    return (
      this.pulse?.total_comments ??
      0
    );

  }


  // =========================================================
  // PULSE - POSITIVOS
  // =========================================================

  get positivos(): number {

    return (
      this.pulse
        ?.sentiment
        ?.positivo ??
      0
    );

  }


  // =========================================================
  // PULSE - NEUTROS
  // =========================================================

  get neutros(): number {

    return (
      this.pulse
        ?.sentiment
        ?.neutro ??
      0
    );

  }


  // =========================================================
  // PULSE - NEGATIVOS
  // =========================================================

  get negativos(): number {

    return (
      this.pulse
        ?.sentiment
        ?.negativo ??
      0
    );

  }


  // =========================================================
  // TOTAL SENTIMIENTOS
  // =========================================================

  get totalSentimientos(): number {

    return (
      this.positivos +
      this.neutros +
      this.negativos
    );

  }


  // =========================================================
  // % POSITIVO
  // =========================================================

  get porcentajePositivo(): number {

    if (
      !this.totalSentimientos
    ) {

      return 0;

    }


    return Math.round(
      (
        this.positivos /
        this.totalSentimientos
      ) *
      100
    );

  }


  // =========================================================
  // % NEUTRO
  // =========================================================

  get porcentajeNeutro(): number {

    if (
      !this.totalSentimientos
    ) {

      return 0;

    }


    return Math.round(
      (
        this.neutros /
        this.totalSentimientos
      ) *
      100
    );

  }


  // =========================================================
  // % NEGATIVO
  // =========================================================

  get porcentajeNegativo(): number {

    if (
      !this.totalSentimientos
    ) {

      return 0;

    }


    return Math.round(
      (
        this.negativos /
        this.totalSentimientos
      ) *
      100
    );

  }


  // =========================================================
  // SENTIMIENTO DOMINANTE
  // =========================================================

  get sentimientoDominante(): string {

    const value =
      this.pulse
        ?.dominant_sentiment;


    if (
      !value ||
      value
        .toLowerCase() ===
        'sin datos'
    ) {

      return 'Sin datos';

    }


    return (
      value
        .charAt(0)
        .toUpperCase() +
      value.slice(1)
    );

  }


  // =========================================================
  // ACTIVIDAD PULSE
  // =========================================================

  get pulseActivity(): PulseActivity[] {

    return (
      this.pulse
        ?.activity_7d ??
      []
    );

  }


  // =========================================================
  // MÁXIMO PULSE
  // =========================================================

  get pulseMax(): number {

    if (
      !this.pulseActivity.length
    ) {

      return 0;

    }


    return Math.max(
      ...this.pulseActivity.map(
        item =>
          Number(
            item.total
          ) ||
          0
      )
    );

  }


  // =========================================================
  // TOTAL 7 DÍAS
  // =========================================================

  get pulseTotal7d(): number {

    return this.pulseActivity
      .reduce(
        (
          total,
          item
        ) =>
          total +
          (
            Number(
              item.total
            ) ||
            0
          ),
        0
      );

  }


  // =========================================================
  // PROMEDIO 7 DÍAS
  // =========================================================

  get pulseAverage7d(): number {

    if (
      !this.pulseActivity.length
    ) {

      return 0;

    }


    return Math.round(
      this.pulseTotal7d /
      this.pulseActivity.length
    );

  }


  // =========================================================
  // ALTURA DE BARRA
  // =========================================================

  getPulseHeight(
    total: number
  ): number {

    const value =
      Number(total) ||
      0;


    if (
      value <= 0 ||
      this.pulseMax <= 0
    ) {

      return 0;

    }


    return Math.max(
      8,
      Math.round(
        (
          value /
          this.pulseMax
        ) *
        100
      )
    );

  }


  // =========================================================
  // FECHA DEL PULSE
  // =========================================================

  formatPulseDate(
    value: string
  ): string {

    if (
      !value
    ) {

      return '';

    }


    const parts =
      String(value)
        .split('-');


    if (
      parts.length !== 3
    ) {

      return value;

    }


    return (
      `${parts[2]}/${parts[1]}`
    );

  }


  // =========================================================
  // SIGUIENTE PÁGINA
  // =========================================================

  loadNextPage(): void {

    if (
      !this.hasMore ||
      this.cargando
    ) {

      return;

    }


    const nextPage =
      this.currentPage +
      1;


    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      nextPage,
      this.searchText
    );

  }


  // =========================================================
  // PÁGINA ANTERIOR
  // =========================================================

  loadPreviousPage(): void {

    if (
      this.currentPage <= 1 ||
      this.cargando
    ) {

      return;

    }


    const previousPage =
      this.currentPage -
      1;


    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      previousPage,
      this.searchText
    );

  }


  // =========================================================
  // GUARDAR / ELIMINAR GUARDADO
  // =========================================================

  toggleGuardar(
    item: TopicItem
  ): void {

    const id =
      item.tweetid
        .toString();


    if (
      this.savingIds
        .has(id)
    ) {

      return;

    }


    this.errorGuardar =
      '';

    this.savingIds
      .add(id);


    // =======================================================
    // BORRAR
    // =======================================================

    if (
      this.guardados
        .has(id)
    ) {

      this.apiService
        .borrarGuardado(
          id
        )
        .subscribe({

          next: () => {

            this.guardados
              .delete(id);

            this.savingIds
              .delete(id);

          },


          error: () => {

            this.errorGuardar =
              'No se pudo quitar de guardados.';


            this.savingIds
              .delete(id);

          }

        });


      return;

    }


    // =======================================================
    // GUARDAR
    // =======================================================

    this.apiService
      .guardarTweet(
        id
      )
      .subscribe({

        next: () => {

          this.guardados
            .add(id);

          this.savingIds
            .delete(id);

        },


        error: () => {

          this.errorGuardar =
            'No se pudo guardar.';


          this.savingIds
            .delete(id);

        }

      });

  }


  // =========================================================
  // CARGAR GUARDADOS
  // =========================================================

  cargarGuardados(): void {

    this.apiService
      .getGuardados()
      .subscribe({

        next: (
          res: any
        ) => {

          const rows =
            res?.items ??
            res?.resultado ??
            [];


          this.guardados =
            new Set(
              rows.map(
                (row: any) =>
                  String(
                    row.tweetid
                  )
              )
            );

        },


        error: () => {

          this.guardados =
            new Set<string>();

        }

      });

  }


  // =========================================================
  // SABER SI ESTÁ GUARDADO
  // =========================================================

  isGuardado(
    tweetid: any
  ): boolean {

    if (
      tweetid === null ||
      tweetid === undefined
    ) {

      return false;

    }


    return this.guardados
      .has(
        String(
          tweetid
        )
      );

  }


  // =========================================================
  // DATE -> YYYY-MM-DD
  // =========================================================

  private toYMD(
    date: Date
  ): string {

    const year =
      date.getFullYear();


    const month =
      String(
        date.getMonth() +
        1
      )
        .padStart(
          2,
          '0'
        );


    const day =
      String(
        date.getDate()
      )
        .padStart(
          2,
          '0'
        );


    return (
      `${year}-${month}-${day}`
    );

  }


  // =========================================================
  // RECUPERAR FECHA DE NAVIGATION STATE
  // =========================================================

  private parseNavigationDate(
    value: unknown
  ): Date | undefined {

    if (
      !value
    ) {

      return undefined;

    }


    if (
      value instanceof Date
    ) {

      return Number.isNaN(
        value.getTime()
      )
        ? undefined
        : new Date(
            value.getTime()
          );

    }


    if (
      typeof value ===
      'string'
    ) {

      const ymd =
        value.match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );


      if (ymd) {

        const date =
          new Date(
            Number(
              ymd[1]
            ),
            Number(
              ymd[2]
            ) - 1,
            Number(
              ymd[3]
            )
          );


        return Number.isNaN(
          date.getTime()
        )
          ? undefined
          : date;

      }


      const date =
        new Date(
          value
        );


      return Number.isNaN(
        date.getTime()
      )
        ? undefined
        : date;

    }


    return undefined;

  }


  // =========================================================
  // FECHA BOLIVIA
  // =========================================================

  formatBoliviaDate(
    value: unknown
  ): string {

    if (
      !value
    ) {

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

    }

    else {

      let raw =
        String(
          value
        )
          .trim();


      if (
        !raw
      ) {

        return '';

      }


      /*
       * MySQL:
       * 2026-09-09 23:10:00
       *
       * ->
       *
       * 2026-09-09T23:10:00
       */
      raw =
        raw.replace(
          ' ',
          'T'
        );


      const hasTimezone =
        /(?:Z|[+-]\d{2}:?\d{2})$/i
          .test(raw);


      /*
       * Si no viene timezone,
       * asumimos UTC porque
       * los timestamps de X
       * normalmente llegan UTC.
       */
      if (
        !hasTimezone
      ) {

        raw +=
          'Z';

      }


      date =
        new Date(
          raw
        );

    }


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(
        value
      );

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
    ).format(
      date
    );

  }


  // =========================================================
  // TEXTO / LINKS
  // =========================================================

  formatText(
    text: string
  ): string {

    return linkifyText(
      text
    );

  }


  // =========================================================
  // DESCARGAR CARD
  // =========================================================

  async downloadCard(
    cardElement: HTMLElement,
    tweetId: string | number
  ): Promise<void> {

    try {

      if (
        !cardElement
      ) {

        return;

      }


      const dataUrl =
        await toPng(
          cardElement,
          {

            cacheBust:
              true,

            pixelRatio:
              2,

            backgroundColor:
              '#ffffff',

            skipFonts:
              true

          }
        );


      const link =
        document.createElement(
          'a'
        );


      link.href =
        dataUrl;


      link.download =
        `topic-${tweetId}.png`;


      link.click();

    }

    catch (error) {

      console.error(
        'Error descargando publicación:',
        error
      );

    }

  }

}