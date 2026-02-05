import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AccountMeResponse } from '../interfaces/me';


@Injectable({
  providedIn: 'root'
})
export class AccountService {

  private baseUrl = 'https://netvoraback-109294037791.europe-west1.run.app/';

  constructor(private http: HttpClient) {}

  me(): Observable<AccountMeResponse> {
    return this.http.get<AccountMeResponse>(`${this.baseUrl}/api/account/me`);
  }
}
