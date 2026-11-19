import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { of } from 'rxjs';
import { AppModule } from '../../app.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoliticaEstadisticasComponent } from './politica-estadisticas.component';

describe('PoliticaEstadisticasComponent', () => {
  let component: PoliticaEstadisticasComponent;
  let fixture: ComponentFixture<PoliticaEstadisticasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, HttpClientTestingModule],
      providers: [{ provide: AngularFireAuth, useValue: { authState: of(null), currentUser: Promise.resolve(null) } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoliticaEstadisticasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
