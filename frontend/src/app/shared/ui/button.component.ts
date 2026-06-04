import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Shared button — design-system variants (primary / outline / ghost).
 * Renders a real <button> and forwards clicks. Use `app-button` in templates.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [attr.type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
      (click)="clicked.emit($event)">
      @if (loading()) {
        <span class="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
      }
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    :host(.is-full) { display: block; }
  `],
  host: { '[class.is-full]': 'fullWidth()' },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly fullWidth = input(false);
  readonly clicked = output<MouseEvent>();

  private readonly base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-colors ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  private readonly sizeMap: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };

  private readonly variantMap: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    outline: 'border border-primary text-primary bg-transparent hover:bg-primary-pale',
    ghost: 'text-primary bg-transparent hover:bg-surface-low',
  };

  readonly classes = computed(() =>
    [
      this.base,
      this.sizeMap[this.size()],
      this.variantMap[this.variant()],
      this.fullWidth() ? 'w-full' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
