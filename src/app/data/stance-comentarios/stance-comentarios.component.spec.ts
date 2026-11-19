import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { of } from 'rxjs';
import { AppModule } from '../../app.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StanceComentariosComponent } from './stance-comentarios.component';

describe('StanceComentariosComponent', () => {
  let component: StanceComentariosComponent;
  let fixture: ComponentFixture<StanceComentariosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, HttpClientTestingModule],
      providers: [{ provide: AngularFireAuth, useValue: { authState: of(null), currentUser: Promise.resolve(null) } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StanceComentariosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
