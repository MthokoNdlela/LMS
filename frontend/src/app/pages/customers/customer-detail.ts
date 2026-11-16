import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { blankToNull } from '../../core/format';
import { Customer, CustomerDocument, DOCUMENT_TYPES, Loan, LoanApplication } from '../../core/models';
import { Badge } from '../../shared/badge';
import { HumanizePipe } from '../../shared/humanize.pipe';

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe, DecimalPipe, Badge, HumanizePipe],
  template: `
    <div class="page">
      @if (customer(); as c) {
        <div class="page-header">
          <h1>{{ c.firstName }} {{ c.lastName }}</h1>
          <span class="spacer"></span>
          <a class="btn primary" routerLink="/applications/new" [queryParams]="{ customerId: c.id }">New application</a>
          <a class="btn" [routerLink]="['/customers', c.id, 'edit']">Edit</a>
          <button class="btn danger" type="button" (click)="remove(c)">Delete</button>
        </div>

        @if (error()) { <div class="alert error">{{ error() }}</div> }

        <div class="card">
          <h2>Details</h2>
          <dl class="details">
            <dt>Email</dt><dd>{{ c.email }}</dd>
            <dt>Phone</dt><dd>{{ c.phone || '-' }}</dd>
            <dt>Date of birth</dt><dd>{{ c.dateOfBirth | date: 'mediumDate' }}</dd>
            <dt>National ID</dt><dd>{{ c.nationalIdNumber }}</dd>
            <dt>Address</dt>
            <dd>{{ c.addressLine1 }}@if (c.addressLine2) {, {{ c.addressLine2 }}}, {{ c.city }}, {{ c.postalCode }}</dd>
            <dt>Customer since</dt><dd>{{ c.createdAt | date: 'medium' }}</dd>
          </dl>
        </div>

        <div class="card">
          <h2>Documents</h2>
          <p class="muted">Only metadata is stored. A loan can be approved once ID, proof of address and proof of income are verified.</p>
          @if (documents().length === 0) {
            <div class="empty">No documents yet.</div>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Type</th><th>File</th><th>Reference</th><th>Status</th><th>Reviewed</th><th></th></tr></thead>
                <tbody>
                  @for (d of documents(); track d.id) {
                    <tr>
                      <td>{{ d.type | humanize }}</td>
                      <td>{{ d.fileName }}</td>
                      <td class="muted">{{ d.storageReference }}</td>
                      <td>
                        <app-badge [value]="d.status" />
                        @if (d.reviewNotes) { <div class="muted">{{ d.reviewNotes }}</div> }
                      </td>
                      <td class="nowrap">@if (d.reviewedAt) { {{ d.reviewedAt | date: 'short' }} by {{ d.reviewedBy }} }</td>
                      <td class="right nowrap">
                        @if (d.status === 'Pending') {
                          <button class="btn sm good" type="button" (click)="review(d, 'Verified')">Verify</button>
                          <button class="btn sm danger" type="button" (click)="startReject(d)">Reject</button>
                        }
                        @if (d.status !== 'Verified') {
                          <button class="btn sm" type="button" (click)="removeDocument(d)">Delete</button>
                        }
                      </td>
                    </tr>
                    @if (rejectingId() === d.id) {
                      <tr>
                        <td colspan="6">
                          <div class="row">
                            <input style="max-width: 360px" placeholder="Reason for rejection" [formControl]="rejectNotes" />
                            <button class="btn sm danger" type="button" (click)="review(d, 'Rejected')">Confirm reject</button>
                            <button class="btn sm" type="button" (click)="rejectingId.set(null)">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }

          <h3>Add document</h3>
          <form [formGroup]="docForm" (ngSubmit)="addDocument(c.id)">
            <div class="form-grid">
              <div class="field">
                <label for="docType">Type</label>
                <select id="docType" formControlName="type">
                  @for (t of documentTypes; track t) { <option [value]="t">{{ t | humanize }}</option> }
                </select>
              </div>
              <div class="field"><label for="docFile">File name</label><input id="docFile" formControlName="fileName" placeholder="id-card.pdf" /></div>
              <div class="field"><label for="docRef">Storage reference</label><input id="docRef" formControlName="storageReference" placeholder="blob://documents/…" /></div>
            </div>
            <div class="actions"><button class="btn primary" type="submit">Add document</button></div>
          </form>
        </div>

        <div class="grid two">
          <div class="card">
            <h2>Applications</h2>
            @if (applications().length === 0) {
              <div class="empty">No applications.</div>
            } @else {
              <table class="table">
                <thead><tr><th>Number</th><th class="num">Amount</th><th>Status</th></tr></thead>
                <tbody>
                  @for (a of applications(); track a.id) {
                    <tr>
                      <td><a [routerLink]="['/applications', a.id]">{{ a.applicationNumber }}</a></td>
                      <td class="num">{{ a.requestedAmount | number: '1.2-2' }}</td>
                      <td><app-badge [value]="a.status" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
          <div class="card">
            <h2>Loans</h2>
            @if (loans().length === 0) {
              <div class="empty">No loans.</div>
            } @else {
              <table class="table">
                <thead><tr><th>Loan</th><th class="num">Outstanding</th><th>Status</th></tr></thead>
                <tbody>
                  @for (l of loans(); track l.id) {
                    <tr>
                      <td><a [routerLink]="['/loans', l.id]">{{ l.loanNumber }}</a></td>
                      <td class="num">{{ l.totalOutstanding | number: '1.2-2' }}</td>
                      <td><app-badge [value]="l.status" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      } @else if (error()) {
        <div class="alert error">{{ error() }}</div>
      } @else {
        <div class="empty">Loading…</div>
      }
    </div>
  `,
})
export class CustomerDetail implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly customer = signal<Customer | null>(null);
  protected readonly documents = signal<CustomerDocument[]>([]);
  protected readonly applications = signal<LoanApplication[]>([]);
  protected readonly loans = signal<Loan[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly rejectingId = signal<number | null>(null);

  protected readonly rejectNotes = inject(FormBuilder).nonNullable.control('');
  protected readonly docForm = inject(FormBuilder).nonNullable.group({
    type: ['IdDocument' as (typeof DOCUMENT_TYPES)[number], Validators.required],
    fileName: ['', Validators.required],
    storageReference: ['', Validators.required],
  });

  ngOnInit(): void {
    const id = +this.id();
    forkJoin({
      customer: this.api.customer(id),
      documents: this.api.documents(id),
      applications: this.api.applications({ customerId: id }),
      loans: this.api.loans({ customerId: id }),
    }).subscribe({
      next: (data) => {
        this.customer.set(data.customer);
        this.documents.set(data.documents);
        this.applications.set(data.applications);
        this.loans.set(data.loans);
      },
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  protected addDocument(customerId: number): void {
    if (this.docForm.invalid) {
      this.docForm.markAllAsTouched();
      this.error.set('Document type, file name and storage reference are required.');
      return;
    }

    const value = this.docForm.getRawValue();
    this.api.addDocument(customerId, { ...value, contentType: null }).subscribe({
      next: () => {
        this.docForm.patchValue({ fileName: '', storageReference: '' });
        this.docForm.markAsUntouched();
        this.refreshDocuments(customerId);
      },
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  protected startReject(document: CustomerDocument): void {
    this.rejectNotes.reset('');
    this.rejectingId.set(document.id);
  }

  protected review(document: CustomerDocument, status: 'Verified' | 'Rejected'): void {
    const notes = status === 'Rejected' ? blankToNull(this.rejectNotes.value) : null;
    this.api.reviewDocument(document.customerId, document.id, status, notes).subscribe({
      next: () => {
        this.rejectingId.set(null);
        this.refreshDocuments(document.customerId);
      },
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  protected removeDocument(document: CustomerDocument): void {
    if (!confirm(`Delete ${document.fileName}?`)) return;
    this.api.deleteDocument(document.customerId, document.id).subscribe({
      next: () => this.refreshDocuments(document.customerId),
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  protected remove(customer: Customer): void {
    if (!confirm(`Delete ${customer.firstName} ${customer.lastName}?`)) return;
    this.api.deleteCustomer(customer.id).subscribe({
      next: () => void this.router.navigate(['/customers']),
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }

  private refreshDocuments(customerId: number): void {
    this.error.set(null);
    this.api.documents(customerId).subscribe({
      next: (documents) => this.documents.set(documents),
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }
}
