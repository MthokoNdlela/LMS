import { blankToNull, humanize, monthlyPayment } from './format';

describe('format helpers', () => {
  it('humanizes enum names', () => {
    expect(humanize('UnderReview')).toBe('Under review');
    expect(humanize('PartiallyPaid')).toBe('Partially paid');
    expect(humanize('IdDocument')).toBe('ID document');
    expect(humanize(null)).toBe('');
  });

  it('turns blank input into null', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' x ')).toBe('x');
    expect(blankToNull(undefined)).toBeNull();
  });

  it('matches the API amortisation for a reducing-balance loan', () => {
    // 20000 over 12 months at 18.5% is 1838.36 per month (the API returns the same figure).
    expect(monthlyPayment(20000, 18.5, 12)).toBe(1838.36);
  });

  it('splits a 0% loan evenly', () => {
    expect(monthlyPayment(5000, 0, 10)).toBe(500);
  });

  it('returns 0 without an amount or term', () => {
    expect(monthlyPayment(0, 10, 12)).toBe(0);
    expect(monthlyPayment(1000, 10, 0)).toBe(0);
  });
});
