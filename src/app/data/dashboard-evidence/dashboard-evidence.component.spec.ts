import { SimpleChange } from '@angular/core';
import { Subject } from 'rxjs';
import { DashboardEvidence } from '../../interfaces/dashboard-evidence';
import { ApiService } from '../../services/api.service';
import { DashboardEvidenceComponent } from './dashboard-evidence.component';

describe('DashboardEvidenceComponent', () => {
  it('opens publications for a selected interval and cancels the request on filter changes', () => {
    const response = new Subject<DashboardEvidence>();
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['getDashboardEvidence']);
    api.getDashboardEvidence.and.returnValue(response);
    const component = new DashboardEvidenceComponent(api);
    component.startDate = new Date(2026, 10, 18);
    component.selectedUsers = ['1'];
    component.rows = [{ fecha: '2026-11-18', total: 6 }];

    component.openPoint(0);

    expect(api.getDashboardEvidence).toHaveBeenCalledWith(jasmine.objectContaining({
      bucket: '2026-11-18',
      users: ['1'],
      page: 1
    }));
    expect(component.active).toBeTrue();
    expect(response.observed).toBeTrue();

    component.ngOnChanges({ search: new SimpleChange('', 'Nueva búsqueda', false) });

    expect(response.observed).toBeFalse();
    expect(component.active).toBeFalse();
    expect(component.loading).toBeFalse();
  });
});
