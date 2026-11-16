import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../core/errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="auth-wrap">
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Loan Management</h1>
        <p class="muted">{{ mode() === 'login' ? 'Sign in to continue.' : 'Create an account.' }}</p>

        @if (error()) { <div class="alert error">{{ error() }}</div> }

        <div class="field">
          <label for="username">Username</label>
          <input id="username" formControlName="username" autocomplete="username" />
        </div>
        <div class="field mt">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password"
                 [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" />
          @if (mode() === 'register') { <span class="hint">At least 8 characters.</span> }
        </div>

        <div class="actions">
          <button class="btn primary" type="submit" [disabled]="busy()">
            {{ mode() === 'login' ? 'Sign in' : 'Register' }}
          </button>
          <button class="btn" type="button" (click)="toggle()">
            {{ mode() === 'login' ? 'Need an account?' : 'Have an account?' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected toggle(): void {
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
    this.error.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a username (3+ characters) and a password (8+ characters).');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    const request = this.mode() === 'login' ? this.auth.login(username, password) : this.auth.register(username, password);

    request.subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl() || '/dashboard'),
      error: (e: unknown) => {
        this.error.set(apiError(e));
        this.busy.set(false);
      },
    });
  }
}
