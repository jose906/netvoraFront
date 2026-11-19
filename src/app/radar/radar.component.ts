import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { RadarActor, RadarCadence, RadarPost, RadarSnapshot, RadarState, RadarStory, RadarWatch } from '../interfaces/radar';
import { ApiService } from '../services/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  selector: 'app-radar',
  templateUrl: './radar.component.html',
  styleUrl: './radar.component.css'
})
export class RadarComponent implements OnInit, OnDestroy {
  watches: RadarWatch[] = [];
  selected?: RadarWatch;
  history: RadarSnapshot[] = [];
  recentActivity: { day: RadarSnapshot; height: number }[] = [];
  snapshot?: RadarSnapshot;
  stories: RadarStory[] = [];
  selectedStory?: RadarStory;
  tab: 'signals' | 'stories' | 'actors' | 'brief' = 'signals';
  query = '';
  note = '';
  reviewState: RadarState = 'new';
  scanned = 0;
  explanation?: { text: string[]; citations: { source: string; url: string }[] };
  explaining = false;
  private explanationRequest?: Subscription;
  loading = true;
  loadingHistory = false;
  loadingStories = false;
  loadingActors = false;
  loadingActorPosts = false;
  actors: RadarActor[] = [];
  actor?: RadarActor;
  actorPosts: RadarPost[] = [];
  private actorsRequest?: Subscription;
  private actorPostsRequest?: Subscription;
  saving = false;
  error = '';
  notice = '';
  private watchesRequest?: Subscription;
  private historyRequest?: Subscription;
  private storiesRequest?: Subscription;
  private saveRequest?: Subscription;

