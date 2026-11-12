import { TestBed } from '@angular/core/testing';

import { ProspectosService } from './prospectos.service';

describe('ProspectosService', () => {
  let service: ProspectosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProspectosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
