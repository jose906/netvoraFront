import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaludComponent } from './salud.component';

describe('SaludComponent', () => {
  let component: SaludComponent;
  let fixture: ComponentFixture<SaludComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SaludComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaludComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
