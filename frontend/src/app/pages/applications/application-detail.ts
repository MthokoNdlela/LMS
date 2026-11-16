import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { blankToNull, today } from '../../core/format';
import { Assessment, CustomerDocument, LoanApplication, REQUIRED_DOCUMENT_TYPES } from '../../core/models';
import { Badge } from '../../shared/badge';
import { HumanizePipe } from '../../shared/humanize.pipe';

@Component({
  selector: 'app-application-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, DecimalPipe, Badge, HumanizePipe],
  template: `
    <div class="page">
      @if (application(); as a) {
        <div class="page-header">
          <h1>{{ a.applicationNumber }}</h1>
          <app-badge [value]="a.status" />
          <span class="spacer"></span>
          @if (a.status === 'Draft') {
            <a class="btn" [routerLink]="['/applications', a.id, 'edit']">Edit</a>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="action('submit')">Submit</button>
          }
          @if (a.status === 'Submitted') {
            <button class="btn primary" type="button" [disabled]="busy()" (click)="action('review')">Start review</button>
          }
          @if (a.status === 'Draft' || a.status === 'Submitted' || a.status === 'UnderReview') {
            <button class="btn danger" type="button" [disabled]="busy()" (click)="withdraw()">Withdraw</button>
          }
          @if (a.loanId) { <a class="btn good" [routerLink]="['/loans', a.loanId]">View loan</a> }
        </div>

        @if (error()) { <div class="alert error">{{ error() }}</div> }
        @if (message()) { <div class="alert success">{{ message() }}</div> }

        <div class="grid two">
          <div class="card">
            <h2>Application</h2>
            <dl class="details">
              <dt>Customer</dt><dd><a [routerLink]="['/customers', a.customerId]">{{ a.customerName }}</a></dd>
              <dt>Product</dt><dd>{{ a.productName }}</dd>
              <dt>Requested</dt><dd>{{ a.requestedAmount | number: '1.2-2' }} over {{ a.termMonths }} months</dd>
              <dt>Purpose</dt><dd>{{ a.purpose || '-' }}</dd>
              <dt>Created</dt><dd>{{ a.createdAt | date: 'medium' }}</dd>
              @if (a.submittedAt) { <dt>Submitted</dt><dd>{{ a.submittedAt | date: 'medium' }}</dd> }
              @if (a.decidedAt) {
                <dt>Decided</dt><dd>{{ a.decidedAt | date: 'medium' }} by {{ a.decidedBy }}</dd>
                <dt>Reason</dt><dd>{{ a.decisionReason || '-' }}</dd>
              }
            </dl>
          </div>

          <div class="card">
            <h2>Documents</h2>
            <ul class="checklist">
              @for (d of checklist(); track d.type) {
                <li [class]="d.verified ? 'ok' : 'missing'">{{ d.type | humanize }} {{ d.verified ? 'verified' : 'not verified' }}</li>
              }
            </ul>
            <p class="muted">All three must be verified before approval. <a [routerLink]="['/customers', a.customerId]">Manage documents</a></p>
          </div>
        </div>

        <div class="card">
          <h2>Affordability assessments</h2>
          @if (assessments().length === 0) {
            <div class="empty">No assessment yet.</div>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th><th class="num">Gross</th><th class="num">Net</th><th class="num">Expenses</th><th class="num">Debt</th>
                    <th class="num">Instalment</th><th class="num">Left after loan</th><th class="num">DTI</th><th class="num">Max instalment</th><th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of assessments(); track s.id) {
                    <tr>
                      <td class="nowrap">{{ s.assessedAt | date: 'short' }}<div class="muted">{{ s.assessedBy }}</div></td>
                      <td class="num">{{ s.grossMonthlyIncome | number: '1.2-2' }}</td>
                      <td class="num">{{ s.netMonthlyIncome | number: '1.2-2' }}</td>
                      <td class="num">{{ s.monthlyExpenses | number: '1.2-2' }}</td>
                      <td class="num">{{ s.monthlyDebtObligations | number: '1.2-2' }}</td>
                      <td class="num">{{ s.proposedInstallment | number: '1.2-2' }}</td>
                      <td class="num">{{ s.disposableAfterLoan | number: '1.2-2' }}</td>
                      <td class="num">{{ s.debtToIncomeRatio | number: '1.2-2' }}%</td>
                      <td class="num">{{ s.maxAffordableInstallment | number: '1.2-2' }}</td>
                      <td><app-badge [value]="s.outcome" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (latest(); as s) {
            <h3>Checks on the latest assessment <app-badge [value]="s.outcome" /></h3>
            @if (s.outcomeReasons) { <div class="alert info">{{ s.outcomeReasons }}</div> }
            <table class="table">
              <thead><tr><th>Check</th><th>Detail</th><th>Result</th></tr></thead>
              <tbody>
                <tr>
                  <td>Debt-to-income</td>
                  <td>{{ s.debtToIncomeRatio | number: '1.2-2' }}% (pass up to 40%, refer up to 50%)</td>
                  <td><app-badge [value]="s.debtToIncomeRatio > 50 ? 'Fail' : s.debtToIncomeRatio > 40 ? 'Refer' : 'Pass'" /></td>
                </tr>
                <tr>
                  <td>Stress test</td>
                  <td>
                    @if (s.stressTestPassed === null) { - } @else {
                      Instalment rises to {{ s.stressedInstallment | number: '1.2-2' }}; {{ s.stressedDisposableAfterLoan | number: '1.2-2' }} would be left
                    }
                  </td>
                  <td>@if (s.stressTestPassed === null) { <span class="muted">Not recorded</span> } @else { <app-badge [value]="s.stressTestPassed ? 'Pass' : 'Refer'" /> }</td>
                </tr>
                <tr>
                  <td>Credit bureau</td>
                  <td>
                    @if (s.bureauScore === null) { - } @else {
                      Score {{ s.bureauScore }}, {{ s.bureauHasAdverseListing ? 'adverse listing' : 'no adverse listing' }}
                      <span class="muted">({{ s.bureauReference }}, simulated)</span>
                    }
                  </td>
                  <td>@if (s.bureauOutcome === null) { <span class="muted">Not recorded</span> } @else { <app-badge [value]="s.bureauOutcome" /> }</td>
                </tr>
              </tbody>
            </table>
          }

          @if (a.status === 'Submitted' || a.status === 'UnderReview') {
            <h3>Record an assessment</h3>
            <p class="muted">The credit bureau is checked automatically using the customer's ID number (simulated in this demo), and the product's stress-test rule is applied.</p>
            <form [formGroup]="assessForm" (ngSubmit)="assess(a.id)">
              <div class="form-grid">
                <div class="field"><label for="gross">Gross monthly income</label><input id="gross" type="number" step="0.01" formControlName="grossMonthlyIncome" /></div>
                <div class="field"><label for="net">Net monthly income</label><input id="net" type="number" step="0.01" formControlName="netMonthlyIncome" /></div>
                <div class="field"><label for="expenses">Monthly expenses</label><input id="expenses" type="number" step="0.01" formControlName="monthlyExpenses" /></div>
                <div class="field"><label for="debts">Monthly debt obligations</label><input id="debts" type="number" step="0.01" formControlName="monthlyDebtObligations" /></div>
                <div class="field wide"><label for="anotes">Notes</label><input id="anotes" formControlName="notes" /></div>
              </div>
              <div class="actions"><button class="btn primary" type="submit" [disabled]="busy()">Calculate and save</button></div>
            </form>
          }
        </div>

        @if (a.status === 'UnderReview') {
          <div class="card">
            <h2>Decision</h2>
            @if (!ready()) {
              <div class="alert info">
                Approval needs all three documents verified and a latest assessment that is not a fail. You can still decline.
              </div>
            }
            <form [formGroup]="decisionForm">
              <div class="form-grid">
                <div class="field wide">
                  <label for="reason">Reason</label>
                  <input id="reason" formControlName="reason" />
                  <span class="hint">Required to decline, and to approve a referred assessment.</span>
                </div>
                <div class="field">
                  <label for="disb">Disbursement date</label>
                  <input id="disb" type="date" formControlName="disbursementDate" [min]="minDate" />
                </div>
              </div>
              <div class="actions">
                <button class="btn good" type="button" [disabled]="busy()" (click)="decide(a.id, true)">Approve and create loan</button>
                <button class="btn danger" type="button" [disabled]="busy()" (click)="decide(a.id, false)">Decline</button>
              </div>
            </form>
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
export class ApplicationDetail implements OnInit {
  private readonly api = inject(Api);

  readonly id = input.required<string>();

  protected readonly minDate = today();
  protected readonly application = signal<LoanApplication | null>(null);
  protected readonly assessments = signal<Assessment[]>([]);
  protected readonly documents = signal<CustomerDocument[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly latest = computed(() => this.assessments()[0] ?? null);
  protected readonly checklist = computed(() =>
    REQUIRED_DOCUMENT_TYPES.map((type) => ({
      type,
      verified: this.documents().some((d) => d.type === type && d.status === 'Verified'),
    })),
  );
  protected readonly ready = computed(() => {
    const latest = this.assessments()[0];
    return this.checklist().every((d) => d.verified) && !!latest && latest.outcome !== 'Fail';
  });

  protected readonly assessForm = inject(FormBuilder).nonNullable.group({
    grossMonthlyIncome: [0, [Validators.required, Validators.min(0.01)]],
    netMonthlyIncome: [0, [Validators.required, Validators.min(0)]],
    monthlyExpenses: [0, [Validators.required, Validators.min(0)]],
    monthlyDebtObligations: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  protected readonly decisionForm = inject(FormBuilder).nonNullable.group({
    reason: [''],
    disbursementDate: [today()],
  });

  ngOnInit(): void {
    this.load();
  }

  protected action(name: 'submit' | 'review'): void {
    this.run(this.api.applicationAction(+this.id(), name), name === 'submit' ? 'Application submitted.' : 'Review started.');
  }

  protected withdraw(): void {
    if (!confirm('Withdraw this application?')) return;
    this.run(this.api.applicationAction(+this.id(), 'withdraw'), 'Application withdrawn.');
  }

  protected assess(applicationId: number): void {
    if (this.assessForm.invalid) {
      this.assessForm.markAllAsTouched();
      this.error.set('Enter gross income above zero and valid amounts.');
      return;
    }

    const value = this.assessForm.getRawValue();
    this.run(this.api.createAssessment(applicationId, { ...value, notes: blankToNull(value.notes) }), 'Assessment saved.');
  }

  protected decide(applicationId: number, approved: boolean): void {
    const value = this.decisionForm.getRawValue();
    const request = { approved, reason: blankToNull(value.reason), disbursementDate: approved ? value.disbursementDate || null : null };
    this.run(this.api.decideApplication(applicationId, request), approved ? 'Application approved and loan created.' : 'Application declined.');
  }

  private run(call: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    call.subscribe({
      next: () => {
        this.message.set(success);
        this.busy.set(false);
        this.load();
      },
      error: (e: unknown) => {
        this.error.set(apiError(e));
        this.busy.set(false);
      },
    });
  }

  private load(): void {
    const id = +this.id();
    this.api
      .application(id)
      .pipe(
        switchMap((application) =>
          forkJoin({
            application: of(application),
            assessments: this.api.assessments(id),
            documents: this.api.documents(application.customerId),
          }),
        ),
      )
      .subscribe({
        next: (data) => {
          this.application.set(data.application);
          this.assessments.set(data.assessments);
          this.documents.set(data.documents);
        },
        error: (e: unknown) => this.error.set(apiError(e)),
      });
  }
}
