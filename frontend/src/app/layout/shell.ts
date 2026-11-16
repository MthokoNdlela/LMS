import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Loan Management</div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/customers" routerLinkActive="active">Customers</a>
          <a routerLink="/applications" routerLinkActive="active">Applications</a>
          <a routerLink="/loans" routerLinkActive="active">Loans</a>
          <a routerLink="/products" routerLinkActive="active">Loan products</a>
          <a routerLink="/audit" routerLinkActive="active">Audit log</a>
        </nav>
        <div class="user">
          <span>Signed in as <strong>{{ auth.username() }}</strong></span>
          <button class="btn" type="button" (click)="auth.logout()">Sign out</button>
        </div>
      </aside>
      <main class="main"><router-outlet /></main>
    </div>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
}
