import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, defer } from 'rxjs';
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

  private readonly baseUrl = environment.apiUrl;
  private generation = 0;
  private _status$ = new BehaviorSubject<SubscriptionStatusResponse | null>(null);
  status$ = this._status$.asObservable();

  constructor(private http: HttpClient) {}

  fetchStatus(): Observable<SubscriptionStatusResponse> {
    return defer(() => {
      const generation = this.generation;
      return this.http.get<SubscriptionStatusResponse>(`${this.baseUrl}/subscription/status`).pipe(
        tap(response => {
          if (generation === this.generation) this._status$.next(response);
        })
      );
    });
  }

  get snapshot(): SubscriptionStatusResponse | null {
   
    return this._status$.value;
  }

  clear(): void {
    this.generation++;
    this._status$.next(null);
  }
}
