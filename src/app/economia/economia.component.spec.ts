import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EconomiaComponent } from './economia.component';

describe('EconomiaComponent', () => {
  let component: EconomiaComponent;
  let fixture: ComponentFixture<EconomiaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EconomiaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EconomiaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
