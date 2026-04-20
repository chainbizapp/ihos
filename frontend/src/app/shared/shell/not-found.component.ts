import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div class="text-8xl font-bold text-gray-200 mb-4">404</div>
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">Page not found</h1>
      <p class="text-gray-500 mb-6">The page you're looking for doesn't exist.</p>
      <a routerLink="/search"
         class="px-5 py-2 bg-[#006874] text-white rounded-lg text-sm font-medium hover:bg-[#005a63] transition-colors">
        Back to Search
      </a>
    </div>
  `
})
export class NotFoundComponent {}
