import { DashboardEntityType } from '../interfaces/dashboard-evidence';

export interface StatisticsFilters {
  start: string;
  end: string;
  users: string[];
  topic_ids: number[];
  search: string;
  categoria?: string;
  type_user?: 'Medio' | 'Entidad' | 'Persona';
  entidad?: string;
  entity_type?: DashboardEntityType;
}

type DateRange = [string, string];

export type StatisticsSourceGroup = 'only_current' | 'only_previous' | 'in_both';

interface StatisticsSourceExample {
  id: string;
  name: string;
  current_posts: number;
  previous_posts: number;
}

export interface StatisticsBucket {
  range: DateRange;
  previous_range: DateRange;
  current: number;
  previous: number;
  positive: number;
  neutral: number;
  negative: number;
  classified: number;
}

export interface StatisticsInsights {
  days_per_bucket: number;
  previous_range: DateRange;
  current_total: number;
  previous_total: number;
  buckets: StatisticsBucket[];
  heatmap: {
    days: number;
    cells: ({ posts: number; average: number } | null)[];
  }[];
  topics: { topic_id: number; topic_name: string; posts: number; sources: number }[];
  agenda_change?: {
    topic_id: number; topic_name: string; posts: number; previous_posts: number;
    current_share: number; previous_share: number; change: number;
  }[];
  topic_overlap?: { first_id: number; second_id: number; shared: number; union: number; percentage: number }[];
  topic_coverage?: { labels: number; posts: number; share: number }[];
  source_turnover?: {
    only_current: number; only_previous: number; in_both: number;
    examples: Record<StatisticsSourceGroup, StatisticsSourceExample[]>;
  };
  includes_today: boolean;
  heatmap_today: boolean;
}

export function formatCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatStatisticsRange([start, end]: DateRange, year = true): string {
  const format = (day: string) => day.split('-').reverse().slice(0, year ? 3 : 2).join('/');
  return start === end ? format(start) : `${format(start)} al ${format(end)}`;
}

export function previousStatisticsRange(start: Date, end: Date | null): DateRange {
  const dayInMs = 86_400_000;
  const utcDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const isoDay = (day: number) => new Date(day).toISOString().slice(0, 10);
  const first = utcDay(start);
  const last = utcDay(end ?? start);
  return [isoDay(first - (last - first) - dayInMs), isoDay(first - dayInMs)];
}
