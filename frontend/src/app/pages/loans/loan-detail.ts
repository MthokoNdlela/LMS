import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { blankToNull, today } from '../../core/format';
import {
  ACTIVITY_TYPES, ActivityType, CollectionActivity, Loan, LoanStatus, PAYMENT_METHODS, PaymentMethod, Payment, ScheduleRow,
} from '../../core/models';
import { Badge } from '../../shared/badge';
import { HumanizePipe } from '../../shared/humanize.pipe';

type Tab = 'schedule' | 'payments' | 'collections';

@Component({
  selector: 'app-loan-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, DecimalPipe, Badge, HumanizePipe],
  template: `
    <div class="page">
      @if (loan(); as l) {
        <div class="page-header">
          <h1>{{ l.loanNumber }}</h1>
          <app-badge [value]="l.status" />
          <span class="sub">
            <a [routerLink]="['/customers', l.customerId]">{{ l.customerName }}</a> ·
            <a [routerLink]="['/applications', l.loanApplicationId]">application</a>
          </span>
          <span class="spacer"></span>
          @if (open()) {
            <button class="btn" type="button" [disabled]="busy()" (click)="lateFees(l.id)">Assess late fees</button>
          }
        </div>

        @if (error()) { <div class="alert error">{{ error() }}</div> }
        @if (message()) { <div class="alert success">{{ message() }}</div> }

        <div class="stats">
          <div class="stat"><div class="label">Total outstanding</div><div class="value">{{ l.totalOutstanding | number: '1.2-2' }}</div></div>
          <div class="stat"><div class="label">Principal outstanding</div><div class="value">{{ l.outstandingPrincipal | number: '1.2-2' }}</div></div>
          <div class="stat"><div class="label">Interest outstanding</div><div class="value">{{ l.outstandingInterest | number: '1.2-2' }}</div></div>
          <div class="stat"><div class="label">Fees outstanding</div><div class="value">{{ l.outstandingFees | number: '1.2-2' }}</div></div>
          <div class="stat" [class.bad]="l.arrearsAmount > 0">
            <div class="label">Arrears</div>
            <div class="value">{{ l.arrearsAmount | number: '1.2-2' }} <span class="muted" style="font-size: 14px">{{ l.daysInArrears }} days</span></div>
          </div>
        </div>

        <div class="grid two">
          <div class="card">
            <h2>Terms</h2>
            <dl class="details">
              <dt>Product</dt><dd>{{ l.productName }}</dd>
              <dt>Principal</dt><dd>{{ l.principalAmount | number: '1.2-2' }}</dd>
              <dt>Interest rate</dt><dd>{{ l.annualInterestRate | number: '1.2-2' }}% per year (reducing balance)</dd>
              <dt>Term</dt><dd>{{ l.termMonths }} months</dd>
              <dt>Instalment</dt><dd>{{ l.monthlyInstallment | number: '1.2-2' }} + {{ l.monthlyServiceFee | number: '1.2-2' }} service fee</dd>
              <dt>Initiation fee</dt><dd>{{ l.initiationFee | number: '1.2-2' }}</dd>
              <dt>Disbursed</dt><dd>{{ l.disbursementDate | date: 'mediumDate' }}</dd>
              <dt>First due</dt><dd>{{ l.firstDueDate | date: 'mediumDate' }}</dd>
              <dt>Matures</dt><dd>{{ l.maturityDate | date: 'mediumDate' }}</dd>
            </dl>
          </div>

          <div class="card">
            <h2>Status</h2>
            @if (l.status === 'Active') {
              <p class="muted">Mark the loan as defaulted when the customer has stopped paying.</p>
              <div class="field"><label for="sreason">Reason</label><input id="sreason" [formControl]="statusReason" /></div>
              <div class="actions"><button class="btn danger" type="button" [disabled]="busy()" (click)="setStatus(l.id, 'Defaulted')">Mark as defaulted</button></div>
            } @else if (l.status === 'Defaulted') {
              <p class="muted">Reinstate the loan, or write it off.</p>
              <div class="field"><label for="sreason">Reason</label><input id="sreason" [formControl]="statusReason" /></div>
              <div class="actions">
                <button class="btn good" type="button" [disabled]="busy()" (click)="setStatus(l.id, 'Active')">Reinstate</button>
                <button class="btn danger" type="button" [disabled]="busy()" (click)="setStatus(l.id, 'WrittenOff')">Write off</button>
              </div>
            } @else {
              <p class="muted">This loan is {{ (l.status | humanize).toLowerCase() }}; no further changes are possible.</p>
            }
          </div>
        </div>

        <div class="tabs">
          <button class="tab" type="button" [class.active]="tab() === 'schedule'" (click)="tab.set('schedule')">Repayment schedule</button>
          <button class="tab" type="button" [class.active]="tab() === 'payments'" (click)="tab.set('payments')">Payments ({{ payments().length }})</button>
          <button class="tab" type="button" [class.active]="tab() === 'collections'" (click)="tab.set('collections')">Collections ({{ activities().length }})</button>
        </div>

        @if (tab() === 'schedule') {
          <div class="card table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th class="num">#</th><th>Due</th><th class="num">Principal</th><th class="num">Interest</th><th class="num">Fees</th>
                  <th class="num">Total due</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of schedule(); track r.id) {
                  <tr [class.overdue]="r.isOverdue">
                    <td class="num">{{ r.installmentNumber }}</td>
                    <td class="nowrap">{{ r.dueDate | date: 'mediumDate' }}</td>
                    <td class="num">{{ r.principalDue | number: '1.2-2' }}</td>
                    <td class="num">{{ r.interestDue | number: '1.2-2' }}</td>
                    <td class="num">{{ r.feesDue | number: '1.2-2' }}@if (r.lateFeeCharged) { <span class="muted" title="Includes a late fee"> *</span> }</td>
                    <td class="num">{{ r.totalDue | number: '1.2-2' }}</td>
                    <td class="num">{{ r.totalPaid | number: '1.2-2' }}</td>
                    <td class="num">{{ r.outstanding | number: '1.2-2' }}</td>
                    <td>
                      <app-badge [value]="r.status" />
                      @if (r.isOverdue) { <span class="badge bad">{{ r.daysOverdue }}d overdue</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (tab() === 'payments') {
          @if (open()) {
            <form class="card" [formGroup]="paymentForm" (ngSubmit)="pay(l)">
              <h2>Record a payment</h2>
              <p class="muted">Applied to the oldest unpaid instalment first: fees, then interest, then principal.</p>
              <div class="form-grid">
                <div class="field">
                  <label for="pamount">Amount</label>
                  <input id="pamount" type="number" step="0.01" formControlName="amount" />
                  <span class="hint"><button class="btn sm" type="button" (click)="payInFull(l)">Pay in full ({{ l.totalOutstanding | number: '1.2-2' }})</button></span>
                </div>
                <div class="field"><label for="pdate">Payment date</label><input id="pdate" type="date" formControlName="paymentDate" [max]="maxDate" /></div>
                <div class="field">
                  <label for="pmethod">Method</label>
                  <select id="pmethod" formControlName="method">
                    @for (m of methods; track m) { <option [value]="m">{{ m | humanize }}</option> }
                  </select>
                </div>
                <div class="field"><label for="pref">Reference</label><input id="pref" formControlName="reference" /></div>
              </div>
              <div class="actions"><button class="btn primary" type="submit" [disabled]="busy()">Record payment</button></div>
            </form>
          }

          <div class="card table-wrap">
            @if (payments().length === 0) {
              <div class="empty">No payments yet.</div>
            } @else {
              <table class="table">
                <thead>
                  <tr><th>Date</th><th class="num">Amount</th><th>Method</th><th>Reference</th><th class="num">Fees</th><th class="num">Interest</th><th class="num">Principal</th><th>Received by</th><th></th></tr>
                </thead>
                <tbody>
                  @for (p of payments(); track p.id) {
                    <tr>
                      <td class="nowrap">{{ p.paymentDate | date: 'mediumDate' }}</td>
                      <td class="num">{{ p.amount | number: '1.2-2' }}</td>
                      <td>{{ p.method | humanize }}</td>
                      <td>{{ p.reference }}</td>
                      <td class="num">{{ p.feesAllocated | number: '1.2-2' }}</td>
                      <td class="num">{{ p.interestAllocated | number: '1.2-2' }}</td>
                      <td class="num">{{ p.principalAllocated | number: '1.2-2' }}</td>
                      <td>{{ p.receivedBy }}</td>
                      <td class="right"><button class="btn sm" type="button" (click)="toggleAllocations(p)">{{ expanded()?.id === p.id ? 'Hide' : 'Allocation' }}</button></td>
                    </tr>
                    @if (expanded()?.id === p.id) {
                      <tr>
                        <td colspan="9" class="muted">
                          @for (a of expanded()?.allocations ?? []; track a.repaymentScheduleId) {
                            <div>Instalment {{ a.installmentNumber }}: fees {{ a.feesAmount | number: '1.2-2' }}, interest {{ a.interestAmount | number: '1.2-2' }}, principal {{ a.principalAmount | number: '1.2-2' }}</div>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            }
          </div>
        }

        @if (tab() === 'collections') {
          @if (open()) {
            <form class="card" [formGroup]="activityForm" (ngSubmit)="logActivity(l.id)">
              <h2>Log collection activity</h2>
              <div class="form-grid">
                <div class="field">
                  <label for="atype">Type</label>
                  <select id="atype" formControlName="activityType">
                    @for (t of activityTypes; track t) { <option [value]="t">{{ t | humanize }}</option> }
                  </select>
                </div>
                <div class="field"><label for="aoutcome">Outcome</label><input id="aoutcome" formControlName="outcome" /></div>
                @if (isPromise() === 'PromiseToPay') {
                  <div class="field"><label for="pamt">Promised amount</label><input id="pamt" type="number" step="0.01" formControlName="promisedAmount" /></div>
                  <div class="field"><label for="pdt">Promised date</label><input id="pdt" type="date" formControlName="promisedDate" [min]="maxDate" /></div>
                }
                <div class="field wide"><label for="anotes">Notes</label><input id="anotes" formControlName="notes" /></div>
              </div>
              <div class="actions"><button class="btn primary" type="submit" [disabled]="busy()">Log activity</button></div>
            </form>
          }

          <div class="card table-wrap">
            @if (activities().length === 0) {
              <div class="empty">No collection activity yet.</div>
            } @else {
              <table class="table">
                <thead><tr><th>Date</th><th>Type</th><th>Outcome</th><th>Promise</th><th class="num">Arrears then</th><th>By</th></tr></thead>
                <tbody>
                  @for (a of activities(); track a.id) {
                    <tr>
                      <td class="nowrap">{{ a.activityDate | date: 'short' }}</td>
                      <td>{{ a.activityType | humanize }}@if (a.notes) { <div class="muted">{{ a.notes }}</div> }</td>
                      <td>{{ a.outcome }}</td>
                      <td>
                        @if (a.promiseStatus) {
                          {{ a.promisedAmount | number: '1.2-2' }} by {{ a.promisedDate | date: 'mediumDate' }}
                          <app-badge [value]="a.promiseStatus" />
                          @if (a.promiseStatus === 'Open') {
                            <button class="btn sm good" type="button" (click)="markPromise(a, 'Kept')">Kept</button>
                            <button class="btn sm danger" type="button" (click)="markPromise(a, 'Broken')">Broken</button>
                          }
                        }
                      </td>
                      <td class="num">{{ a.arrearsAmount | number: '1.2-2' }} <span class="muted">({{ a.daysInArrears }}d)</span></td>
                      <td>{{ a.createdBy }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }
      } @else if (error()) {
        <div class="alert error">{{ error() }}</div>
      } @else {
        <div class="empty">Loading…</div>
      }
    </div>
  `,
})
export class LoanDetail implements OnInit {
  private readonly api = inject(Api);

