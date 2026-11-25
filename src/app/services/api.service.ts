import { StatisticsFilters, StatisticsInsights } from '../estadisticas/statistics-insights';
import { RadarActor, RadarCadence, RadarFilters, RadarSnapshot, RadarState, RadarStory, RadarWatch } from '../interfaces/radar';
import { DashboardEntityType, DashboardEvidence, DashboardEvidenceFilters } from '../interfaces/dashboard-evidence';
import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient,HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewsData } from '../interfaces/NewsData';
import { users,user,AdminUserSubscriptionsResponse } from '../interfaces/users';
import { HomePageResponse, TopicDay } from '../interfaces/homePage';
import { StatsResponse } from '../interfaces/data/mainDashboard';
import { DashboardStatsResponse } from '../interfaces/data/MediaDashboard';
import { NewsItem, PulseResponse, TopicOption } from '../interfaces/NewsItem';
import { StanceFilters, StanceSummary, StanceTimelineRow, StanceComment, StancePublication, StanceTopic, StanceSource, StancePage } from '../interfaces/stance';




export interface PublicationFilters {
  startDate?: string;
  endDate?: string;
  users?: string[];
  searchText?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private apiUrl = `${environment.apiUrl}/`; // URL base de tu API


  constructor(private http: HttpClient) { }

  

  getAllPosts(body: PublicationFilters): Observable<NewsData> {
    return this.http.post<NewsData>(this.apiUrl + 'tweets', body);
  }

  getPostsCategoria(body: PublicationFilters & { categoria: string }): Observable<NewsData> {
    return this.http.post<NewsData>(this.apiUrl + 'categoria', body);
  }

getPulse(body: {type: 'Medio' | 'Entidad' | 'Persona';categoria?: string;startDate?: string;endDate?: string;users?: string[]; searchText?: string;}): Observable<PulseResponse> {

  const headers = new HttpHeaders({
    'Content-Type': 'application/json'
  });

  return this.http.post<PulseResponse>(
    this.apiUrl + 'pulse',
    body,
    { headers }
  );
}
getTopicPulse(body: {
  topicId: number;
  startDate?: string;
  endDate?: string;
  users?: string[];
  searchText?: string;
}): Observable<PulseResponse> {

  const headers = new HttpHeaders({
    'Content-Type': 'application/json'
  });

  return this.http.post<PulseResponse>(
    this.apiUrl + 'topic_pulse',
    body,
    { headers }
  );

  
}

getStatisticsInsights(filters: StatisticsFilters): Observable<StatisticsInsights> {
  return this.http.post<StatisticsInsights>(this.apiUrl + 'estadisticas/analisis', filters);
}

getStatsResumen(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/resumen`,
    params
  );
}

getStatsTimeline(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/timeline`,
    params
  );
}

getStatsMedios(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/medios`,
    params
  );
}

getStatsTopicos(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/topicos`,
    params
  );
}

getStatsEntidades(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/entidades`,
    params
  );
}

getStatsComentarios(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/comentarios`,
    params
  );
}



  
getRepliesSummaryMany(tweetIds: any[]) {
  return this.http.post<any[]>(`${this.apiUrl}get_sentimient`,{ idTweet: tweetIds } // ✅ lista
  );
}

  

  
  getAllData(params:any):Observable<StatsResponse>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<StatsResponse>(this.apiUrl+'estadisticas',params,{headers});
  }
  getCategoriesData(params:any): Observable<DashboardStatsResponse> {

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<DashboardStatsResponse>(this.apiUrl+'categorias',params, {headers});
  }
  getPostPer(body: PublicationFilters): Observable<NewsData> {
    return this.http.post<NewsData>(this.apiUrl + 'personas', body);
  }

  getPostsEntidades(body: PublicationFilters): Observable<NewsData> {
    return this.http.post<NewsData>(this.apiUrl + 'entidades', body);
  }

  getTopic(body: {topicId: number;startDate?: string;endDate?: string;users?: string[];searchText?: string;page?: number;limit?: number;}): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  return this.http.post<any>( this.apiUrl + 'get_topic',body, {headers}); 

}



getCategoryTopicsTimeline(params: {
  start: string;
  end?: string;
  users: string[];
  categoria: string;
  type_user: string;
  search?: string;
  topic_ids: number[];
  timeline_interval: '1h' | '3h' | '6h' | '12h' | '1d';
  entidad?: string;
  entity_type?: DashboardEntityType;
}): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/topicos/timeline`,
    params
  );
}

getAdminSystemUsers(): Observable<any[]> {
  return this.http.get<any[]>(
    `${this.apiUrl}admin/system-users`
  );
}

getAdminXSources(): Observable<any[]> {
  return this.http.get<any[]>(
    `${this.apiUrl}admin/x-sources`
  );
}


getCategoryResumen(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/resumen`, params
  );
}

getStatsTopicsTimeline(params: any): Observable<Partial<StatsResponse>> {
  return this.http.post<Partial<StatsResponse>>(
    `${this.apiUrl}estadisticas/topicos/timeline`,
    params
  );
}


