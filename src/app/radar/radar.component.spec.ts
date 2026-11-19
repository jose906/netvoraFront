import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { RadarSnapshot, RadarWatch } from '../interfaces/radar';
import { ApiService } from '../services/api.service';
import { RadarComponent } from './radar.component';

describe('RadarComponent', () => {
  it('selects the newest evaluation and displays recent activity in date order', () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['getRadarHistory']);
    const day = (observation_day: string, total: number): RadarSnapshot => ({
      observation_day,
      note: '',
      review_state: 'new',
      evidence: {
        total, baseline: 0, active_history: 0, signals: [], quality: {}, sources: [],
        evidence: { posts: [], sources: [], topics: [] }
      }
    });
    const earlier = day('2026-11-16', 5);
    const latest = day('2026-11-17', 20);
    api.getRadarHistory.and.returnValue(of({ history: [earlier, latest] }));

    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as ActivatedRoute;
    const component = new RadarComponent(api, route);
    const watch: RadarWatch = {
      id: 'test', name: 'Medios', cadence: 'none', paused: false,
      filters: { view: 'todos', users: [], topic_ids: [], search: '' }
    };
    component.select(watch);

    expect(component.snapshot).toBe(latest);
    expect(component.recentActivity).toEqual([
      { day: earlier, height: 25 },
      { day: latest, height: 100 }
    ]);
    component.selectDay(earlier);
    expect(component.snapshot).toBe(earlier);
    component.ngOnDestroy();
  });
});
