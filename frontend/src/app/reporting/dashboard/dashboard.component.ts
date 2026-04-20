import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ReportCard {
  title: string;
  description: string;
  route: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <h1 class="text-2xl font-semibold mb-2">Reports</h1>
      <p class="text-gray-500 text-sm mb-8">Analytics and export for system activity.</p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        @for (card of cards; track card.route) {
          <a [routerLink]="card.route"
             class="block bg-white border rounded-xl p-6 hover:shadow-md transition-shadow group">
            <div [class]="'text-4xl mb-3 ' + card.color">{{ card.icon }}</div>
            <h2 class="font-semibold text-gray-900 mb-1 group-hover:text-blue-700">
              {{ card.title }}
            </h2>
            <p class="text-sm text-gray-500">{{ card.description }}</p>
            <div class="mt-4 text-sm text-blue-600 font-medium group-hover:underline">
              View report →
            </div>
          </a>
        }
      </div>
    </div>
  `
})
export class DashboardComponent {
  readonly cards: ReportCard[] = [
    {
      title: 'Usage Statistics',
      description: 'Quotations generated per day, week, or month over a selected date range.',
      route: '/reporting/usage-statistics',
      icon: '📊',
      color: 'text-blue-500'
    },
    {
      title: 'Top Vehicle Models',
      description: 'Most-quoted vehicle makes and models ranked by quotation frequency.',
      route: '/reporting/top-models',
      icon: '🚗',
      color: 'text-green-500'
    },
    {
      title: 'Import Errors',
      description: 'Import batches with counts of unresolved, rejected, and approved records.',
      route: '/reporting/import-errors',
      icon: '⚠️',
      color: 'text-amber-500'
    }
  ];
}