getCategoryTimeline(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/timeline`, params
  );
}

getCategoryFuentes(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/fuentes`, params
  );
}

getCategoryTopicos(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/topicos`, params
  );
}

getCategoryEntidades(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/entidades`, params
  );
}

getCategoryCruces(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/cruces`, params
  );
}

getCategoryComentarios(params: any): Observable<any> {
  return this.http.post<any>(
    `${this.apiUrl}categorias/comentarios`, params
  );
}


  getNewTopics(day: string, users: string[]): Observable<TopicDay[]> {
    return this.http.post<TopicDay[]>(this.apiUrl + 'topics/new', { startDate: day, users });
  }

  getTopics():Observable<TopicOption[]>{

     return this.http.get<TopicOption[]>(this.apiUrl + 'get_list_topic');
    
  }

  getUsers(tipo:string){
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' })
    return this.http.post<users[]>(this.apiUrl+'users',{tipo:tipo}, {headers});
  }
  getUsers2(tipo:string){
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' })
    return this.http.post<users[]>(this.apiUrl+'users2',{tipo:tipo}, {headers});
  }
  searchbyid(id: string): Observable<user | null> {
    return this.http.post<user | null>(this.apiUrl + 'user', { id });
  }
  searchbyname(username: string): Observable<user | null>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<user | null>(this.apiUrl + 'user', { username }, { headers });
  }
  addUser(user:users):Observable<users>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<users>(this.apiUrl+'add_user',user,{headers});
  }
  updateCategory(body: { idTweet: string; oldCategory?: string, newCategory?: string, text?: string }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.apiUrl+'update_category',body, {headers});
    
  }
 
  updateSentiment(body: { idTweet: string; oldSentiment?: string, newSentiment?: string, text?: string }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.apiUrl+'update_sentiment',body, {headers});
    
  }

  createSystemUser(body: {
    name: string;
    email: string;
    password: string;
    role: string;
    state: string;
  }): Observable<{ ok: boolean; uid: string }> {
    return this.http.post<{ ok: boolean; uid: string }>(this.apiUrl + 'admin/system-users', body);
  }

  syncUsers(body: { name: string; organizacion: string }): Observable<unknown> {
    return this.http.post(this.apiUrl + 'sync', body);
  }

  getDashboardEvidence(filters: DashboardEvidenceFilters): Observable<DashboardEvidence> {
    return this.http.post<DashboardEvidence>(this.apiUrl + 'estadisticas/evidencia', filters);
  }

  getRadarOverview() {
    return this.http.get<{ watches: number; pending: number }>(this.apiUrl + 'api/radar/overview');
  }

  explainRadarDay(id: string, day: string, mode: string) {
    return this.http.get<{ text: string[]; citations: { source: string; url: string }[] }>(
      this.apiUrl + 'api/radar/watches/' + id + '/history/' + day + '/explain', { params: { mode } }
    );
  }

  getRadarWatches() {
    return this.http.get<{ watches: RadarWatch[] }>(this.apiUrl + 'api/radar/watches');
  }

  createRadarWatch(name: string, filters: RadarFilters) {
    return this.http.post<{ id: string }>(this.apiUrl + 'api/radar/watches', { name, ...filters });
  }

  updateRadarWatch(id: string, changes: { cadence?: RadarCadence; paused?: boolean }) {
    return this.http.patch(this.apiUrl + 'api/radar/watches/' + id, changes);
  }

  getRadarHistory(id: string, refresh = false) {
    const url = this.apiUrl + 'api/radar/watches/' + id + '/history';
    return refresh ? this.http.post<{ history: RadarSnapshot[] }>(url, {})
      : this.http.get<{ history: RadarSnapshot[] }>(url);
  }

  reviewRadarDay(id: string, day: string, state: RadarState, note: string) {
    return this.http.patch(this.apiUrl + 'api/radar/watches/' + id + '/history/' + day, { state, note });
  }

  getRadarActors(id: string, day: string) {
    return this.http.get<{ mentions: RadarActor[] }>(
      this.apiUrl + 'api/radar/watches/' + id + '/actors', { params: { day } }
    );
  }

  correctRadarStory(id: string, tweetid: string, split: boolean) {
    const url = this.apiUrl + 'api/radar/watches/' + id + '/stories/splits/' + tweetid;
    return split ? this.http.put(url, {}) : this.http.delete(url);
  }

  getRadarStories(id: string, query: string) {
    return this.http.get<{ stories: RadarStory[]; scanned: number }>(
      this.apiUrl + 'api/radar/watches/' + id + '/stories', { params: { q: query } }
    );
  }

  getDashboardDayPosts(date: string, users: string[], page: number, limit: number): Observable<NewsData> {
    return this.http.post<NewsData>(this.apiUrl + 'tweets', { startDate: date, users, page, limit });
  }

  getMainPageStats(users?: string[]): Observable<HomePageResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<HomePageResponse>(this.apiUrl+'main_dashboard', { users }, { headers });
  }
 getWordcloud(body: any) {
  return this.http.post(`${this.apiUrl}wordcloud`, body, {
    responseType: 'blob',
    observe: 'response'
  });
}
getPlans() {
  return this.http.get<any[]>(`${this.apiUrl}get_plans`);
}

getAppUsers() {
  return this.http.get<any[]>(`${this.apiUrl}get_users`);
}

createUserPlan(body: any) {
  return this.http.post(this.apiUrl + 'create_plan', body);
}

getGuardados(limit = 10, offset = 0, category?: string) {
  let url = `${this.apiUrl}saved_posts?limit=${limit}&offset=${offset}`;
  if (category && category !== 'inicio') url += `&category=${encodeURIComponent(category)}`;
  return this.http.get<{ ok: boolean; items: NewsItem[]; limit: number; offset: number }>(url);
}

getSavedMap(category?: string) {
  const params: any = {};
  if (category) params.category = category;
  return this.http.get<{ ok: boolean; saved: Record<string, any> }>(
    `${this.apiUrl}saved_posts_map`,
    { params }
  );
}
       
  // POST: guarda tweet
  guardarTweet(tweetid: string): Observable<any> {
    return this.http.post(`${this.apiUrl}save_post`, { tweetid });
  }

  // DELETE: elimina guardado
  borrarGuardado(tweetid: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}unsave_post/${tweetid}`);
  }

  upsertNote(tweetid: string, note: string) {
  return this.http.post<{ ok: boolean }>(`${this.apiUrl}user_tweets/note`, { tweetid, note });
}

