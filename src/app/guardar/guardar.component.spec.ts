import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { of } from 'rxjs';
import { AppModule } from '../app.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuardarComponent } from './guardar.component';

describe('GuardarComponent', () => {
  let component: GuardarComponent;
  let fixture: ComponentFixture<GuardarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, HttpClientTestingModule],
      providers: [{ provide: AngularFireAuth, useValue: { authState: of(null), currentUser: Promise.resolve(null) } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuardarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
