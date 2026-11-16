import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, of, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { AuditLog } from '../../core/models';

const ENTITY_TYPES = [
  'Customer', 'CustomerDocument', 'LoanProduct', 'LoanApplication', 'AffordabilityAssessment', 'Loan', 'Payment', 'CollectionActivity',
];

@Component({
  selector: 'app-audit-log',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-header"><h1>Audit log</h1><span class="sub">Important changes and decisions, newest first.</span></div>

      <form class="toolbar" [formGroup]="filter">
        <select formControlName="entityType" aria-label="Entity type">
          <option value="">All entities</option>
          @for (t of entityTypes; track t) { <option [value]="t">{{ t }}</option> }
        </select>
        <input type="number" placeholder="Entity id" formControlName="entityId" />
        <input placeholder="Action starts with…" formControlName="action" />
        <input placeholder="User" formControlName="username" />
        <select formControlName="take" aria-label="Rows">
          <option [ngValue]="50">50 rows</option>
          <option [ngValue]="100">100 rows</option>
          <option [ngValue]="500">500 rows</option>
        </select>
      </form>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <div class="card table-wrap">
        @if (logs().length === 0) {
          <div class="empty">{{ loading() ? 'Loading…' : 'No audit entries match.' }}</div>
        } @else {
          <table class="table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              @for (l of logs(); track l.id) {
                <tr>
                  <td class="nowrap">{{ l.timestamp | date: 'medium' }}</td>
                  <td>{{ l.username }}</td>
                  <td>{{ l.action }}</td>
                  <td class="nowrap">{{ l.entityType }} #{{ l.entityId }}</td>
                  <td class="muted">{{ l.details }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class AuditLogPage {
  private readonly api = inject(Api);

  protected readonly entityTypes = ENTITY_TYPES;
  protected readonly filter = inject(FormBuilder).group({
    entityType: [''],
    entityId: [null as number | null],
    action: [''],
    username: [''],
    take: [100],
  });
  protected readonly logs = signal<AuditLog[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.filter.valueChanges
      .pipe(
        startWith(this.filter.getRawValue()),
        debounceTime(300),
        tap(() => this.loading.set(true)),
        switchMap((f) =>
          this.api
            .auditLogs({
              entityType: f.entityType ?? '',
              entityId: f.entityId,
              action: f.action?.trim() ?? '',
              username: f.username?.trim() ?? '',
              take: f.take ?? 100,
            })
            .pipe(
              tap(() => this.error.set(null)),
              catchError((e: unknown) => {
                this.error.set(apiError(e));
                return of([] as AuditLog[]);
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.logs.set(list);
        this.loading.set(false);
      });
  }
}
