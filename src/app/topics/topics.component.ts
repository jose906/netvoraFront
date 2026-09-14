import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router, ActivatedRoute } from '@angular/router';

import { TopicItem, TopicOption } from '../interfaces/NewsItem';
import { users } from '../interfaces/users';

import { linkifyText } from '../utils/helpers';
import { toPng } from 'html-to-image';
import { AuthService} from '../services/auth.service';
import { AccountService } from '../services/account.service';
import { AccountMeResponse } from '../interfaces/me';
import { AuthzService, UserRole } from '../services/authz.service';



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
  // FILTROS
  // =========================================================

  // Igual que Social:
  // al entrar muestra inicialmente publicaciones de hoy.
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

  loadingReplies: Record<string, boolean> = {};


  // =========================================================
  // GUARDADOS
  // =========================================================

  guardados = new Set<string>();

  savingIds = new Set<string>();

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

    /*
     * 1.
     * Primero intentamos obtener el tópico enviado
     * desde Principal mediante history.state.
     */

    const navigationState = history.state;

    if (navigationState?.topic_id) {

      this.topicId = Number(
        navigationState.topic_id
      );

    }

    if (navigationState?.topic_name) {

      this.topicName =
        navigationState.topic_name;

    }

    // Recuperar filtros enviados desde el dashboard.
    // Esto mantiene exactamente el mismo universo de análisis
    // al entrar desde un tópico emergente.
    if (navigationState?.startDate) {
      this.startDate =
        this.parseNavigationDate(
          navigationState.startDate
        );
    }

    if (navigationState?.endDate) {
      this.endDate =
        this.parseNavigationDate(
          navigationState.endDate
        );
    }

    if (
      Array.isArray(
        navigationState?.selectedUsers
      )
    ) {
      this.selectedUsers =
        navigationState.selectedUsers
          .map(
            (id: unknown) =>
              String(id)
          )
          .filter(Boolean);
    }

    if (
      typeof navigationState?.searchText ===
      'string'
    ) {
      this.searchText =
        navigationState.searchText;
    }


    /*
     * 2.
     * Si recargamos la página, history.state puede
     * no contener el tópico.
     *
     * Entonces lo obtenemos desde:
     *
     * /topics/53
     */

    if (!this.topicId) {

      const routeId =
        this.route.snapshot.paramMap.get(
          'topic_id'
        );

      if (routeId) {

        this.topicId =
          Number(routeId);

      }

    }


    /*
     * 3.
     * Cargamos:
     *
     * - usuarios
     * - lista de tópicos
     * - guardados
     */
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

    if (!this.authzService.isLoaded()) {

      await this.authzService.refreshMe();

    }

    this.currentRole =
      this.authzService.role;

  }

  catch (error) {

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

        // =================================================
        // ROL
        // =================================================

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


        // =================================================
        // PLAN
        // =================================================

        const plan =
          res?.subscription?.plan;


        this.subscriptionPlan =
          plan?.name
            ?.toString()
            .trim() || '';


        // =================================================
        // ESTADO
        // =================================================

        this.subscriptionStatus =
          res?.subscription?.status
            ?.toString()
            .trim()
            .toLowerCase() || '';


        this.accessLoading = false;


        // =================================================
        // SI ES PRO / ADMIN Y YA TENEMOS PUBLICACIONES
        // CARGAMOS LOS REPLIES
        // =================================================

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

        this.subscriptionPlan = '';

        this.subscriptionStatus = '';

        this.accessLoading = false;

        this.repliesByTweet = {};

      }

    });

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
// PERMISO PARA VER REPLIES
// =========================================================

