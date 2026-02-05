import { Injectable } from '@angular/core';
import { HttpClient,HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JsonData } from '../interfaces/JsonData';
import { ResumeInterface } from '../interfaces/ResumeInterface';
import { NewsData } from '../interfaces/NewsData';
import { CategoriasData } from '../interfaces/data/CategoriasData';
import { ConteoResponse } from '../interfaces/data/AllData';
import { Data } from '@angular/router';
import { DataFromCategorie } from '../interfaces/data/DataFromCategorie';
import { users,user } from '../interfaces/users';
import { MainPageData } from '../interfaces/data/mainpage';
import { NumberSymbol } from '@angular/common';
import { HomePageResponse } from '../interfaces/homePage';
import { StatsResponse } from '../interfaces/data/mainDashboard';
import { DashboardStatsResponse } from '../interfaces/data/MediaDashboard';



@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private apiUrl = 'https://netvoraback-109294037791.europe-west1.run.app/'; // URL base de tu API


  constructor(private http: HttpClient) { }


  getPosts(): Observable<JsonData[]> {
    return this.http.get<JsonData[]>(`${this.apiUrl+'politica'}`);
  }
  getAllPosts(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(`${this.apiUrl+'tweets'}`,body,{headers});
  }
  getPostsAmbiente(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'ambiente',body,{headers});
  }


  getPostsEco(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'economia',body,{headers});
  }

  
  getPostsSegu(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'seguridad',body,{headers});
  }
  getPostsDeport(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'deportes',body,{headers});
  }
  getPostsSocial(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'social',body,{headers});
  }
  getPostsEduca(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'educacion',body,{headers});
  }
   getPostsOtros(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'otros',body,{headers});
  }
  
  getResumen(dato:{url:string}):Observable<any[]>{
  
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<ResumeInterface[]>(this.apiUrl+'resumir',dato,{headers});
  } 
 getNews(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number, searchText?: string }): Observable<NewsData[]> {

  const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
   return this.http.post<NewsData[]>(this.apiUrl+'politica',body,{headers}); 
  }
  updateNews(id:number, categoria:string, sentimiento:string):Observable<any>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body={categoria:categoria, sentimiento:sentimiento};
    return this.http.post<any>(`${this.apiUrl}news/${id}`,body,{headers});
  }

  getAllData(params:any):Observable<StatsResponse>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<StatsResponse>(this.apiUrl+'estadisticas',params,{headers});
  }
  getCategoriesData(params:any): Observable<DashboardStatsResponse> {

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<DashboardStatsResponse>(this.apiUrl+'categorias',params, {headers});
  }
  getPostSalud(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {  

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'salud',body, {headers});

  }
  getPostPer(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {  

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'personas',body, {headers});

  }
  getPostsGestiones(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {  

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'gestiones',body,{headers});

  }
  getPostsEntidades(body: { startDate?: string; endDate?: string; users?: Number[], page?: number, limit?: number }): Observable<NewsData[]> {  

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<NewsData[]>(this.apiUrl+'entidades',body,{headers});

  }

  getUsers(tipo:string){
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' })
    return this.http.post<users[]>(this.apiUrl+'users',{tipo:tipo}, {headers});
  }
  searchbyid(id:number):Observable<user>{
    return this.http.get<user>(`${this.apiUrl}users/${id}`);
  }
  searchbyname(usernNme:string):Observable<user>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<user>(this.apiUrl+'user', {username:usernNme}, {headers});
  }
  addUser(user:users):Observable<users>{
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<users>(this.apiUrl+'add_user',user,{headers});
  }
  deleteUser(id:number):Observable<any>{
    return this.http.delete<any>(`${this.apiUrl}users/${id}`);
  } 

  getMainPageData(): Observable<MainPageData> {
    return this.http.get<MainPageData>(this.apiUrl);
  }
  updateCategory(body: { idTweet: string; oldCategory?: string, newCategory?: string}): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.apiUrl+'update_category',body, {headers});
    
  }
 
  updateSentiment(body: { idTweet: string; oldSentiment?: string, newSentiment?: string}): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.apiUrl+'update_sentiment',body, {headers});
    
  }

  createNewUser(body: { name?: string; mail?: string; estado?: string, tipo: string}): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.apiUrl+'create_user',body, {headers});
  }
  syncUsers(body: any, token: string): Observable<any> {
    const headers = {Authorization: `Bearer ${token}`}; 
    return this.http.post<any>(this.apiUrl+'sync',body, {headers});   
  
  }   
  getMainPageStats(): Observable<HomePageResponse> {

    return this.http.get<HomePageResponse>(this.apiUrl+'main_dashboard');
  }
 getWordcloud(body: any) {
  return this.http.post(`${this.apiUrl}/wordcloud`, body, {
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

createUserPlan(body: any, token: string) {
  return this.http.post(this.apiUrl + 'create_plan', body, {
    headers: { Authorization: `Bearer ${token}` }
  });
}


  



  }
