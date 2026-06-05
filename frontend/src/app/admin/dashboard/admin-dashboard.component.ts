import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-bold mb-4" style="color:#006874">Admin Dashboard</h1>
      <p class="text-sm" style="color:#8b96a8">Welcome to the admin dashboard.</p>
    </div>
  `,
})
export class AdminDashboardComponent {}