  readonly id = input.required<string>();

  protected readonly maxDate = today();
  protected readonly methods = PAYMENT_METHODS;
  protected readonly activityTypes = ACTIVITY_TYPES;

  protected readonly loan = signal<Loan | null>(null);
  protected readonly schedule = signal<ScheduleRow[]>([]);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly activities = signal<CollectionActivity[]>([]);
  protected readonly expanded = signal<Payment | null>(null);
  protected readonly tab = signal<Tab>('schedule');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly open = computed(() => {
    const status = this.loan()?.status;
    return status === 'Active' || status === 'Defaulted';
  });

  protected readonly statusReason = inject(FormBuilder).nonNullable.control('');

  protected readonly paymentForm = inject(FormBuilder).nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentDate: [today()],
    method: ['Eft' as PaymentMethod],
    reference: [''],
  });

  protected readonly activityForm = inject(FormBuilder).nonNullable.group({
    activityType: ['Call' as ActivityType],
    outcome: [''],
    notes: [''],
    promisedAmount: [null as number | null],
    promisedDate: [''],
  });
  protected readonly isPromise = toSignal(this.activityForm.controls.activityType.valueChanges, { initialValue: 'Call' as ActivityType });

  ngOnInit(): void {
    this.reload();
  }

  protected pay(loan: Loan): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.fail('Enter a payment amount above zero.');
      return;
    }

    const value = this.paymentForm.getRawValue();
    this.mutate(
      this.api.createPayment({ loanId: loan.id, amount: value.amount, paymentDate: value.paymentDate || null, method: value.method, reference: blankToNull(value.reference) }),
      'Payment recorded.',
      () => this.paymentForm.patchValue({ amount: 0, reference: '' }),
    );
  }

  protected payInFull(loan: Loan): void {
    this.paymentForm.patchValue({ amount: loan.totalOutstanding });
  }

  protected toggleAllocations(payment: Payment): void {
    if (this.expanded()?.id === payment.id) {
      this.expanded.set(null);
      return;
    }
    this.api.payment(payment.id).subscribe({
      next: (detail) => this.expanded.set(detail),
      error: (e: unknown) => this.fail(apiError(e)),
    });
  }

  protected lateFees(loanId: number): void {
    this.busy.set(true);
    this.clear();
    this.api.assessLateFees(loanId).subscribe({
      next: (result) => {
        this.message.set(
          result.installmentsCharged === 0
            ? 'No installments are past their grace period without a late fee.'
            : `Charged ${result.installmentsCharged} late fee(s) totalling ${result.feesCharged.toFixed(2)}.`,
        );
        this.busy.set(false);
        this.reload();
      },
      error: (e: unknown) => this.fail(apiError(e)),
    });
  }

  protected setStatus(loanId: number, status: LoanStatus): void {
    this.mutate(this.api.setLoanStatus(loanId, status, blankToNull(this.statusReason.value)), `Loan status changed to ${status}.`, () =>
      this.statusReason.reset(''),
    );
  }

  protected logActivity(loanId: number): void {
    const value = this.activityForm.getRawValue();
    const promise = value.activityType === 'PromiseToPay';
    this.mutate(
      this.api.createActivity({
        loanId,
        activityType: value.activityType,
        outcome: blankToNull(value.outcome),
        notes: blankToNull(value.notes),
        promisedAmount: promise ? value.promisedAmount : null,
        promisedDate: promise ? value.promisedDate || null : null,
      }),
      'Activity logged.',
      () => this.activityForm.patchValue({ outcome: '', notes: '', promisedAmount: null, promisedDate: '' }),
    );
  }

  protected markPromise(activity: CollectionActivity, status: 'Kept' | 'Broken'): void {
    this.mutate(this.api.setPromiseStatus(activity.id, status), `Promise marked as ${status.toLowerCase()}.`);
  }

  private mutate(call: Observable<unknown>, success: string, done?: () => void): void {
    this.busy.set(true);
    this.clear();
    call.subscribe({
      next: () => {
        this.message.set(success);
        this.busy.set(false);
        done?.();
        this.reload();
      },
      error: (e: unknown) => this.fail(apiError(e)),
    });
  }

  private clear(): void {
    this.error.set(null);
    this.message.set(null);
  }

  private fail(message: string): void {
    this.error.set(message);
    this.busy.set(false);
  }

  private reload(): void {
    const id = +this.id();
    this.expanded.set(null);
    forkJoin({
      loan: this.api.loan(id),
      schedule: this.api.schedule(id),
      payments: this.api.payments(id),
      activities: this.api.activities(id),
    }).subscribe({
      next: (data) => {
        this.loan.set(data.loan);
        this.schedule.set(data.schedule);
        this.payments.set(data.payments);
        this.activities.set(data.activities);
      },
      error: (e: unknown) => this.fail(apiError(e)),
    });
  }
}
