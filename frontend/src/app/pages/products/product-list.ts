import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { blankToNull } from '../../core/format';
import { LoanProduct, LoanProductRequest } from '../../core/models';
import { Badge } from '../../shared/badge';

@Component({
  selector: 'app-product-list',
  imports: [ReactiveFormsModule, DecimalPipe, Badge],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Loan products</h1>
        <span class="spacer"></span>
        @if (editing() === null) { <button class="btn primary" type="button" (click)="startNew()">New product</button> }
      </div>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      @if (editing() !== null) {
        <form class="card" [formGroup]="form" (ngSubmit)="save()">
          <h2>{{ editing() === 'new' ? 'New product' : 'Edit product' }}</h2>
          <div class="form-grid">
            <div class="field"><label for="name">Name</label><input id="name" formControlName="name" /></div>
            <div class="field"><label for="description">Description</label><input id="description" formControlName="description" /></div>
            <div class="field"><label for="rate">Annual interest rate (%)</label><input id="rate" type="number" step="0.01" formControlName="annualInterestRate" /></div>
            <div class="field"><label for="minAmount">Minimum amount</label><input id="minAmount" type="number" formControlName="minAmount" /></div>
            <div class="field"><label for="maxAmount">Maximum amount</label><input id="maxAmount" type="number" formControlName="maxAmount" /></div>
            <div class="field"><label for="minTerm">Minimum term (months)</label><input id="minTerm" type="number" formControlName="minTermMonths" /></div>
            <div class="field"><label for="maxTerm">Maximum term (months)</label><input id="maxTerm" type="number" formControlName="maxTermMonths" /></div>
            <div class="field"><label for="orig">Origination fee (%)</label><input id="orig" type="number" step="0.01" formControlName="originationFeePercent" /></div>
            <div class="field"><label for="service">Monthly service fee</label><input id="service" type="number" step="0.01" formControlName="monthlyServiceFee" /></div>
            <div class="field"><label for="late">Late fee</label><input id="late" type="number" step="0.01" formControlName="lateFeeAmount" /></div>
            <div class="field"><label for="grace">Arrears grace (days)</label><input id="grace" type="number" formControlName="arrearsGraceDays" /></div>
            <div class="field">
              <label for="stress">Stress test (+ rate points)</label>
              <input id="stress" type="number" step="0.01" formControlName="stressTestRatePoints" />
              <span class="hint">Instalment is re-tested at the rate plus this margin.</span>
            </div>
            <div class="field">
              <label for="bmin">Bureau minimum score</label>
              <input id="bmin" type="number" formControlName="bureauMinScore" />
              <span class="hint">Below this the assessment fails.</span>
            </div>
            <div class="field">
              <label for="bref">Bureau refer score</label>
              <input id="bref" type="number" formControlName="bureauReferScore" />
              <span class="hint">Below this the assessment is referred.</span>
            </div>
            <div class="field"><label>Interest method</label><input value="Reducing balance" disabled /></div>
            <div class="field check"><input id="active" type="checkbox" formControlName="isActive" /><label for="active">Active</label></div>
          </div>
          <p class="muted">Changes only affect new applications; existing loans keep the terms they were approved with.</p>
          <div class="actions">
            <button class="btn primary" type="submit" [disabled]="busy()">Save</button>
            <button class="btn" type="button" (click)="cancel()">Cancel</button>
          </div>
        </form>
      }

      <div class="card table-wrap">
        @if (products().length === 0) {
          <div class="empty">{{ loading() ? 'Loading…' : 'No products yet.' }}</div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Name</th><th class="num">Rate</th><th class="num">Amount</th><th class="num">Term</th>
                <th class="num">Origination</th><th class="num">Service fee</th><th class="num">Late fee</th><th>Affordability policy</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of products(); track p.id) {
                <tr>
                  <td>{{ p.name }}<div class="muted">{{ p.description }}</div></td>
                  <td class="num">{{ p.annualInterestRate | number: '1.2-2' }}%</td>
                  <td class="num nowrap">{{ p.minAmount | number: '1.0-0' }} – {{ p.maxAmount | number: '1.0-0' }}</td>
                  <td class="num nowrap">{{ p.minTermMonths }} – {{ p.maxTermMonths }} m</td>
                  <td class="num">{{ p.originationFeePercent | number: '1.2-2' }}%</td>
                  <td class="num">{{ p.monthlyServiceFee | number: '1.2-2' }}</td>
                  <td class="num">{{ p.lateFeeAmount | number: '1.2-2' }} <span class="muted">after {{ p.arrearsGraceDays }}d</span></td>
                  <td class="nowrap">
                    <div>Stress +{{ p.stressTestRatePoints | number: '1.0-2' }} pts</div>
                    <div>Bureau {{ p.bureauMinScore }} / {{ p.bureauReferScore }}</div>
                  </td>
                  <td><app-badge [value]="p.isActive ? 'Active' : 'Inactive'" /></td>
                  <td class="right nowrap">
                    <button class="btn sm" type="button" (click)="startEdit(p)">Edit</button>
                    <button class="btn sm danger" type="button" (click)="remove(p)">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class ProductList implements OnInit {
  private readonly api = inject(Api);

  protected readonly products = signal<LoanProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal<number | 'new' | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    annualInterestRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    minAmount: [0, [Validators.required, Validators.min(0.01)]],
    maxAmount: [0, [Validators.required, Validators.min(0.01)]],
    minTermMonths: [1, [Validators.required, Validators.min(1)]],
    maxTermMonths: [12, [Validators.required, Validators.min(1)]],
    originationFeePercent: [0, [Validators.required, Validators.min(0)]],
    monthlyServiceFee: [0, [Validators.required, Validators.min(0)]],
    lateFeeAmount: [0, [Validators.required, Validators.min(0)]],
    arrearsGraceDays: [0, [Validators.required, Validators.min(0)]],
    stressTestRatePoints: [3, [Validators.required, Validators.min(0), Validators.max(20)]],
    bureauMinScore: [600, [Validators.required, Validators.min(300), Validators.max(850)]],
    bureauReferScore: [650, [Validators.required, Validators.min(300), Validators.max(850)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected startNew(): void {
    this.form.reset();
    this.error.set(null);
    this.editing.set('new');
  }

  protected startEdit(product: LoanProduct): void {
    this.form.reset({ ...product, description: product.description ?? '' });
    this.error.set(null);
    this.editing.set(product.id);
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please complete all required fields with valid values.');
      return;
    }

    const value = this.form.getRawValue();
    const body: LoanProductRequest = { ...value, description: blankToNull(value.description), interestMethod: 'ReducingBalance' };
    const editing = this.editing();

    this.busy.set(true);
    this.error.set(null);
    (editing === 'new' || editing === null ? this.api.createProduct(body) : this.api.updateProduct(editing, body)).subscribe({
      next: () => {
        this.busy.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(apiError(e));
      },
    });
  }

  protected remove(product: LoanProduct): void {
    if (!confirm(`Delete ${product.name}?`)) return;
    this.error.set(null);
    this.api.deleteProduct(product.id).subscribe({
      next: () => this.load(),
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  private load(): void {
    this.api.products().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(apiError(e));
        this.loading.set(false);
      },
    });
  }
}
