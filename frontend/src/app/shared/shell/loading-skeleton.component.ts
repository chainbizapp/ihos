import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="containerClass">
      @for (row of rows; track $index) {
        <div class="animate-pulse flex gap-3 mb-3">
          @if (showAvatar) {
            <div class="rounded-full bg-gray-200 h-9 w-9 flex-shrink-0"></div>
          }
          <div class="flex-1 space-y-2 py-1">
            <div class="h-3 bg-gray-200 rounded w-3/4"></div>
            @if (lines > 1) {
              <div class="h-3 bg-gray-200 rounded w-1/2"></div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class LoadingSkeletonComponent {
  @Input() count = 5;
  @Input() lines = 2;
  @Input() showAvatar = false;
  @Input() containerClass = '';

  get rows(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
