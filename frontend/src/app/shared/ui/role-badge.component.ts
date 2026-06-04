import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface RoleConfig {
  label: string; // UI display label (English, uppercase)
  color: string; // accent color
}

/**
 * Maps backend role keys -> UI labels + colors.
 * ⚠️ Backend uses `staff` / `senior` (do NOT change). UI shows AGENT / SENIOR AGENT.
 * Accepts backend keys and enum-ish names (Staff, SeniorStaff, Manager, Admin).
 */
const ROLE_MAP: Record<string, RoleConfig> = {
  staff: { label: 'AGENT', color: '#60a5fa' },
  senior: { label: 'SENIOR AGENT', color: '#34d399' },
  seniorstaff: { label: 'SENIOR AGENT', color: '#34d399' },
  manager: { label: 'MANAGER', color: '#fbbf24' },
  admin: { label: 'ADMIN', color: '#f87171' },
};

const FALLBACK: RoleConfig = { label: 'UNKNOWN', color: '#94a3b8' };

@Component({
  selector: 'app-role-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide text-on-surface"
      [style.background]="config().color + '22'">
      <span class="w-1.5 h-1.5 rounded-full" [style.background]="config().color"></span>
      {{ text() }}
    </span>
  `,
})
export class RoleBadgeComponent {
  readonly role = input.required<string>();
  /** Prefix the label with "ROLE: " (matches wireframe). */
  readonly prefix = input(true);

  readonly config = computed<RoleConfig>(
    () => ROLE_MAP[this.role().trim().toLowerCase().replace(/[^a-z]/g, '')] ?? FALLBACK,
  );

  readonly text = computed(() => (this.prefix() ? 'ROLE: ' : '') + this.config().label);
}
