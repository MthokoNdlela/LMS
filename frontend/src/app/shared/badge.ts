import { Component, computed, input } from '@angular/core';
import { humanize } from '../core/format';

const TONES: Record<string, string> = {
  Active: 'good', Approved: 'good', Verified: 'good', Paid: 'good', Settled: 'good', Pass: 'good', Kept: 'good',
  Pending: 'warn', Submitted: 'warn', UnderReview: 'warn', Refer: 'warn', PartiallyPaid: 'warn', Open: 'warn',
  Declined: 'bad', Rejected: 'bad', Fail: 'bad', Defaulted: 'bad', WrittenOff: 'bad', Broken: 'bad',
};

@Component({
  selector: 'app-badge',
  template: `<span [class]="'badge ' + tone()">{{ label() }}</span>`,
})
export class Badge {
  readonly value = input.required<string | null | undefined>();
  protected readonly label = computed(() => humanize(this.value()));
  protected readonly tone = computed(() => TONES[this.value() ?? ''] ?? 'neutral');
}
