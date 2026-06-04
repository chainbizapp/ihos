import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Quotation lifecycle (5) + import/approval extras. */
export type StatusKey =
  | 'Draft' | 'Sent' | 'Failed' | 'Cancelled' | 'Expired'
  | 'Issued' | 'Pending' | 'Approved' | 'Rejected';

interface StatusConfig {
  label: string; // Thai display label
  cls: string;   // bg + text token classes
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Quotation statuses (internal-only system)
  draft: { label: 'ฉบับร่าง', cls: 'bg-neutral-bg text-neutral' },
  sent: { label: 'ส่งแล้ว', cls: 'bg-success-bg text-success' },
  failed: { label: 'ล้มเหลว', cls: 'bg-danger-bg text-danger' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-warning-bg text-warning' },
  expired: { label: 'หมดอายุ', cls: 'bg-neutral-bg text-neutral' },
  // Import / approval statuses
  issued: { label: 'ออกแล้ว', cls: 'bg-success-bg text-success' },
  pending: { label: 'รออนุมัติ', cls: 'bg-warning-bg text-warning' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-success-bg text-success' },
  rejected: { label: 'ปฏิเสธแล้ว', cls: 'bg-danger-bg text-danger' },
};

const FALLBACK: StatusConfig = { label: '—', cls: 'bg-neutral-bg text-neutral' };

/**
 * Colored status chip. Pass any status key (case-insensitive).
 * Shows the Thai label by default; override text with `label`.
 */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      [class]="config().cls">
      {{ label() || config().label }}
    </span>
  `,
})
export class StatusPillComponent {
  readonly status = input.required<string>();
  /** Optional text override (e.g. to show the English key instead of Thai). */
  readonly label = input<string>('');

  readonly config = computed<StatusConfig>(
    () => STATUS_MAP[this.status().trim().toLowerCase()] ?? FALLBACK,
  );
}
