import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, Observable, of, startWith, Subscription, switchMap } from 'rxjs';

import { TopicDay } from '../interfaces/homePage';
import { TopicOption } from '../interfaces/NewsItem';
import { ApiService } from '../services/api.service';

type CatalogTopic = TopicOption | TopicDay;

interface CatalogState {
  loading: boolean;
  error: boolean;
  topics: CatalogTopic[];
}

@Component({
  selector: 'app-topic-catalog',
  templateUrl: './topic-catalog.component.html',
  styleUrls: ['./topic-layout.css', './topic-catalog.component.css']
})
export class TopicCatalogComponent implements OnInit, OnDestroy {
  onlyNew = false;
  day = '';
  accountIds: string[] = [];
  search = '';
  sort: 'recent' | 'volume' | 'name' = 'recent';
  page = 1;
  readonly pageSize = 24;
  state: CatalogState = { loading: true, error: false, topics: [] };
  results: CatalogTopic[] = [];
  maxPublications = 0;
  private request?: Subscription;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  load(): void {
    this.request?.unsubscribe();
    const pending: CatalogState = { loading: true, error: false, topics: [] };

    this.request = this.route.queryParamMap.pipe(
      switchMap(params => {
        this.onlyNew = params.get('vista') === 'nuevos';
        this.day = params.get('fecha') ?? '';
        this.accountIds = (params.get('medios') ?? '').split(',').filter(Boolean);
        this.search = '';
        this.sort = this.onlyNew ? 'volume' : 'recent';

        const request: Observable<CatalogTopic[]> = this.onlyNew
          ? this.api.getNewTopics(this.day, this.accountIds)
          : this.api.getTopics();

        return request.pipe(
          map(topics => ({ ...pending, loading: false, topics })),
          startWith(pending),
          catchError(() => of({ ...pending, loading: false, error: true }))
        );
      })
    ).subscribe(state => {
      this.state = state;
      this.maxPublications = state.topics.reduce(
        (maximum, topic) => Math.max(maximum, this.publications(topic)), 0
      );
      this.updateResults();
    });
  }

  updateResults(): void {
    const query = this.normalize(this.search.trim());
    this.results = this.state.topics.filter(topic => this.normalize(topic.topic_name).includes(query));

    if (this.sort === 'name') {
      this.results.sort((a, b) => a.topic_name.localeCompare(b.topic_name, 'es'));
    } else if (this.sort === 'volume') {
      this.results.sort((a, b) => this.publications(b) - this.publications(a));
    }

    this.page = 1;
  }

  get pageCount(): number {
    return Math.ceil(this.results.length / this.pageSize);
  }

  get visibleTopics(): CatalogTopic[] {
    return this.results.slice(this.firstResult - 1, this.lastResult);
  }

  get firstResult(): number {
    return (this.page - 1) * this.pageSize + 1;
  }

  get lastResult(): number {
    return Math.min(this.page * this.pageSize, this.results.length);
  }

  changePage(page: number, resultStatus: HTMLElement): void {
    this.page = page;
    resultStatus.focus({ preventScroll: true });
    resultStatus.scrollIntoView({ block: 'start' });
  }

  trackTopic(_: number, topic: CatalogTopic): number {
    return topic.topic_id;
  }

  metadata(topic: CatalogTopic): TopicOption | null {
    return 'total_posts' in topic ? topic : null;
  }

  publications(topic: CatalogTopic): number {
    return Number('tweets_hoy' in topic ? topic.tweets_hoy : topic.total_posts) || 0;
  }

  private normalize(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}
