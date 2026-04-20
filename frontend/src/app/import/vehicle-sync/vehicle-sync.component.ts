import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ImportApiService, InsuranceCompany,
  VehicleSyncResult, SyncedMakeDto
} from '../../core/import-api.service';

@Component({
  selector: 'app-vehicle-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <!-- Import tab strip -->
    <div class="bg-white border-b px-6 sticky top-16 z-30">
      <div class="max-w-screen-xl mx-auto flex gap-1">
        <a routerLink="/import/batches"
           class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
           style="border-color:transparent; color:#6b7280"
           [class.!border-[#006874]]="false"
           routerLinkActive="!border-[#006874] !text-[#006874] font-semibold">
          📥 Pricing Data
        </a>
        <a routerLink="/import/vehicles/sync"
           routerLinkActive="!border-[#006874] !text-[#006874] font-semibold"
           class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
           style="border-color:transparent; color:#6b7280">
          🚗 Vehicle Database
        </a>
      </div>
    </div>

    <div class="max-w-screen-xl mx-auto px-6 py-8">

      <!-- Page header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-[#171c22]">Vehicle Database Sync</h1>
        <p class="text-sm text-gray-500 mt-1">
          Upload Viriyah's YMM master file to reconcile vehicle makes, models and
          carname_code mappings against our database.
          Run this before importing pricing data for a new Viriyah file.
        </p>
      </div>

      <!-- Upload card -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 class="text-base font-semibold text-[#171c22] mb-4">Upload Master File</h2>

        <!-- Company selector -->
        <div class="mb-4 max-w-sm">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Company
          </label>
          <select [ngModel]="selectedCompanyId()" (ngModelChange)="selectedCompanyId.set($event)"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] bg-white">
            <option value="">— Select Company —</option>
            @for (c of companies(); track c.id) {
              <option [value]="c.id">{{ c.name }} ({{ c.shortCode }})</option>
            }
          </select>
        </div>

        <!-- Drop zone -->
        <div class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer mb-4"
             [class.border-[#006874]]="dragOver()"
             [class.bg-[#e6f4f1]]="dragOver()"
             [class.border-gray-200]="!dragOver()"
             (dragover)="$event.preventDefault(); dragOver.set(true)"
             (dragleave)="dragOver.set(false)"
             (drop)="onDrop($event)">
          @if (selectedFile()) {
            <div class="flex items-center justify-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#e6f4f1] flex items-center justify-center text-xl">📄</div>
              <div class="text-left">
                <p class="font-semibold text-[#171c22] text-sm">{{ selectedFile()!.name }}</p>
                <p class="text-xs text-gray-400">{{ formatSize(selectedFile()!.size) }}</p>
              </div>
              <button (click)="selectedFile.set(null)"
                      class="ml-4 text-gray-400 hover:text-red-500 text-lg leading-none">✕</button>
            </div>
          } @else {
            <div class="text-4xl mb-3">📂</div>
            <p class="text-sm font-medium text-gray-600">
              Drop <span class="font-bold text-[#171c22]">db_master_car_master_v2.csv</span> here
            </p>
            <p class="text-xs text-gray-400 mt-1">CSV format only</p>
          }
          <label class="mt-4 inline-block cursor-pointer">
            <span class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style="background:#f0f4fd; color:#435d98">
              Browse File
            </span>
            <input type="file" accept=".csv" class="hidden" (change)="onFileChange($event)" />
          </label>
        </div>

        <!-- Error -->
        @if (errorMessage()) {
          <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {{ errorMessage() }}
          </div>
        }

        <!-- Sync button -->
        <button (click)="sync()"
                [disabled]="!canSync()"
                class="px-6 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style="background:#006874; color:white">
          @if (syncing()) {
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Syncing… this may take a moment
          } @else {
            🔄 Run Sync
          }
        </button>
      </div>

      <!-- Results -->
      @if (result()) {
        <div class="space-y-6">

          <!-- Summary stat cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div class="text-3xl font-bold text-[#006874]">{{ result()!.newMakes }}</div>
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">New Makes</div>
              <div class="text-xs text-gray-400 mt-0.5">Added to vehicle database</div>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div class="text-3xl font-bold text-[#435d98]">{{ result()!.newModels }}</div>
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">New Models</div>
              <div class="text-xs text-gray-400 mt-0.5">Added to vehicle database</div>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div class="text-3xl font-bold text-[#49b2c1]">{{ result()!.newMappings }}</div>
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">New Mappings</div>
              <div class="text-xs text-gray-400 mt-0.5">carname_code → canonical model</div>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div class="text-3xl font-bold text-gray-400">{{ result()!.alreadyExisting }}</div>
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Already Existed</div>
              <div class="text-xs text-gray-400 mt-0.5">No changes needed</div>
            </div>
          </div>

          <!-- Secondary stats row -->
          <div class="flex gap-4 text-sm text-gray-500 bg-white rounded-xl border border-gray-100 px-5 py-3">
            <span>Total rows: <strong class="text-[#171c22]">{{ result()!.totalRows | number }}</strong></span>
            <span class="text-gray-300">|</span>
            <span>Skipped: <strong class="text-[#171c22]">{{ result()!.skippedRows }}</strong></span>
            <span class="text-gray-300">|</span>
            <span>Distinct makes processed: <strong class="text-[#171c22]">{{ result()!.makes.length }}</strong></span>
          </div>

          <!-- Makes breakdown table -->
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 class="font-semibold text-[#171c22]">Makes Breakdown</h2>
              <div class="flex gap-2">
                <button (click)="makesFilter.set('all')"
                        [class.!bg-[#006874]]="makesFilter() === 'all'"
                        [class.!text-white]="makesFilter() === 'all'"
                        class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 transition-colors">
                  All ({{ result()!.makes.length }})
                </button>
                <button (click)="makesFilter.set('new')"
                        [class.!bg-[#006874]]="makesFilter() === 'new'"
                        [class.!text-white]="makesFilter() === 'new'"
                        class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 transition-colors">
                  New ({{ result()!.makes.filter(m => m.isNew).length }})
                </button>
                <button (click)="makesFilter.set('existing')"
                        [class.!bg-[#006874]]="makesFilter() === 'existing'"
                        [class.!text-white]="makesFilter() === 'existing'"
                        class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 transition-colors">
                  Existing ({{ result()!.makes.filter(m => !m.isNew).length }})
                </button>
              </div>
            </div>
            <div class="overflow-auto max-h-96">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Make</th>
                    <th class="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Models Synced</th>
                    <th class="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">New Models</th>
                    <th class="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (make of filteredMakes(); track make.makeId) {
                    <tr class="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td class="px-5 py-2.5 font-medium text-[#171c22]">{{ make.name }}</td>
                      <td class="px-5 py-2.5 text-right text-gray-600">
                        {{ makeModelCount(make.makeId) }}
                      </td>
                      <td class="px-5 py-2.5 text-right">
                        @if (makeNewModelCount(make.makeId) > 0) {
                          <span class="text-[#435d98] font-semibold">+{{ makeNewModelCount(make.makeId) }}</span>
                        } @else {
                          <span class="text-gray-400">—</span>
                        }
                      </td>
                      <td class="px-5 py-2.5 text-center">
                        @if (make.isNew) {
                          <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e6f4f1] text-[#006874]">New</span>
                        } @else {
                          <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Existing</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- CTA: go import pricing data -->
          <div class="bg-[#e6f4f1] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p class="font-semibold text-[#006874]">Vehicle database is up to date</p>
              <p class="text-sm text-[#49b2c1] mt-0.5">
                You can now import pricing files — all carname_code entries will resolve automatically.
              </p>
            </div>
            <a routerLink="/import/upload"
               class="px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-colors hover:opacity-90 whitespace-nowrap"
               style="background:#006874">
              📥 Upload Pricing Data →
            </a>
          </div>

        </div>
      }

    </div>
  `
})
export class VehicleSyncComponent {
  private readonly importApi = inject(ImportApiService);

  companies   = signal<InsuranceCompany[]>([]);
  selectedCompanyId = signal('');
  selectedFile = signal<File | null>(null);
  syncing     = signal(false);
  dragOver    = signal(false);
  errorMessage = signal('');
  result      = signal<VehicleSyncResult | null>(null);
  makesFilter = signal<'all' | 'new' | 'existing'>('all');

  canSync = computed(() =>
    !!this.selectedCompanyId() && !!this.selectedFile() && !this.syncing()
  );

  filteredMakes = computed(() => {
    const makes = this.result()?.makes ?? [];
    const f = this.makesFilter();
    if (f === 'new')      return makes.filter(m => m.isNew);
    if (f === 'existing') return makes.filter(m => !m.isNew);
    return makes;
  });

  constructor() {
    this.importApi.getCompanies().then(c => {
      this.companies.set(c);
      const viriyah = c.find(co => co.shortCode === 'VRI');
      if (viriyah) this.selectedCompanyId.set(viriyah.id);
    });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    if (!file.name.endsWith('.csv')) {
      this.errorMessage.set('Only CSV files are accepted for vehicle master sync.');
      return;
    }
    this.selectedFile.set(file);
    this.errorMessage.set('');
    this.result.set(null);
  }

  async sync(): Promise<void> {
    if (!this.canSync()) return;
    this.syncing.set(true);
    this.errorMessage.set('');
    this.result.set(null);

    try {
      const res = await this.importApi.syncViriyahMaster(
        this.selectedCompanyId(), this.selectedFile()!
      );
      this.result.set(res);
    } catch (err: any) {
      this.errorMessage.set(
        err?.error?.error ?? err?.error?.title ?? 'Sync failed. Please try again.'
      );
    } finally {
      this.syncing.set(false);
    }
  }

  makeModelCount(makeId: string): number {
    return this.result()?.entries.filter(e => e.makeId === makeId).length ?? 0;
  }

  makeNewModelCount(makeId: string): number {
    return this.result()?.entries.filter(e => e.makeId === makeId && e.isNewModel).length ?? 0;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
