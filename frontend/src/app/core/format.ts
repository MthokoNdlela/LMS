// "UnderReview" -> "Under review", "IdDocument" -> "ID document"
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)).replace(/\bid\b/gi, 'ID');
}

// Empty or whitespace-only input becomes null so the API treats it as "not provided".
export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Same amortisation formula the API uses; for estimates only, the API is the source of truth.
export function monthlyPayment(principal: number, annualRatePercent: number, termMonths: number): number {
  if (!principal || !termMonths) return 0;
  if (annualRatePercent === 0) return round2(principal / termMonths);
  const r = annualRatePercent / 1200;
  return round2((principal * r) / (1 - Math.pow(1 + r, -termMonths)));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function today(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
