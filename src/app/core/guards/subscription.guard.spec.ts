import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AuthzService } from '../../services/authz.service';
import { SuscriptionService } from '../../services/suscription.service';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  let session: Subject<unknown>;
  let fetchStatus: jasmine.Spy;
  let guard: SubscriptionGuard;

  beforeEach(() => {
    session = new Subject();
    fetchStatus = jasmine.createSpy('fetchStatus');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AngularFireAuth, useValue: { authState: session } },
        { provide: AuthzService, useValue: { isLoaded: () => true, role: 'viewer' } },
        { provide: SuscriptionService, useValue: { fetchStatus } }
      ]
    });
    guard = TestBed.inject(SubscriptionGuard);
  });

  it('waits for restored authentication before checking the plan', async () => {
    fetchStatus.and.returnValue(of({ subscription: { status: 'active', ok: true } }));
    const result = firstValueFrom(guard.canActivate());
    expect(fetchStatus).not.toHaveBeenCalled();
    session.next({ uid: 'user' });
    expect(await result).toBeTrue();
  });

  it('keeps the requested route when subscription status is unavailable', async () => {
    fetchStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const result = firstValueFrom(guard.canActivate());
    session.next({ uid: 'user' });
    expect(await result).toBeTrue();
  });

  it('redirects a confirmed expired subscription to Perfil', async () => {
    fetchStatus.and.returnValue(of({ subscription: { status: 'expired', ok: false } }));
    const result = firstValueFrom(guard.canActivate());
    session.next({ uid: 'user' });
    const router = TestBed.inject(Router);
    expect(await result).toEqual(router.createUrlTree(['/perfil'], {
      queryParams: { reason: 'expired', end: '' }
    }));
  });
});
