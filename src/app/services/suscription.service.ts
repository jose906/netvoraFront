import { Injectable,NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export type SubStatus =
  | 'active'
  | 'missing'
  | 'expired'
  | 'inactive_plan'
  | 'not_started'
  | 'skip_role';

export interface SubscriptionInfo {
  ok: boolean;
  status: SubStatus;
  plan_name?: string;
  end_date?: string;    // "YYYY-MM-DD"
  days_left?: number;
  warning?: boolean;
}

export interface SubscriptionStatusResponse {
  role: string;
  subscription: SubscriptionInfo;
}

@Injectable({
  providedIn: 'root'
})
export class SuscriptionService {

    private baseUrl = 'https://netvoraback-109294037791.europe-west1.run.app'; // <-- ajusta
  private _status$ = new BehaviorSubject<SubscriptionStatusResponse | null>(null);
  status$ = this._status$.asObservable();

  constructor(private http: HttpClient) {}

  fetchStatus(): Observable<SubscriptionStatusResponse> {
    return this.http.get<SubscriptionStatusResponse>(`${this.baseUrl}/subscription/status`)
      .pipe(tap(res => this._status$.next(res)));
  }

  get snapshot(): SubscriptionStatusResponse | null {
   
    return this._status$.value;
  }

  clear() {
    this._status$.next(null);
  }
}
