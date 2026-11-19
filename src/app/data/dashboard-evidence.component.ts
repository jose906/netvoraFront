import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api.service';
import { users } from '../interfaces/users';
import { DashboardEntityType, DashboardEvidence, DashboardEvidenceFilters, DashboardSelection } from '../interfaces/dashboard-evidence';

@Component({
  standalone: true,
  selector: 'app-dashboard-evidence',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-evidence.component.html',
  styleUrl: './dashboard-evidence.component.css'
})
export class DashboardEvidenceComponent implements OnChanges, OnDestroy {
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;
  @Input() users: users[] = [];
  @Input() selectedUsers: string[] = [];
  @Input() selectedTopics: number[] = [];
  @Input() search = '';
  @Input() categoria = '';
  @Input() entity?: string;
  @Input() entityType?: DashboardEntityType;
  @Input() typeUser = '';
  @Input() interval = '1d';
  @Input() rows: { fecha: string; total: number }[] = [];
  @ViewChild('detailsAnchor') private detailsAnchor?: ElementRef<HTMLElement>;
  @Output() applySelection = new EventEmitter<DashboardSelection>();

  result?: DashboardEvidence;
  selection: DashboardSelection = {};
  active = false;
  loading = false;
  error = false;
  page = 1;
  showTable = false;
  private request?: Subscription;

  get effectiveAccounts(): users[] {
    return this.selectedUsers.length
      ? this.users.filter(user => this.selectedUsers.includes(String(user.idTweetUser))) : this.users;
  }

  constructor(private api: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (Object.keys(changes).some(key => key !== 'rows')) {
      this.request?.unsubscribe();
      this.selection = {};
      this.result = undefined;
      this.active = false;
      this.loading = false;
      this.error = false;
    }
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  openPoint(index: number | undefined): void {
    const bucket = index === undefined ? undefined : this.rows[index]?.fecha;
    if (bucket) this.open({ bucket });
  }

  openFromRanking(selection: DashboardSelection): void {
    this.open(selection);
    this.detailsAnchor?.nativeElement.scrollIntoView({ block: 'nearest' });
  }

  open(selection: DashboardSelection = {}): void {
    this.selection = selection;
    this.load(1);
  }

  load(page: number): void {
    const start = this.startDate;
    const users = this.selection.sourceId ? [this.selection.sourceId] :
      this.selectedUsers.length ? this.selectedUsers : this.users.map(user => String(user.idTweetUser));
    if (!start || !users.length) return;
    const filters: DashboardEvidenceFilters = {
      start: this.dateString(start),
      end: this.dateString(this.endDate ?? start),
      users,
      topic_ids: this.selection.topicId ? [this.selection.topicId] : this.selectedTopics,
      search: this.search,
      categoria: this.categoria,
      type_user: this.typeUser,
      entidad: this.selection.entity || this.entity,
      entity_type: this.selection.entityType || this.entityType,
      bucket: this.selection.bucket,
      interval: this.selection.bucket?.length === 10 ? '1d' : this.interval,
      page
    };
    this.request?.unsubscribe();
    this.active = this.loading = true;
    this.error = false;
    this.result = undefined;
    this.page = page;
    this.request = this.api.getDashboardEvidence(filters).subscribe({
      next: result => { this.result = result; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  private dateString(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')].join('-');
  }

  close(): void {
    this.request?.unsubscribe();
    this.active = this.loading = false;
  }

  exportCsv(): void {
    const csvCell = (value: string) => {
      const escaped = /^[=+@\-\t\r\n]/.test(value) ? "'" + value : value;
      return '"' + escaped.replace(/"/g, '""') + '"';
    };
    const scope = [
      this.startDate ? this.dateString(this.startDate) : '',
      this.endDate ? this.dateString(this.endDate) : this.startDate ? this.dateString(this.startDate) : '',
      this.categoria, this.typeUser, this.entity ?? '',
      this.effectiveAccounts.map(account => account.idTweetUser).join(' | '),
      this.selectedTopics.join(' | '), this.search
    ].map(csvCell).join(',');
    const csv = ['Fecha y hora (Bolivia),Publicaciones,Inicio,Fin,Categoría,Tipo de cuenta,Mención,IDs de cuentas,IDs de tópicos,Búsqueda',
      ...this.rows.map(row => csvCell(row.fecha) + ',' + row.total + ',' + scope)
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'netvora-actividad.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