deleteNote(tweetid: string) {
  return this.http.delete<{ ok: boolean }>(`${this.apiUrl}user_tweets/note/${tweetid}`);
}

// api.service.ts
followTweetUser(tweetuser_id: string) {
  return this.http.post(`${this.apiUrl}follow_tweetuser`, { tweetuser_id });
}

unfollowTweetUser(tweetuser_id: string) {
  return this.http.post(`${this.apiUrl}unfollow_tweetuser`, { tweetuser_id });
}

getFollowedTweetUsers() {
  return this.http.get<{ ok: boolean; rows: { tweetuser_id: string }[] }>(`${this.apiUrl}followed_tweetusers`);
}
 getStanceResumen(body: StanceFilters): Observable<{ ok: boolean; summary: StanceSummary }> {
    return this.http.post<{ ok: boolean; summary: StanceSummary }>(
      `${this.apiUrl}api/stance/resumen`, body
    );
  }

  getStanceTimeline(body: StanceFilters): Observable<{ ok: boolean; timeline: StanceTimelineRow[] }> {
    return this.http.post<{ ok: boolean; timeline: StanceTimelineRow[] }>(
      `${this.apiUrl}api/stance/timeline`, body
    );
  }

  getStanceComentarios(body: StanceFilters): Observable<{ ok: boolean; comments: StancePage<StanceComment> }> {
    return this.http.post<{ ok: boolean; comments: StancePage<StanceComment> }>(
      `${this.apiUrl}api/stance/comentarios`, body
    );
  }

  
  getStanceTopicos(body: StanceFilters): Observable<{
  ok: boolean;
  topics: StancePage<StanceTopic>;
}> {

  return this.http.post<{
    ok: boolean;
    topics: StancePage<StanceTopic>;
  }>(
    `${this.apiUrl}api/stance/topicos`,
    body
  );
}

  getStanceFuentes(body: StanceFilters): Observable<{ ok: boolean; sources: StanceSource[] }> {
    return this.http.post<{ ok: boolean; sources: StanceSource[] }>(
      `${this.apiUrl}api/stance/fuentes`, body
    );
  }

  getStancePublicacionesBatch(body: StanceFilters & { tweetids: string[] }): Observable<{ ok: boolean; batch: { items: Record<string, StancePublication>; requested: number; found: number } }> {
    return this.http.post<{ ok: boolean; batch: { items: Record<string, StancePublication>; requested: number; found: number } }>(
      `${this.apiUrl}api/stance/publicaciones/batch`, body
    );
  }


getAdminUserSubscriptions(
  userId: number
): Observable<AdminUserSubscriptionsResponse> {

  return this.http.get<AdminUserSubscriptionsResponse>(
    `${this.apiUrl}admin/system-users/${userId}/subscriptions`
  );

}

sendAdminUserEmail(
  userId: number,
  body: {
    tipo: string;
    asunto: string;
    mensaje: string;
  }
) {
  // Reemplazar this.baseUrl por la propiedad
  // de URL base que usa tu ApiService.
  const url =
    `${this.apiUrl}admin/system-users/${userId}/send-email`;

  return this.http.post<{
    ok: boolean;
    message: string;
    destinatario: string;
    gmail_message_id?: string;
  }>(
    url,
    body
  );
}


  




  



  }