  readonly reviewLabels = { new: 'Nuevo', reviewing: 'En curso', resolved: 'Resuelto' };
  readonly signalLabels = { volume: 'Actividad', topic: 'Tema nuevo', stance: 'Reacción' };

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadWatches();
  }

  loadWatches(): void {
    this.watchesRequest?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.watchesRequest = this.api.getRadarWatches().subscribe({
      next: ({ watches }) => {
        this.watches = watches;
        this.loading = false;
        const id = this.route.snapshot.queryParamMap.get('seguimiento');
        const watch = watches.find(item => item.id === id) ?? watches[0];
        if (watch) this.select(watch);
      },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los seguimientos.'; }
    });
  }

  select(watch: RadarWatch): void {
    this.historyRequest?.unsubscribe();
    this.storiesRequest?.unsubscribe();
    this.clearActors();
    this.selected = watch;
    this.history = [];
    this.recentActivity = [];
    this.notice = '';
    this.snapshot = undefined;
    this.clearExplanation();
    this.stories = [];
    this.selectedStory = undefined;
    this.loadingStories = false;
    this.tab = 'signals';
    this.query = '';
    this.loadHistory();
  }

  loadHistory(refresh = false): void {
    const watch = this.selected;
    if (!watch) return;
    this.historyRequest?.unsubscribe();
    this.loadingHistory = true;
    this.error = '';
    this.historyRequest = this.api.getRadarHistory(watch.id, refresh).subscribe({
      next: ({ history }) => {
        this.history = [...history].sort((a, b) => b.observation_day.localeCompare(a.observation_day));
        const latestDays = this.history.slice(0, 7).reverse();
        const peak = Math.max(1, ...latestDays.map(day => day.evidence.total));
        this.recentActivity = latestDays.map(day => ({
          day,
          height: day.evidence.total / peak * 100
        }));
        this.loadingHistory = false;
        if (this.history.length) this.selectDay(this.history[0]);
        else {
          this.snapshot = undefined;
          this.clearActors();
          this.clearExplanation();
        }
      },
      error: () => { this.loadingHistory = false; this.error = 'No se pudo cargar el historial.'; }
    });
  }

  selectDay(snapshot: RadarSnapshot): void {
    this.clearExplanation();
    this.notice = '';
    this.snapshot = snapshot;
    this.note = snapshot.note;
    this.reviewState = snapshot.review_state;
    if (this.tab === 'actors') this.loadActors();
  }

  saveReview(): void {
    const watch = this.selected;
    const snapshot = this.snapshot;
    if (!watch || !snapshot || this.saving) return;
    const note = this.note.trim();
    const state = this.reviewState;
    this.saving = true;
    this.error = '';
    this.notice = '';
    this.saveRequest = this.api.reviewRadarDay(watch.id, snapshot.observation_day, state, note).subscribe({
      next: () => {
        snapshot.note = note;
        snapshot.review_state = state;
        this.saving = false;
        if (this.snapshot === snapshot) this.notice = 'Revisión guardada.';
      },
      error: () => { this.saving = false; this.error = 'No se pudo guardar la revisión.'; }
    });
  }

  configure(changes: { cadence?: RadarCadence; paused?: boolean }): void {
    const watch = this.selected;
    if (!watch || this.saving) return;
    this.saving = true;
    this.error = '';
    this.notice = '';
    this.saveRequest = this.api.updateRadarWatch(watch.id, changes).subscribe({
      next: () => { Object.assign(watch, changes); this.saving = false; },
      error: () => { this.saving = false; this.error = 'No se pudo actualizar el seguimiento.'; }
    });
  }

  openTab(tab: 'signals' | 'stories' | 'actors' | 'brief'): void {
    this.tab = tab;
    if (tab === 'stories' && !this.stories.length) this.loadStories();
    if (tab === 'actors') this.loadActors();
  }

  loadStories(): void {
    if (!this.selected) return;
    this.storiesRequest?.unsubscribe();
    this.loadingStories = true;
    this.error = '';
    this.selectedStory = undefined;
    this.storiesRequest = this.api.getRadarStories(this.selected.id, this.query.trim()).subscribe({
      next: response => {
        this.stories = response.stories;
        this.scanned = response.scanned;
        this.selectedStory = response.stories[0];
        this.loadingStories = false;
      },
      error: () => { this.loadingStories = false; this.error = 'No se pudieron cargar las historias.'; }
    });
  }

  correctStory(post: RadarPost, split: boolean): void {
    const watch = this.selected;
    if (!watch || this.saving) return;
    this.saving = true;
    this.error = '';
    this.notice = '';
    this.saveRequest = this.api.correctRadarStory(watch.id, post.tweetid, split).subscribe({
      next: () => {
        this.saving = false;
        if (this.selected?.id === watch.id) this.loadStories();
      },
      error: () => { this.saving = false; this.error = 'No se pudo guardar la corrección.'; }
    });
  }

  private clearActors(): void {
    this.actorsRequest?.unsubscribe();
    this.actorPostsRequest?.unsubscribe();
    this.actors = [];
    this.actor = undefined;
    this.actorPosts = [];
    this.loadingActors = false;
    this.loadingActorPosts = false;
  }

  loadActors(): void {
    this.clearActors();
    if (!this.selected || !this.snapshot) return;
    this.loadingActors = true;
    this.actorsRequest = this.api.getRadarActors(this.selected.id, this.snapshot.observation_day).subscribe({
      next: ({ mentions }) => { this.actors = mentions; this.loadingActors = false; },
      error: () => { this.loadingActors = false; this.error = 'No se pudieron cargar las menciones.'; }
    });
  }

  exploreActor(actor: RadarActor): void {
    const watch = this.selected;
    const day = this.snapshot?.observation_day;
    if (!watch || !day) return;
    this.actorPostsRequest?.unsubscribe();
    this.actor = actor;
    this.actorPosts = [];
    this.loadingActorPosts = true;
    const { view, users, topic_ids, search } = watch.filters;
    const type_user = view === 'personas' ? 'Persona' : view === 'entidades' ? 'Entidad' : view === 'todos' ? '' : 'Medio';
    this.actorPostsRequest = this.api.getDashboardEvidence({
      start: day, end: day, users, topic_ids, search, categoria: type_user === 'Medio' ? view : '',
      type_user, entidad: actor.name, entity_type: actor.type, interval: '1d', page: 1
    }).subscribe({
      next: result => { this.actorPosts = result.posts; this.loadingActorPosts = false; },
      error: () => { this.loadingActorPosts = false; this.error = 'No se pudieron abrir las publicaciones del actor.'; }
    });
  }

  analyticsParams(source?: string) {
    const watch = this.selected;
    if (!watch) return {};
    return {
      vista: watch.filters.view, inicio: this.snapshot?.observation_day,
      cuentas: source ?? watch.filters.users.join(','), temas: watch.filters.topic_ids.join(','),
      buscar: watch.filters.search, entidad: watch.filters.entidad, tipoEntidad: watch.filters.entity_type
    };
  }

  private clearExplanation(): void {
    this.explanationRequest?.unsubscribe();
    this.explanation = undefined;
    this.explaining = false;
  }

  explain(mode: 'changes' | 'sources' | 'coverage'): void {
    if (!this.selected || !this.snapshot) return;
    this.clearExplanation();
    this.explaining = true;
    this.explanationRequest = this.api.explainRadarDay(this.selected.id, this.snapshot.observation_day, mode).subscribe({
      next: response => { this.explanation = response; this.explaining = false; },
      error: () => { this.explaining = false; this.error = 'No se pudo preparar la respuesta.'; }
    });
  }

  downloadReport(): void {
    if (!this.snapshot || !this.selected) return;
    const day = this.snapshot;
    const evidence = day.evidence;
    const content = [
      this.selected.name + ' · ' + day.observation_day,
      'Vista: ' + this.selected.filters.view,
      'Cuentas: ' + this.selected.filters.users.join(', '),
      'Temas: ' + this.selected.filters.topic_ids.join(', '),
      'Búsqueda: ' + this.selected.filters.search,
      'Mención: ' + (this.selected.filters.entidad ?? ''),
      evidence.total + ' publicaciones',
      ...evidence.signals.map(signal => signal.title + ' · ' + signal.observed),
      day.note,
      ...evidence.evidence.posts.filter(post => post.url).map(post => post.source + ': ' + post.url)
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'radar-' + day.observation_day + '.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async copyReport(): Promise<void> {
    const snapshot = this.snapshot;
    if (!snapshot || !this.selected) return;
    const data = snapshot.evidence;
    const lines = [
      this.selected.name + ' · ' + snapshot.observation_day,
      data.total + ' publicaciones · ' + (data.quality.active_sources ?? 0) + ' fuentes activas',
      ...data.signals.map(signal => signal.title),
      ...data.evidence.posts.filter(post => post.url).map(post => post.source + ': ' + post.url)
    ];
    this.notice = '';
    this.error = '';
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.notice = 'Informe copiado.';
    } catch {
      this.error = 'No se pudo copiar el informe. Puedes descargarlo.';
    }
  }

  ngOnDestroy(): void {
    this.watchesRequest?.unsubscribe();
    this.historyRequest?.unsubscribe();
    this.storiesRequest?.unsubscribe();
    this.saveRequest?.unsubscribe();
    this.explanationRequest?.unsubscribe();
    this.clearActors();
  }
}
