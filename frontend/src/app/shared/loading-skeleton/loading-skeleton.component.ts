import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.scss'
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
