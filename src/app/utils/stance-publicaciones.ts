import { Directive, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NewsItem } from '../interfaces/NewsItem';
import { StanceComment, StancePublication, StanceValue } from '../interfaces/stance';
import { ApiService } from '../services/api.service';

@Directive()
export abstract class StancePublicaciones implements OnDestroy {
  abstract datos: NewsItem[];
  abstract get canViewReplies(): boolean;

  constructor(protected readonly apiService: ApiService) {}

  stanceByTweet: Record<string, StancePublication> = {};
  stanceLoading = false;
  stanceError = '';

  readonly stanceLabels: Array<{ key: StanceValue; label: string; tone: string }> = [
    { key: 'FAVOR', label: 'A favor', tone: 'favor' },
    { key: 'CONTRA', label: 'En contra', tone: 'contra' },
    { key: 'MIXTO', label: 'Mixto', tone: 'mixto' },
    { key: 'NEUTRAL', label: 'Neutral', tone: 'neutral' },
    { key: 'NO_CLARO', label: 'No claro', tone: 'no-claro' }
  ];

  stanceOpenId: string | null = null;
  stanceComments: StanceComment[] = [];
  stanceCommentsLoading = false;
  stanceCommentsError = '';
  stanceCommentsPage = 1;
  stanceCommentsTotal = 0;
  readonly stanceCommentsLimit = 20;

  private stanceBatchSub?: Subscription;
  private stanceCommentsSub?: Subscription;
  protected stanceLoadToken = 0;

  ngOnDestroy(): void {
    this.resetStanceRequests();
  }

  protected resetStanceRequests(): void {
    ++this.stanceLoadToken;
    this.stanceBatchSub?.unsubscribe();
    this.closeStanceComments();
  }

  getStance(tweetid: string | number): StancePublication | null {
    return this.stanceByTweet[String(tweetid)] ?? null;
  }

  stanceStatusText(item: StancePublication): string {
    switch (item.status) {
      case 'processed': return 'Clasificado';
      case 'partial': return 'Parcialmente clasificado';
      case 'pending': return 'Pendiente de clasificar';
      case 'not_applicable': return 'No aplica a este contenido';
      case 'no_comments': return 'Sin comentarios';
      default: return 'Sin información';
    }
  }

  cargarStanceBatch(): void {
    this.stanceBatchSub?.unsubscribe();
    this.stanceByTweet = {};
    this.stanceError = '';

    if (!this.canViewReplies) {
      this.stanceLoading = false;
      return;
    }

    const ids = [...new Set(this.datos.map(item => String(item.tweetid)).filter(Boolean))];
    if (!ids.length) {
      this.stanceLoading = false;
      return;
    }

    const token = this.stanceLoadToken;
    this.stanceLoading = true;

    // Un único request para la página completa, nunca uno por tarjeta.
    this.stanceBatchSub = this.apiService.getStancePublicacionesBatch({
      analysisType: 'post',
      tweetids: ids
    }).subscribe({
      next: response => {
        if (token !== this.stanceLoadToken) return;
        this.stanceByTweet = response?.batch?.items ?? {};
        this.stanceLoading = false;
      },
      error: error => {
        if (token !== this.stanceLoadToken) return;
        console.error('Error cargando Stance por publicación:', error);
        this.stanceByTweet = {};
        this.stanceError = 'No se pudo consultar Stance para estas publicaciones.';
        this.stanceLoading = false;
      }
    });
  }

  toggleStanceComments(tweetid: string | number): void {
    const id = String(tweetid);
    if (this.stanceOpenId === id) {
      this.closeStanceComments();
      return;
    }
    this.stanceOpenId = id;
    this.loadStanceComments(1);
  }

  closeStanceComments(): void {
    this.stanceCommentsSub?.unsubscribe();
    this.stanceOpenId = null;
    this.stanceComments = [];
    this.stanceCommentsLoading = false;
    this.stanceCommentsError = '';
    this.stanceCommentsPage = 1;
    this.stanceCommentsTotal = 0;
  }

  loadStanceComments(page: number): void {
    const id = this.stanceOpenId;
    if (!id || !this.canViewReplies || page < 1) return;

    this.stanceCommentsSub?.unsubscribe();
    this.stanceCommentsLoading = true;
    this.stanceCommentsError = '';
    this.stanceComments = [];

    // El target ya llegó en batch. Aquí se pide únicamente la página de comentarios.
    this.stanceCommentsSub = this.apiService.getStanceComentarios({
      analysisType: 'post',
      tweetid: id,
      page,
      limit: this.stanceCommentsLimit
    }).subscribe({
      next: response => {
        if (this.stanceOpenId !== id) return;
        this.stanceComments = response.comments?.items ?? [];
        this.stanceCommentsTotal = Number(response.comments?.total ?? 0);
        this.stanceCommentsPage = page;
        this.stanceCommentsLoading = false;
      },
      error: error => {
        if (this.stanceOpenId !== id) return;
        console.error('Error cargando detalle de Stance:', error);
        this.stanceCommentsError = 'No fue posible cargar los comentarios.';
        this.stanceCommentsLoading = false;
      }
    });
  }

  stanceCommentLabel(comment: StanceComment): string {
    if (comment.stance) {
      return this.stanceLabels.find(item => item.key === comment.stance)?.label ?? comment.stance;
    }
    return comment.status === 'not_applicable' ? 'No aplica' : 'Pendiente';
  }
}
