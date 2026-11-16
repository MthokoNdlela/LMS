import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, of, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { Customer } from '../../core/models';

@Component({
  selector: 'app-customer-list',
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Customers</h1>
        <span class="spacer"></span>
        <a class="btn primary" routerLink="/customers/new">New customer</a>
      </div>

      <div class="toolbar">
        <input type="search" placeholder="Search name, email or ID number" [formControl]="search" />
      </div>

      @if (error()) { <div class="alert error">{{ error() }}</div> }

      <div class="card table-wrap">
        @if (customers().length === 0) {
          <div class="empty">{{ loading() ? 'Loading…' : 'No customers found.' }}</div>
        } @else {
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>ID number</th><th>City</th><th>Created</th></tr></thead>
            <tbody>
              @for (c of customers(); track c.id) {
                <tr>
                  <td><a [routerLink]="['/customers', c.id]">{{ c.firstName }} {{ c.lastName }}</a></td>
                  <td>{{ c.email }}</td>
                  <td>{{ c.phone }}</td>
                  <td>{{ c.nationalIdNumber }}</td>
                  <td>{{ c.city }}</td>
                  <td class="nowrap">{{ c.createdAt | date: 'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class CustomerList {
  private readonly api = inject(Api);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.search.valueChanges
      .pipe(
        startWith(''),
        debounceTime(250),
        tap(() => this.loading.set(true)),
        switchMap((term) =>
          this.api.customers(term).pipe(
            tap(() => this.error.set(null)),
            catchError((e: unknown) => {
              this.error.set(apiError(e));
              return of([] as Customer[]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.customers.set(list);
        this.loading.set(false);
      });
  }
}