get canViewReplies(): boolean {

  /*
   * Admin tiene acceso total.
   */

  if (this.isAdmin) {

    return true;

  }


  /*
   * Usuarios normales:
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
      .getUsers2('Medio')
      .subscribe({

        next: (data) => {

          this.users =
            Array.isArray(data)
              ? data
              : [];


          /*
           * Si venimos desde Principal y ya tenemos
           * topicId, hacemos la primera carga.
           *
           * Igual que Social:
           * - fecha de hoy
           * - todos los medios
           */

          if (this.topicId) {

            this.load(
              this.startDate,
              this.endDate,
              this.selectedUsers,
              1,
              this.searchText
            );

          }

        },


        error: (error) => {

          console.error(
            'Error cargando usuarios:',
            error
          );

          this.users = [];


          /*
           * Aunque fallen los usuarios,
           * intentamos cargar el tópico.
           */

          if (this.topicId) {

            this.load(
              this.startDate,
              this.endDate,
              this.selectedUsers,
              1,
              this.searchText
            );

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

        next: (data: TopicOption[]) => {

          this.topics =
            Array.isArray(data)
              ? data
              : [];


          /*
           * Si tenemos topicId pero no topicName
           * buscamos el nombre en la lista.
           *
           * Esto ocurre, por ejemplo, al recargar:
           *
           * /topics/53
           */

          if (
            this.topicId &&
            !this.topicName
          ) {

            const selected =
              this.topics.find(
                topic =>
                  Number(topic.topic_id) ===
                  Number(this.topicId)
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

          this.topics = [];

        }

      });

  }


  // =========================================================
  // CAMBIAR TÓPICO
  // =========================================================

  cambiarTopico(): void {

    if (!this.topicId) {
      return;
    }


    const selected =
      this.topics.find(
        topic =>
          Number(topic.topic_id) ===
          Number(this.topicId)
      );


    this.topicName =
      selected?.topic_name ?? '';


    /*
     * Cada cambio de tópico vuelve
     * a la página 1.
     */

    this.currentPage = 1;


    /*
     * Actualizamos la URL.
     *
     * Ejemplo:
     * /topics/53
     * /topics/175
     */

    this.router.navigate(
      [
        '/topics',
        this.topicId
      ],
      {
        replaceUrl: true,
        state: {
          topic_id: this.topicId,
          topic_name: this.topicName,
          startDate: this.startDate
            ? this.toYMD(this.startDate)
            : null,
          endDate: this.endDate
            ? this.toYMD(this.endDate)
            : null,
          selectedUsers: [
            ...this.selectedUsers
          ],
          searchText: this.searchText
        }
      }
    );


    /*
     * Conservamos los filtros actuales.
     */

    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      1,
      this.searchText
    );

  }


  // =========================================================
  // FILTRAR
  // =========================================================

  filtrar(): void {

    if (!this.topicId) {

      this.error =
        'Selecciona un tópico.';

      return;

    }


    this.currentPage = 1;


    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      1,
      this.searchText
    );

  }


  // =========================================================
  // LIMPIAR FILTROS
  // =========================================================

  resetFiltros(): void {

    /*
     * Limpiamos los filtros.
     *
     * IMPORTANTE:
     * NO limpiamos topicId.
     * NO limpiamos topicName.
     */

    this.startDate = undefined;

    this.endDate = undefined;

    this.selectedUsers = [];

    this.searchText = '';

    this.currentPage = 1;


    if (this.topicId) {

      this.load(
        undefined,
        undefined,
        [],
        1,
        ''
      );

    }

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

    if (!this.topicId) {

      this.error =
        'Selecciona un tópico.';

      return;

    }


    this.cargando = true;

    this.error = '';

    this.datos = [];

    this.repliesByTweet = {};


    /*
     * BODY
     *
     * El backend debe recibir topic_id.
     */

    const body: {

      topicId: number;

      startDate?: string;

      endDate?: string;

      users?: string[];

      searchText?: string;

      page: number;

      limit: number;

    } = {

      topicId: this.topicId,

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
    // USUARIOS
    // =======================================================

    if (
      selectedUsers &&
      selectedUsers.length > 0
    ) {

      body.users = selectedUsers

    }

    else {

     body.users =
  this.users.map(
    user => String(user.idTweetUser)
  );

    }


    // =======================================================
    // TEXTO
    // =======================================================

    const text =
      searchText?.trim();

    if (text) {

      body.searchText =
        text;

    }


    // =======================================================
    // API
    // =======================================================

    this.apiService
      .getTopic(body)
      .subscribe({

        next: (data: any) => {
          console.log('Data received from API:', data);


          if (Array.isArray(data)) {
            
            this.datos = data;

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


          // =================================================
          // NOMBRE DEL TÓPICO
          // =================================================

          if (
            this.datos.length > 0 &&
            this.datos[0].topic_name
          ) {

            this.topicName =
              this.datos[0]
                .topic_name;

          }


          // =================================================
          // PAGINACIÓN
          // =================================================

          /*
           * Si llegaron exactamente 10,
           * asumimos que puede existir
           * una página siguiente.
           */

          this.hasMore =
            this.datos.length ===
            this.pageSize;


          // =================================================
          // REPLIES
          // =================================================
          if (this.canViewReplies) {

            this.cargarReplies();

          }
          else {

            this.repliesByTweet = {};

          }


this.cargando = false;

        },


        error: (error) => {

          console.error(
            'Error cargando tópico:',
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

cargarReplies(): void {

  // =======================================================
  // CONTROL DE PLAN
  // =======================================================

  if (!this.canViewReplies) {

    this.repliesByTweet = {};

    return;

  }


  // =======================================================
  // IDS
  // =======================================================

  const tweetIds =
    this.datos.map(
      item =>
        String(item.tweetid)
    );


  if (
    tweetIds.length === 0
  ) {

    this.repliesByTweet = {};

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
            Number(
              row.total
            ) || 0;


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
  // SIGUIENTE PÁGINA
  // =========================================================

  loadNextPage(): void {

    if (!this.hasMore) {
      return;
    }


    this.currentPage++;


    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      this.currentPage,
      this.searchText
    );

  }


  // =========================================================
  // PÁGINA ANTERIOR
  // =========================================================

  loadPreviousPage(): void {

    if (
      this.currentPage <= 1
    ) {
      return;
    }


    this.currentPage--;


    this.load(
      this.startDate,
      this.endDate,
      this.selectedUsers,
      this.currentPage,
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
      item.tweetid.toString();


    if (
      this.savingIds.has(id)
    ) {

      return;

    }


    this.errorGuardar = '';

    this.savingIds.add(id);


    // =======================================================
    // BORRAR GUARDADO
    // =======================================================

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


    // =======================================================
    // GUARDAR
    // =======================================================

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


  // =========================================================
  // CARGAR GUARDADOS
  // =========================================================

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

    return this.guardados.has(
      tweetid.toString()
    );

  }


  // =========================================================
  // FECHAS / ZONA HORARIA
  // =========================================================

  /**
   * Convierte una fecha del datepicker a YYYY-MM-DD usando
   * componentes locales. Evita que JSON/UTC cambie el día.
   */
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


  /**
   * Recupera fechas enviadas por navigation state sin permitir
   * que el navegador cambie el día por zona horaria.
   */
  private parseNavigationDate(
    value: unknown
  ): Date | undefined {

    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {

      return Number.isNaN(
        value.getTime()
      )
        ? undefined
        : new Date(
            value.getTime()
          );

    }

    if (typeof value === 'string') {

      const ymd =
        value.match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );

      if (ymd) {

        const date =
          new Date(
            Number(ymd[1]),
            Number(ymd[2]) - 1,
            Number(ymd[3])
          );

        return Number.isNaN(
          date.getTime()
        )
          ? undefined
          : date;

      }

      const date =
        new Date(value);

      return Number.isNaN(
        date.getTime()
      )
        ? undefined
        : date;

    }

    return undefined;

  }


  /**
   * Muestra las fechas de publicaciones siempre en Bolivia.
   *
   * IMPORTANTE:
   * Los timestamps sin Z ni offset se consideran UTC porque
   * los timestamps provenientes de X normalmente llegan en UTC.
   * Luego se convierten a America/La_Paz (UTC-4).
   */
  formatBoliviaDate(
    value: unknown
  ): string {

    if (!value) {
      return '';
    }

    let date: Date;

    if (value instanceof Date) {

      date =
        new Date(
          value.getTime()
        );

    }

    else {

      let raw =
        String(value)
          .trim();

      if (!raw) {
        return '';
      }

      // MySQL suele devolver:
      // 2026-09-09 23:10:00
      // Lo convertimos a formato ISO.
      raw =
        raw.replace(
          ' ',
          'T'
        );

      const hasTimezone =
        /(?:Z|[+-]\d{2}:?\d{2})$/i
          .test(raw);

      // Si el backend no envía zona, asumimos UTC.
      // Evita el típico desfase de 4 horas al mostrarlo en Bolivia.
      if (!hasTimezone) {
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
  // DESCARGAR CARD COMO PNG
  // =========================================================

  async downloadCard(
    cardElement: HTMLElement,
    tweetId: string | number
  ): Promise<void> {

    try {

      if (!cardElement) {
        return;
      }


      const dataUrl =
        await toPng(
          cardElement,
          {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor:
              '#ffffff',
            skipFonts: true
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