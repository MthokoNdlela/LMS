import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, startWith } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { blankToNull, monthlyPayment } from '../../core/format';
import { Customer, LoanApplicationRequest, LoanProduct } from '../../core/models';

@Component({
  selector: 'app-application-form',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="page">
      <div class="page-header"><h1>{{ id() ? 'Edit application' : 'New application' }}</h1></div>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="field">
            <label for="customer">Customer</label>
            <select id="customer" formControlName="customerId">
              <option [ngValue]="0">Select a customer…</option>
              @for (c of customers(); track c.id) { <option [ngValue]="c.id">{{ c.firstName }} {{ c.lastName }} ({{ c.nationalIdNumber }})</option> }
            </select>
          </div>
          <div class="field">
            <label for="product">Loan product</label>
            <select id="product" formControlName="loanProductId">
              <option [ngValue]="0">Select a product…</option>
              @for (p of selectableProducts(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="amount">Requested amount</label>
            <input id="amount" type="number" step="0.01" formControlName="requestedAmount" />
            @if (product(); as p) { <span class="hint">{{ p.minAmount | number: '1.0-0' }} – {{ p.maxAmount | number: '1.0-0' }}</span> }
          </div>
          <div class="field">
            <label for="term">Term (months)</label>
            <input id="term" type="number" formControlName="termMonths" />
            @if (product(); as p) { <span class="hint">{{ p.minTermMonths }} – {{ p.maxTermMonths }} months</span> }
          </div>
          <div class="field wide"><label for="purpose">Purpose</label><input id="purpose" formControlName="purpose" /></div>
        </div>

        @if (product(); as p) {
          @if (estimate() > 0) {
            <div class="alert info mt">
              Estimated instalment: <strong>{{ estimate() | number: '1.2-2' }}</strong> + {{ p.monthlyServiceFee | number: '1.2-2' }} service fee
              at {{ p.annualInterestRate | number: '1.2-2' }}% (the first instalment also carries the {{ p.originationFeePercent | number: '1.2-2' }}% origination fee).
            </div>
          }
        }

        <div class="actions">
          <button class="btn primary" type="submit" [disabled]="busy()">Save as draft</button>
          <a class="btn" [routerLink]="id() ? ['/applications', id()] : ['/applications']">Cancel</a>
        </div>
      </form>
    </div>
  `,
})
export class ApplicationForm implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly customerId = input<string>();

  protected readonly customers = signal<Customer[]>([]);
  protected readonly products = signal<LoanProduct[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    customerId: [0, [Validators.required, Validators.min(1)]],
    loanProductId: [0, [Validators.required, Validators.min(1)]],
    requestedAmount: [0, [Validators.required, Validators.min(0.01)]],
    termMonths: [12, [Validators.required, Validators.min(1)]],
    purpose: [''],
  });

  private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly product = computed(() => this.products().find((p) => p.id === this.values().loanProductId) ?? null);
  protected readonly selectableProducts = computed(() =>
    this.products().filter((p) => p.isActive || p.id === this.values().loanProductId),
  );
  protected readonly estimate = computed(() => {
    const p = this.product();
    const v = this.values();
    return p ? monthlyPayment(v.requestedAmount ?? 0, p.annualInterestRate, v.termMonths ?? 0) : 0;
  });

  ngOnInit(): void {
    const id = this.id();
    forkJoin({ customers: this.api.customers(), products: this.api.products() }).subscribe({
      next: ({ customers, products }) => {
        this.customers.set(customers);
        this.products.set(products);

        if (id) {
          this.form.controls.customerId.disable();
          this.api.application(+id).subscribe({
            next: (a) =>
              this.form.patchValue({
                customerId: a.customerId,
                loanProductId: a.loanProductId,
                requestedAmount: a.requestedAmount,
                termMonths: a.termMonths,
                purpose: a.purpose ?? '',
              }),
            error: (e: unknown) => this.error.set(apiError(e)),
          });
        } else if (this.customerId()) {
          this.form.patchValue({ customerId: +this.customerId()! });
        }
      },
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Choose a customer and product, and enter an amount and term.');
      return;
    }

    const value = this.form.getRawValue();
    const body: LoanApplicationRequest = { ...value, purpose: blankToNull(value.purpose) };
    const id = this.id();

    this.busy.set(true);
    this.error.set(null);
    (id ? this.api.updateApplication(+id, body) : this.api.createApplication(body)).subscribe({
      next: (a) => void this.router.navigate(['/applications', a.id]),
      error: (e: unknown) => {
        this.error.set(apiError(e));
        this.busy.set(false);
      },
    });
  }
}
