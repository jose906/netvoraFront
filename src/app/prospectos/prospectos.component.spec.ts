import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { ProspectosRespuesta, ProspectosService } from '../services/prospectos.service';
import { ProspectosComponent } from './prospectos.component';

describe('ProspectosComponent', () => {
  it('retains the results of the latest search', () => {
    const inicial = new Subject<ProspectosRespuesta>();
    const ultima = new Subject<ProspectosRespuesta>();
    const listar = jasmine.createSpy('listar').and.returnValues(inicial, ultima);

    TestBed.configureTestingModule({
      declarations: [ProspectosComponent],
      imports: [FormsModule, MatIconModule],
      providers: [{ provide: ProspectosService, useValue: { listar } }]
    });

    const fixture = TestBed.createComponent(ProspectosComponent);
    fixture.detectChanges();
    const componente = fixture.componentInstance;
    componente.buscar = 'Ana';
    componente.filtrar();

    ultima.next({ ok: true, total: 1, pagina: 1, limite: 25, prospectos: [] });
    inicial.next({ ok: true, total: 10, pagina: 1, limite: 25, prospectos: [] });

    expect(listar).toHaveBeenCalledWith('Ana', '', 1, 25);
    expect(componente.total).toBe(1);
    expect(componente.cargando).toBeFalse();
  });
});
