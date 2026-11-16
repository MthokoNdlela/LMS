import { Routes } from '@angular/router';
import { authGuard } from './core/auth.http';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'customers', loadComponent: () => import('./pages/customers/customer-list').then((m) => m.CustomerList) },
      { path: 'customers/new', loadComponent: () => import('./pages/customers/customer-form').then((m) => m.CustomerForm) },
      { path: 'customers/:id', loadComponent: () => import('./pages/customers/customer-detail').then((m) => m.CustomerDetail) },
      { path: 'customers/:id/edit', loadComponent: () => import('./pages/customers/customer-form').then((m) => m.CustomerForm) },
      { path: 'products', loadComponent: () => import('./pages/products/product-list').then((m) => m.ProductList) },
      { path: 'applications', loadComponent: () => import('./pages/applications/application-list').then((m) => m.ApplicationList) },
      { path: 'applications/new', loadComponent: () => import('./pages/applications/application-form').then((m) => m.ApplicationForm) },
      { path: 'applications/:id', loadComponent: () => import('./pages/applications/application-detail').then((m) => m.ApplicationDetail) },
      { path: 'applications/:id/edit', loadComponent: () => import('./pages/applications/application-form').then((m) => m.ApplicationForm) },
      { path: 'loans', loadComponent: () => import('./pages/loans/loan-list').then((m) => m.LoanList) },
      { path: 'loans/:id', loadComponent: () => import('./pages/loans/loan-detail').then((m) => m.LoanDetail) },
      { path: 'audit', loadComponent: () => import('./pages/audit/audit-log').then((m) => m.AuditLogPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
