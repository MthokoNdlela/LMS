import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { Customer, Loan, LoanApplication } from '../../core/models';
import { Badge } from '../../shared/badge';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DecimalPipe, Badge],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Dashboard</h1>
        <span class="spacer"></span>
        <a class="btn primary" routerLink="/customers/new">New customer</a>
        <a class="btn" routerLink="/applications/new">New application</a>
      </div>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <div class="stats">
        <div class="stat"><div class="label">Customers</div><div class="value">{{ customers().length }}</div></div>
        <div class="stat"><div class="label">Applications to action</div><div class="value">{{ pending() }}</div></div>
        <div class="stat"><div class="label">Open loans</div><div class="value">{{ openLoans().length }}</div></div>
        <div class="stat"><div class="label">Total outstanding</div><div class="value">{{ totalOutstanding() | number: '1.2-2' }}</div></div>
        <div class="stat" [class.bad]="arrearsLoans().length > 0">
          <div class="label">In arrears</div>
          <div class="value">{{ arrearsLoans().length }} <span class="muted" style="font-size: 14px">({{ totalArrears() | number: '1.2-2' }})</span></div>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h2>Recent applications</h2>
          @if (recent().length === 0) {
            <div class="empty">{{ loading() ? 'Loading…' : 'No applications yet.' }}</div>
          } @else {
            <table class="table">
              <thead><tr><th>Number</th><th>Customer</th><th class="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                @for (a of recent(); track a.id) {
                  <tr>
                    <td><a [routerLink]="['/applications', a.id]">{{ a.applicationNumber }}</a></td>
                    <td>{{ a.customerName }}</td>
                    <td class="num">{{ a.requestedAmount | number: '1.2-2' }}</td>
                    <td><app-badge [value]="a.status" /></td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="card">
          <h2>Loans in arrears</h2>
          @if (arrearsLoans().length === 0) {
            <div class="empty">{{ loading() ? 'Loading…' : 'No loans are in arrears.' }}</div>
          } @else {
            <table class="table">
              <thead><tr><th>Loan</th><th>Customer</th><th class="num">Arrears</th><th class="num">Days</th></tr></thead>
              <tbody>
                @for (l of arrearsLoans(); track l.id) {
                  <tr>
                    <td><a [routerLink]="['/loans', l.id]">{{ l.loanNumber }}</a></td>
                    <td>{{ l.customerName }}</td>
                    <td class="num">{{ l.arrearsAmount | number: '1.2-2' }}</td>
                    <td class="num">{{ l.daysInArrears }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `,
})
export class Dashboard {
  private readonly api = inject(Api);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly applications = signal<LoanApplication[]>([]);
  protected readonly loans = signal<Loan[]>([]);

  protected readonly pending = computed(
    () => this.applications().filter((a) => a.status === 'Submitted' || a.status === 'UnderReview').length,
  );
  protected readonly openLoans = computed(() => this.loans().filter((l) => l.status === 'Active' || l.status === 'Defaulted'));
  protected readonly totalOutstanding = computed(() => this.openLoans().reduce((sum, l) => sum + l.totalOutstanding, 0));
  protected readonly arrearsLoans = computed(() => this.loans().filter((l) => l.arrearsAmount > 0));
  protected readonly totalArrears = computed(() => this.arrearsLoans().reduce((sum, l) => sum + l.arrearsAmount, 0));
  protected readonly recent = computed(() => this.applications().slice(0, 5));

  constructor() {
    forkJoin({ customers: this.api.customers(), applications: this.api.applications(), loans: this.api.loans() }).subscribe({
      next: (data) => {
        this.customers.set(data.customers);
        this.applications.set(data.applications);
        this.loans.set(data.loans);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(apiError(e));
        this.loading.set(false);
      },
    });
  }
}
