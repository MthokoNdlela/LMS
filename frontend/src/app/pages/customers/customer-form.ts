import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { blankToNull } from '../../core/format';
import { CustomerRequest } from '../../core/models';

@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header"><h1>{{ id() ? 'Edit customer' : 'New customer' }}</h1></div>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="field"><label for="firstName">First name</label><input id="firstName" formControlName="firstName" /></div>
          <div class="field"><label for="lastName">Last name</label><input id="lastName" formControlName="lastName" /></div>
          <div class="field"><label for="email">Email</label><input id="email" type="email" formControlName="email" /></div>
          <div class="field"><label for="phone">Phone</label><input id="phone" formControlName="phone" /></div>
          <div class="field">
            <label for="dateOfBirth">Date of birth</label>
            <input id="dateOfBirth" type="date" formControlName="dateOfBirth" />
            <span class="hint">Customers must be at least 18.</span>
          </div>
          <div class="field"><label for="nationalIdNumber">National ID number</label><input id="nationalIdNumber" formControlName="nationalIdNumber" /></div>
          <div class="field wide"><label for="addressLine1">Address line 1</label><input id="addressLine1" formControlName="addressLine1" /></div>
          <div class="field wide"><label for="addressLine2">Address line 2</label><input id="addressLine2" formControlName="addressLine2" /></div>
          <div class="field"><label for="city">City</label><input id="city" formControlName="city" /></div>
          <div class="field"><label for="postalCode">Postal code</label><input id="postalCode" formControlName="postalCode" /></div>
        </div>
        <div class="actions">
          <button class="btn primary" type="submit" [disabled]="busy()">Save</button>
          <a class="btn" [routerLink]="id() ? ['/customers', id()] : ['/customers']">Cancel</a>
        </div>
      </form>
    </div>
  `,
})
export class CustomerForm implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly id = input<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    dateOfBirth: ['', Validators.required],
    nationalIdNumber: ['', Validators.required],
    addressLine1: ['', Validators.required],
    addressLine2: [''],
    city: ['', Validators.required],
    postalCode: ['', Validators.required],
  });

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;

    this.api.customer(+id).subscribe({
      next: (c) => this.form.patchValue({ ...c, phone: c.phone ?? '', addressLine2: c.addressLine2 ?? '' }),
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please complete all required fields.');
      return;
    }

    const value = this.form.getRawValue();
    const body: CustomerRequest = { ...value, phone: blankToNull(value.phone), addressLine2: blankToNull(value.addressLine2) };
    const id = this.id();

    this.busy.set(true);
    this.error.set(null);
    (id ? this.api.updateCustomer(+id, body) : this.api.createCustomer(body)).subscribe({
      next: (c) => void this.router.navigate(['/customers', c.id]),
      error: (e: unknown) => {
        this.error.set(apiError(e));
        this.busy.set(false);
      },
    });
  }
}
