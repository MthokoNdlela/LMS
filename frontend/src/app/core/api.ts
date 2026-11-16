import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from './config';
import {
  ApplicationStatus, Assessment, AssessmentRequest, AuditLog, CollectionActivity, CollectionActivityRequest,
  Customer, CustomerDocument, CustomerRequest, DecisionRequest, DocumentRequest, LateFeeResult, Loan,
  LoanApplication, LoanApplicationRequest, LoanProduct, LoanProductRequest, LoanStatus, Payment, PaymentRequest,
  PromiseStatus, ScheduleRow,
} from './models';

type Query = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    return `${API_URL}/api/${path}`;
  }

  private params(query: Query): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return params;
  }

  // Customers
  customers(search?: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.url('customers'), { params: this.params({ search }) });
  }
  customer(id: number): Observable<Customer> {
    return this.http.get<Customer>(this.url(`customers/${id}`));
  }
  createCustomer(body: CustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(this.url('customers'), body);
  }
  updateCustomer(id: number, body: CustomerRequest): Observable<Customer> {
    return this.http.put<Customer>(this.url(`customers/${id}`), body);
  }
  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`customers/${id}`));
  }

  // Customer documents
  documents(customerId: number): Observable<CustomerDocument[]> {
    return this.http.get<CustomerDocument[]>(this.url(`customers/${customerId}/documents`));
  }
  addDocument(customerId: number, body: DocumentRequest): Observable<CustomerDocument> {
    return this.http.post<CustomerDocument>(this.url(`customers/${customerId}/documents`), body);
  }
  reviewDocument(customerId: number, id: number, status: 'Verified' | 'Rejected', notes: string | null): Observable<CustomerDocument> {
    return this.http.post<CustomerDocument>(this.url(`customers/${customerId}/documents/${id}/review`), { status, notes });
  }
  deleteDocument(customerId: number, id: number): Observable<void> {
    return this.http.delete<void>(this.url(`customers/${customerId}/documents/${id}`));
  }

  // Loan products
  products(active?: boolean): Observable<LoanProduct[]> {
    return this.http.get<LoanProduct[]>(this.url('loan-products'), { params: this.params({ active }) });
  }
  createProduct(body: LoanProductRequest): Observable<LoanProduct> {
    return this.http.post<LoanProduct>(this.url('loan-products'), body);
  }
  updateProduct(id: number, body: LoanProductRequest): Observable<LoanProduct> {
    return this.http.put<LoanProduct>(this.url(`loan-products/${id}`), body);
  }
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`loan-products/${id}`));
  }

  // Loan applications
  applications(filter: { customerId?: number; status?: ApplicationStatus | '' } = {}): Observable<LoanApplication[]> {
    return this.http.get<LoanApplication[]>(this.url('loan-applications'), { params: this.params(filter) });
  }
  application(id: number): Observable<LoanApplication> {
    return this.http.get<LoanApplication>(this.url(`loan-applications/${id}`));
  }
  createApplication(body: LoanApplicationRequest): Observable<LoanApplication> {
    return this.http.post<LoanApplication>(this.url('loan-applications'), body);
  }
  updateApplication(id: number, body: LoanApplicationRequest): Observable<LoanApplication> {
    return this.http.put<LoanApplication>(this.url(`loan-applications/${id}`), body);
  }
  applicationAction(id: number, action: 'submit' | 'review' | 'withdraw'): Observable<LoanApplication> {
    return this.http.post<LoanApplication>(this.url(`loan-applications/${id}/${action}`), {});
  }
  decideApplication(id: number, body: DecisionRequest): Observable<LoanApplication> {
    return this.http.post<LoanApplication>(this.url(`loan-applications/${id}/decision`), body);
  }

  // Affordability assessments
  assessments(applicationId: number): Observable<Assessment[]> {
    return this.http.get<Assessment[]>(this.url(`loan-applications/${applicationId}/assessments`));
  }
  createAssessment(applicationId: number, body: AssessmentRequest): Observable<Assessment> {
    return this.http.post<Assessment>(this.url(`loan-applications/${applicationId}/assessments`), body);
  }

  // Loans
  loans(filter: { customerId?: number; status?: LoanStatus | ''; inArrears?: boolean } = {}): Observable<Loan[]> {
    return this.http.get<Loan[]>(this.url('loans'), { params: this.params(filter) });
  }
  loan(id: number): Observable<Loan> {
    return this.http.get<Loan>(this.url(`loans/${id}`));
  }
  schedule(id: number): Observable<ScheduleRow[]> {
    return this.http.get<ScheduleRow[]>(this.url(`loans/${id}/schedule`));
  }
  setLoanStatus(id: number, status: LoanStatus, reason: string | null): Observable<Loan> {
    return this.http.post<Loan>(this.url(`loans/${id}/status`), { status, reason });
  }
  assessLateFees(id: number): Observable<LateFeeResult> {
    return this.http.post<LateFeeResult>(this.url(`loans/${id}/late-fees`), {});
  }

  // Payments
  payments(loanId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.url('payments'), { params: this.params({ loanId }) });
  }
  payment(id: number): Observable<Payment> {
    return this.http.get<Payment>(this.url(`payments/${id}`));
  }
  createPayment(body: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(this.url('payments'), body);
  }

  // Collections
  activities(loanId: number): Observable<CollectionActivity[]> {
    return this.http.get<CollectionActivity[]>(this.url('collection-activities'), { params: this.params({ loanId }) });
  }
  createActivity(body: CollectionActivityRequest): Observable<CollectionActivity> {
    return this.http.post<CollectionActivity>(this.url('collection-activities'), body);
  }
  setPromiseStatus(id: number, status: PromiseStatus): Observable<CollectionActivity> {
    return this.http.post<CollectionActivity>(this.url(`collection-activities/${id}/promise-status`), { status });
  }

  // Audit
  auditLogs(filter: { entityType?: string; entityId?: number | null; username?: string; action?: string; take?: number }): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.url('audit-logs'), { params: this.params(filter) });
  }
}
