import { HttpErrorResponse } from '@angular/common/http';

interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

// Turns an API error (RFC 9110 problem details) into one readable message.
export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Something went wrong.';
  if (error.status === 0) return 'Cannot reach the API. Is it running?';

  const problem = error.error as ProblemDetails | string | null;
  if (typeof problem === 'string' && problem) return problem;
  if (problem && typeof problem === 'object') {
    if (problem.errors) {
      return Object.entries(problem.errors)
        .map(([field, messages]) => `${field}: ${messages.join(' ')}`)
        .join(' | ');
    }
    if (problem.detail) return problem.detail;
    if (problem.title) return problem.title;
  }
  return error.status === 403 ? 'You are not allowed to do that.' : `Request failed (${error.status}).`;
}
