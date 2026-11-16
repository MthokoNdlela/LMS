export type ApplicationStatus = 'Draft' | 'Submitted' | 'UnderReview' | 'Approved' | 'Declined' | 'Withdrawn';
export type LoanStatus = 'Active' | 'Settled' | 'Defaulted' | 'WrittenOff';
export type DocumentType = 'IdDocument' | 'ProofOfAddress' | 'ProofOfIncome' | 'Other';
export type DocumentStatus = 'Pending' | 'Verified' | 'Rejected';
export type AffordabilityOutcome = 'Pass' | 'Refer' | 'Fail';
export type PaymentMethod = 'Eft' | 'DebitOrder' | 'Card' | 'Cash';
export type ActivityType = 'Reminder' | 'Call' | 'Sms' | 'Email' | 'ArrearsNotice' | 'PromiseToPay' | 'Note';
export type PromiseStatus = 'Open' | 'Kept' | 'Broken';
export type InstallmentStatus = 'Pending' | 'PartiallyPaid' | 'Paid';

export const APPLICATION_STATUSES: ApplicationStatus[] = ['Draft', 'Submitted', 'UnderReview', 'Approved', 'Declined', 'Withdrawn'];
export const LOAN_STATUSES: LoanStatus[] = ['Active', 'Settled', 'Defaulted', 'WrittenOff'];
export const DOCUMENT_TYPES: DocumentType[] = ['IdDocument', 'ProofOfAddress', 'ProofOfIncome', 'Other'];
export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = ['IdDocument', 'ProofOfAddress', 'ProofOfIncome'];
export const PAYMENT_METHODS: PaymentMethod[] = ['Eft', 'DebitOrder', 'Card', 'Cash'];
export const ACTIVITY_TYPES: ActivityType[] = ['Reminder', 'Call', 'Sms', 'Email', 'ArrearsNotice', 'PromiseToPay', 'Note'];

export interface AuthResponse {
  token: string;
  expiresAt: string;
  username: string;
}

export interface CustomerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string;
  nationalIdNumber: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
}

export interface Customer extends CustomerRequest {
  id: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface DocumentRequest {
  type: DocumentType;
  fileName: string;
  contentType: string | null;
  storageReference: string;
}

export interface CustomerDocument {
  id: number;
  customerId: number;
  type: DocumentType;
  fileName: string;
  contentType: string | null;
  storageReference: string;
  status: DocumentStatus;
  reviewNotes: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface LoanProductRequest {
  name: string;
  description: string | null;
  interestMethod: 'ReducingBalance';
  annualInterestRate: number;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  originationFeePercent: number;
  monthlyServiceFee: number;
  lateFeeAmount: number;
  arrearsGraceDays: number;
  isActive: boolean;
}

export interface LoanProduct extends LoanProductRequest {
  id: number;
  createdAt: string;
}

export interface LoanApplicationRequest {
  customerId: number;
  loanProductId: number;
  requestedAmount: number;
  termMonths: number;
  purpose: string | null;
}

export interface LoanApplication {
  id: number;
  applicationNumber: string;
  customerId: number;
  customerName: string;
  loanProductId: number;
  productName: string;
  requestedAmount: number;
  termMonths: number;
  purpose: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: string;
  loanId: number | null;
}

export interface AssessmentRequest {
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  monthlyExpenses: number;
  monthlyDebtObligations: number;
  notes: string | null;
}

export interface Assessment extends AssessmentRequest {
  id: number;
  loanApplicationId: number;
  proposedInstallment: number;
  disposableIncome: number;
  disposableAfterLoan: number;
  debtToIncomeRatio: number;
  maxAffordableInstallment: number;
  outcome: AffordabilityOutcome;
  assessedAt: string;
  assessedBy: string | null;
}

export interface DecisionRequest {
  approved: boolean;
  reason: string | null;
  disbursementDate: string | null;
}

export interface Loan {
  id: number;
  loanNumber: string;
  loanApplicationId: number;
  customerId: number;
  customerName: string;
  loanProductId: number;
  productName: string;
  principalAmount: number;
  annualInterestRate: number;
  termMonths: number;
  initiationFee: number;
  monthlyServiceFee: number;
  monthlyInstallment: number;
  disbursementDate: string;
  firstDueDate: string;
  maturityDate: string;
  status: LoanStatus;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingFees: number;
  totalOutstanding: number;
  arrearsAmount: number;
  daysInArrears: number;
  createdAt: string;
}

export interface ScheduleRow {
  id: number;
  installmentNumber: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  feesDue: number;
  totalDue: number;
  principalPaid: number;
  interestPaid: number;
  feesPaid: number;
  totalPaid: number;
  outstanding: number;
  status: InstallmentStatus;
  lateFeeCharged: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  lastPaidDate: string | null;
}

export interface LateFeeResult {
  installmentsCharged: number;
  feesCharged: number;
  loan: Loan;
}

export interface PaymentRequest {
  loanId: number;
  amount: number;
  paymentDate: string | null;
  method: PaymentMethod;
  reference: string | null;
}

export interface PaymentAllocation {
  repaymentScheduleId: number;
  installmentNumber: number;
  feesAmount: number;
  interestAmount: number;
  principalAmount: number;
}

export interface Payment {
  id: number;
  loanId: number;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  feesAllocated: number;
  interestAllocated: number;
  principalAllocated: number;
  receivedBy: string | null;
  createdAt: string;
  allocations: PaymentAllocation[] | null;
}

export interface CollectionActivityRequest {
  loanId: number;
  activityType: ActivityType;
  outcome: string | null;
  notes: string | null;
  promisedAmount: number | null;
  promisedDate: string | null;
}

export interface CollectionActivity {
  id: number;
  loanId: number;
  activityType: ActivityType;
  activityDate: string;
  outcome: string | null;
  notes: string | null;
  promisedAmount: number | null;
  promisedDate: string | null;
  promiseStatus: PromiseStatus | null;
  arrearsAmount: number;
  daysInArrears: number;
  createdBy: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  userId: number | null;
  username: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
}
