import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstadisticasEntiPersonasComponent } from './estadisticas-enti-personas.component';

describe('EstadisticasEntiPersonasComponent', () => {
  let component: EstadisticasEntiPersonasComponent;
  let fixture: ComponentFixture<EstadisticasEntiPersonasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EstadisticasEntiPersonasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstadisticasEntiPersonasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
