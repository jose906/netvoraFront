import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StanceComentariosComponent } from './stance-comentarios.component';

describe('StanceComentariosComponent', () => {
  let component: StanceComentariosComponent;
  let fixture: ComponentFixture<StanceComentariosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StanceComentariosComponent]
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
