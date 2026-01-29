import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoliticaEstadisticasComponent } from './politica-estadisticas.component';

describe('PoliticaEstadisticasComponent', () => {
  let component: PoliticaEstadisticasComponent;
  let fixture: ComponentFixture<PoliticaEstadisticasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PoliticaEstadisticasComponent]
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
