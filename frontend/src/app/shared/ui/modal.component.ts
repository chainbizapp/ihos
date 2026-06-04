import { ChangeDetectionStrategy, Component, HostListener, computed, input, output } from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Modal wrapper with backdrop. Close on backdrop click (optional) and ESC.
 * Usage:
 *   <app-modal [open]="show()" title="หัวข้อ" (closed)="show.set(false)">
 *     ...body...
 *     <div modalFooter>
 *       <app-button variant="ghost" (clicked)="show.set(false)">ยกเลิก</app-button>
 *       <app-button (clicked)="save()">บันทึก</app-button>
 *     </div>
 *   </app-modal>
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40"
        (click)="onBackdrop()">
        <div
          class="bg-surface-lowest rounded-md shadow-lift w-full flex flex-col max-h-[90vh]"
          [class]="sizeClass()"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()">

          @if (title()) {
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="text-lg font-bold font-display text-on-surface">{{ title() }}</h2>
              <button
                type="button"
                class="text-mute hover:text-on-surface transition-colors text-2xl leading-none"
                aria-label="Close"
                (click)="close()">×</button>
            </div>
          }

          <div class="px-6 py-4 overflow-y-auto">
            <ng-content></ng-content>
          </div>

          <div class="px-6 py-4 border-t border-border flex justify-end gap-3 empty:hidden">
            <ng-content select="[modalFooter]"></ng-content>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly size = input<ModalSize>('md');
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();

  private readonly sizeMap: Record<ModalSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  readonly sizeClass = computed(() => this.sizeMap[this.size()]);

  close(): void {
    this.closed.emit();
  }

  onBackdrop(): void {
    if (this.closeOnBackdrop()) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) {
      this.close();
    }
  }
}
