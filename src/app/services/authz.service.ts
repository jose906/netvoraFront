import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

export type UserRole = 'admin' | 'analista' | 'viewer';

interface MeResponse {
  uid: string;
  email?: string;
  name?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthzService {
  private roleSubject = new BehaviorSubject<UserRole>('viewer');
  role$ = this.roleSubject.asObservable();

  private loaded = false;
  private generation = 0;
  private pending?: Promise<void>;

  constructor(private http: HttpClient) {}

  refreshMe(): Promise<void> {
    if (this.pending) return this.pending;

    const generation = this.generation;
    this.pending = this.loadRole(generation).finally(() => {
      if (generation === this.generation) this.pending = undefined;
    });
    return this.pending;
  }

  private async loadRole(generation: number): Promise<void> {
    try {
      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${environment.apiUrl}/api/auth/me`)
      );
      if (generation !== this.generation) return;

      const role = me.role?.trim().toLowerCase();
      this.loaded = true;
      this.roleSubject.next(role === 'admin' || role === 'analista' ? role : 'viewer');
    } catch {
      if (generation !== this.generation) return;

      this.loaded = false;
      this.roleSubject.next('viewer');
    }
  }

  reset(): void {
    this.generation++;
    this.pending = undefined;
    this.loaded = false;
    this.roleSubject.next('viewer');
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  hasRole(...allowed: UserRole[]): boolean {
    return allowed.includes(this.roleSubject.value);
  }

  get role(): UserRole {
    return this.roleSubject.value;
  }
}
