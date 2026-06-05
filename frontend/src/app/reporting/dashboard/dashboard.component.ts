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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
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
