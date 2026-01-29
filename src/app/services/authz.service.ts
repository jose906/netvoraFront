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

  constructor(private http: HttpClient) {}

  /** Llamar SOLO cuando ya existe sesión firebase (token lo pone el interceptor) */
  async refreshMe(): Promise<void> {
    try {
      const me = await firstValueFrom(
        this.http.get<MeResponse>('https://netvoraback-109294037791.europe-west1.run.app/api/auth/me')
      );

      const role = (me.role || 'viewer').toString().trim().toLowerCase() as UserRole;
      this.roleSubject.next(role);
      this.loaded = true;

      console.log('✅ role loaded:', role);
    } catch (err) {
      console.error('❌ refreshMe failed:', err);
      this.roleSubject.next('viewer');
      this.loaded = true;
    }
  }

  reset(): void {
    this.roleSubject.next('viewer');
    this.loaded = false;
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
