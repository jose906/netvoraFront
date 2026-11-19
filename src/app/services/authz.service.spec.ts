import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzService } from './authz.service';

describe('AuthzService', () => {
  let service: AuthzService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AuthzService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
