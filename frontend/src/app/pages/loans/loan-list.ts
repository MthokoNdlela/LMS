import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { LOAN_STATUSES, Loan, LoanStatus } from '../../core/models';
import { Badge } from '../../shared/badge';
import { HumanizePipe } from '../../shared/humanize.pipe';

@Component({
  selector: 'app-loan-list',
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, Badge, HumanizePipe],
  template: `
    <div class="page">
      <div class="page-header"><h1>Loans</h1></div>

      <form class="toolbar" [formGroup]="filter">
        <select formControlName="status" aria-label="Filter by status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s | humanize }}</option> }
        </select>
        <label class="check"><input type="checkbox" formControlName="inArrears" /> In arrears only</label>
      </form>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <div class="card table-wrap">
        @if (loans().length === 0) {
          <div class="empty">{{ loading() ? 'Loading…' : 'No loans found. Loans are created by approving an application.' }}</div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Loan</th><th>Customer</th><th class="num">Principal</th><th class="num">Instalment</th>
                <th class="num">Outstanding</th><th class="num">Arrears</th><th class="num">Days</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (l of loans(); track l.id) {
                <tr>
                  <td><a [routerLink]="['/loans', l.id]">{{ l.loanNumber }}</a></td>
                  <td><a [routerLink]="['/customers', l.customerId]">{{ l.customerName }}</a></td>
                  <td class="num">{{ l.principalAmount | number: '1.2-2' }}</td>
                  <td class="num">{{ l.monthlyInstallment | number: '1.2-2' }}</td>
                  <td class="num">{{ l.totalOutstanding | number: '1.2-2' }}</td>
                  <td class="num">{{ l.arrearsAmount > 0 ? (l.arrearsAmount | number: '1.2-2') : '-' }}</td>
                  <td class="num">{{ l.daysInArrears > 0 ? l.daysInArrears : '-' }}</td>
                  <td><app-badge [value]="l.status" /></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class LoanList {
  private readonly api = inject(Api);

  protected readonly statuses = LOAN_STATUSES;
  protected readonly filter = inject(FormBuilder).nonNullable.group({
    status: ['' as LoanStatus | ''],
    inArrears: [false],
  });
  protected readonly loans = signal<Loan[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.filter.valueChanges
      .pipe(
        startWith(this.filter.getRawValue()),
        tap(() => this.loading.set(true)),
        switchMap((f) =>
          this.api.loans({ status: f.status ?? '', inArrears: f.inArrears ? true : undefined }).pipe(
            tap(() => this.error.set(null)),
            catchError((e: unknown) => {
              this.error.set(apiError(e));
              return of([] as Loan[]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.loans.set(list);
        this.loading.set(false);
      });
  }
}
