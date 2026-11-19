import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { of } from 'rxjs';
import { AppModule } from '../../app.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TodosComponent } from './todos.component';

describe('TodosComponent', () => {
  let component: TodosComponent;
  let fixture: ComponentFixture<TodosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule, HttpClientTestingModule],
      providers: [{ provide: AngularFireAuth, useValue: { authState: of(null), currentUser: Promise.resolve(null) } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TodosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the filter prompt without leaving any section loading', () => {
    component.cargarDatos();
    fixture.detectChanges();

    expect(component.cargandoDashboard).toBeFalse();
    expect(component.loadingTopicTimeline).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('Selecciona un período');
  });
});
