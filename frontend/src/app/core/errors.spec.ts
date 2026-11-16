import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from './errors';

describe('apiError', () => {
  it('reports an unreachable API', () => {
    expect(apiError(new HttpErrorResponse({ status: 0 }))).toContain('Cannot reach the API');
  });

  it('uses the problem detail', () => {
    const error = new HttpErrorResponse({ status: 409, error: { title: 'Conflict', detail: 'Loan has payments.' } });
    expect(apiError(error)).toBe('Loan has payments.');
  });

  it('flattens validation errors', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { title: 'One or more validation errors occurred.', errors: { Amount: ['Too high.'], Term: ['Too low.'] } },
    });
    expect(apiError(error)).toBe('Amount: Too high. | Term: Too low.');
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(apiError(new Error('boom'))).toBe('Something went wrong.');
    expect(apiError(new HttpErrorResponse({ status: 500 }))).toBe('Request failed (500).');
  });
});
