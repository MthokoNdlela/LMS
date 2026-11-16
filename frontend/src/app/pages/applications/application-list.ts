import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { APPLICATION_STATUSES, LoanApplication } from '../../core/models';
import { Badge } from '../../shared/badge';
import { HumanizePipe } from '../../shared/humanize.pipe';

@Component({
  selector: 'app-application-list',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, DecimalPipe, Badge, HumanizePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Loan applications</h1>
        <span class="spacer"></span>
        <a class="btn primary" routerLink="/applications/new">New application</a>
      </div>

      <div class="toolbar">
        <select [formControl]="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s | humanize }}</option> }
        </select>
      </div>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <div class="card table-wrap">
        @if (applications().length === 0) {
          <div class="empty">{{ loading() ? 'Loading…' : 'No applications found.' }}</div>
        } @else {
          <table class="table">
            <thead><tr><th>Number</th><th>Customer</th><th>Product</th><th class="num">Amount</th><th class="num">Term</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              @for (a of applications(); track a.id) {
                <tr>
                  <td><a [routerLink]="['/applications', a.id]">{{ a.applicationNumber }}</a></td>
                  <td><a [routerLink]="['/customers', a.customerId]">{{ a.customerName }}</a></td>
                  <td>{{ a.productName }}</td>
                  <td class="num">{{ a.requestedAmount | number: '1.2-2' }}</td>
                  <td class="num">{{ a.termMonths }} m</td>
                  <td><app-badge [value]="a.status" /></td>
                  <td class="nowrap">{{ a.createdAt | date: 'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class ApplicationList {
  private readonly api = inject(Api);

  protected readonly statuses = APPLICATION_STATUSES;
  protected readonly status = inject(FormBuilder).nonNullable.control<LoanApplication['status'] | ''>('');
  protected readonly applications = signal<LoanApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.status.valueChanges
      .pipe(
        startWith(this.status.value),
        tap(() => this.loading.set(true)),
        switchMap((status) =>
          this.api.applications({ status }).pipe(
            tap(() => this.error.set(null)),
            catchError((e: unknown) => {
              this.error.set(apiError(e));
              return of([] as LoanApplication[]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.applications.set(list);
        this.loading.set(false);
      });
  }
}
