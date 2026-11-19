import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthzService } from './services/authz.service';
import { SuscriptionService } from './services/suscription.service';

@Component({ selector: 'app-menu', template: '' })
class MenuStubComponent {}

describe('AppComponent', () => {
  it('clears account state when there is no active session', () => {
    const authz = jasmine.createSpyObj('AuthzService', ['reset', 'refreshMe']);
    const subscription = jasmine.createSpyObj(
      'SuscriptionService', ['clear', 'fetchStatus'], { status$: of(null) }
    );

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppComponent, MenuStubComponent],
      providers: [
        { provide: AngularFireAuth, useValue: { authState: of(null) } },
        { provide: AuthzService, useValue: authz },
        { provide: SuscriptionService, useValue: subscription }
      ]
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(authz.reset).toHaveBeenCalled();
    expect(subscription.clear).toHaveBeenCalled();
    expect(subscription.fetchStatus).not.toHaveBeenCalled();
  });
});
