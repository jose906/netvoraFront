import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ProspectoFormulario, ProspectosService } from './prospectos.service';

describe('ProspectosService', () => {
  let service: ProspectosService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/admin/prospectos`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ProspectosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the expected list endpoint and parameters', () => {
    service.listar('  Ana  ', 'nuevo', 2).subscribe();

    const request = http.expectOne(req => req.method === 'GET' && req.url === url);
    expect(request.request.params.get('buscar')).toBe('Ana');
    expect(request.request.params.get('estado')).toBe('nuevo');
    expect(request.request.params.get('pagina')).toBe('2');
    expect(request.request.params.get('limite')).toBe('25');
    request.flush({ ok: true, prospectos: [], total: 0 });
  });

  it('uses the expected endpoints for creation, editing and email', () => {
    const form: ProspectoFormulario = {
      nombre: 'Ana', email: 'ana@example.com', organizacion: '', cargo: '', telefono: '',
      origen: '', estado: 'nuevo', notas: '', no_contactar: false
    };

    service.crear(form).subscribe();
    const create = http.expectOne({ method: 'POST', url });
    expect(create.request.body).toEqual(form);
    create.flush({ ok: true });

    service.editar(1, form).subscribe();
    http.expectOne({ method: 'PATCH', url: `${url}/1` }).flush({ ok: true });

    service.enviarCorreo(1, { tipo: 'presentacion' }).subscribe();
    http.expectOne({ method: 'POST', url: `${url}/1/enviar-correo` }).flush({ ok: true });
  });
});
