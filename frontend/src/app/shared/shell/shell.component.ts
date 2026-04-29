import { Component, inject, computed, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/auth.service';

// Phosphor Icons (Regular) — 256×256 viewBox, fill="currentColor"
const PHOSPHOR: Record<string, string> = {
  search:        `<path d="M229.66,218.34l-50.07-50.06a88.21,88.21,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>`,
  download:      `<path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>`,
  table:         `<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,104H80v48H40Zm56,0H216v48H96ZM216,56v32H40V56ZM40,168H80v32H40Zm56,32V168H216v32Z"/>`,
  chart:         `<path d="M224,200h-8V88a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8v24H112a8,8,0,0,0-8,8v24H72a8,8,0,0,0-8,8v56H48a8,8,0,0,1,0,16H224a8,8,0,0,1,0-16ZM160,96h40V200H160Zm-40,32h32V200H120Zm-40,32h32v40H80Z"/>`,
  receipt:       `<path d="M72,120a8,8,0,0,1,8-8h96a8,8,0,0,1,0,16H80A8,8,0,0,1,72,120Zm8,40h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16ZM232,56V208a8,8,0,0,1-11.58,7.16L192,200.94l-28.42,14.22a8,8,0,0,1-7.16,0L128,200.94,99.58,215.16a8,8,0,0,1-7.16,0L64,200.94,35.58,215.16A8,8,0,0,1,24,208V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,205.06V56H40V205.06l20.42-10.22a8,8,0,0,1,7.16,0L96,209.06l28.42-14.22a8,8,0,0,1,7.16,0L160,209.06l28.42-14.22a8,8,0,0,1,7.16,0ZM80,96h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16Z"/>`,
  users:         `<path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,196.11a8,8,0,1,0,13.4,8.76,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.76A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a95.87,95.87,0,0,0-52.76-38.8,60,60,0,1,0-63.6,0,95.87,95.87,0,0,0-52.76,38.8,8,8,0,0,0,13.4,8.76,80.11,80.11,0,0,1,134.32,0,8,8,0,0,0,13.4-8.76ZM160,172a44,44,0,1,1,44-44A44.05,44.05,0,0,1,160,172Z"/>`,
  clipboard:     `<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM96,168a8,8,0,0,1,0,16H80a8,8,0,0,1,0-16Zm0-32a8,8,0,0,1,0,16H80a8,8,0,0,1,0-16Zm96,48H128a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H128a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16ZM216,112H40V56H80V72a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V56h40ZM160,56H96V40h64Z"/>`,
  lock:          `<path d="M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z"/>`,
  bell:          `<path d="M221.8,175.94C216.25,166.38,208,139.5,208,104a80,80,0,1,0-160,0c0,35.5-8.25,62.38-13.8,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.08,8.3,66.76,16,80Z"/>`,
  signout:       `<path d="M112,216a8,8,0,0,1-8,8H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h56a8,8,0,0,1,0,16H48V208h56A8,8,0,0,1,112,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L196.69,120H104a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,221.66,122.34Z"/>`,
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="min-h-screen flex flex-col" style="background:#f8f9ff; font-family:'Noto Sans Thai',sans-serif; color:#171c22">

      <!-- ── Top Header ──────────────────────────────────────────────────── -->
      <header class="bg-white shadow-lift sticky top-0 z-50 px-6 py-0" style="border-bottom:1px solid rgba(67,93,152,0.08)">
        <div class="w-full flex items-center h-16 gap-6">

          <!-- Logo -->
          <a routerLink="/search" class="flex flex-col leading-tight flex-shrink-0 mr-4">
            <span class="text-xl font-bold" style="font-family:'Plus Jakarta Sans',sans-serif; color:#006874">iHOS</span>
            <span class="text-xs" style="color:#435d98">Auto Coverage Finder</span>
          </a>

          <!-- Nav links -->
          <nav class="hidden md:flex items-center gap-1">
            @for (item of visibleNavItems(); track item.path) {
              <a [routerLink]="item.path"
                 routerLinkActive="font-semibold"
                 #rla="routerLinkActive"
                 class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors"
                 [style.color]="rla.isActive ? '#006874' : '#171c22'"
                 [style.background]="rla.isActive ? 'rgba(0,104,116,0.08)' : 'transparent'">
                <span class="w-4 h-4 flex-shrink-0" [innerHTML]="icon(item.icon)"></span>
                {{ item.label }}
              </a>
            }
          </nav>

          <!-- Spacer -->
          <div class="flex-1"></div>

          <!-- Search bar -->
          <div class="hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm"
               style="background:#f0f4fd; color:#8b96a8; min-width:220px">
            <span class="w-4 h-4 flex-shrink-0" [innerHTML]="icon('search')"></span>
            <span>Search plans...</span>
          </div>

          <!-- Notification bell -->
          <button class="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-surface-low"
                  style="background:#f0f4fd; color:#435d98">
            <span class="w-5 h-5" [innerHTML]="icon('bell')"></span>
          </button>

          <!-- User avatar + menu -->
          @if (auth.currentUser(); as user) {
            <div class="relative" (click)="userMenuOpen.set(!userMenuOpen())">
              <button class="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white cursor-pointer select-none"
                      style="background:linear-gradient(135deg,#006874,#49b2c1)">
                {{ initials(user.fullName) }}
              </button>
              @if (userMenuOpen()) {
                <div class="absolute right-0 top-12 bg-white rounded-xl shadow-lift py-2 w-48 z-50"
                     style="box-shadow:0 12px 32px rgba(17,48,105,0.12)">
                  <div class="px-4 py-2 border-b" style="border-color:rgba(67,93,152,0.1)">
                    <div class="text-sm font-semibold" style="color:#171c22">{{ user.fullName }}</div>
                    <div class="text-xs capitalize" style="color:#8b96a8">{{ user.role }}</div>
                  </div>
                  @for (item of adminNavItems(); track item.path) {
                    <a [routerLink]="item.path" (click)="userMenuOpen.set(false)"
                       class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface-low transition-colors"
                       style="color:#171c22">
                      <span class="w-4 h-4 flex-shrink-0" [innerHTML]="icon(item.icon)"></span>
                      {{ item.label }}
                    </a>
                  }
                  <div class="border-t mt-1" style="border-color:rgba(67,93,152,0.1)"></div>
                  <button (click)="logout()"
                          class="w-full text-left flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-red-50"
                          style="color:#e53e3e">
                    <span class="w-4 h-4 flex-shrink-0" [innerHTML]="icon('signout')"></span>
                    Sign out
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </header>

      <!-- ── Page Content ────────────────────────────────────────────────── -->
      <main class="flex-1">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class ShellComponent {
  readonly auth    = inject(AuthService);
  readonly #san    = inject(DomSanitizer);
  readonly userMenuOpen = signal(false);

  private readonly allNavItems = [
    { label: 'Search',     path: '/search',     roles: null,                              icon: 'search'   },
    { label: 'Quotations', path: '/quotation',  roles: null,                              icon: 'receipt'  },
    { label: 'Import',     path: '/import',     roles: ['Admin','Manager','SeniorStaff'], icon: 'download' },
    { label: 'Mapping', path: '/mapping',   roles: ['Admin','Manager'],               icon: 'table'    },
    { label: 'Reports', path: '/reporting', roles: ['Admin','Manager'],               icon: 'chart'    },
  ];

  private readonly allAdminItems = [
    { label: 'Users',         path: '/admin/users',         roles: ['Admin','Manager'], icon: 'users'     },
    { label: 'Registrations', path: '/admin/registrations', roles: ['Admin','Manager'], icon: 'clipboard' },
    { label: 'Audit Log',     path: '/admin/audit-log',     roles: ['Admin'],           icon: 'lock'      },
  ];

  readonly visibleNavItems = computed(() =>
    this.allNavItems.filter(i => i.roles === null || this.auth.hasRole(...i.roles))
  );

  readonly adminNavItems = computed(() =>
    this.allAdminItems.filter(i => this.auth.hasRole(...i.roles))
  );

  icon(name: string): SafeHtml {
    const inner = PHOSPHOR[name] ?? '';
    return this.#san.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" style="width:100%;height:100%">${inner}</svg>`
    );
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  async logout(): Promise<void> {
    this.userMenuOpen.set(false);
    await this.auth.logout();
  }
}
