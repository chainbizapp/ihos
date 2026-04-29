import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  ImportApiService, InsuranceCompany,
  VehicleSyncResult, SyncedMakeDto
} from '../../core/import-api.service';

@Component({
  selector: 'app-vehicle-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  styles: [`
    .tab-link { display:flex;align-items:center;gap:6px;padding:12px 16px;font-size:13px;font-weight:600;border-bottom:2px solid transparent;color:#6b7a8d;text-decoration:none;transition:all .15s;white-space:nowrap }
    .tab-link:hover { color:#006874;background:rgba(0,104,116,0.04) }
    .tab-link.active-tab { border-bottom-color:#006874;color:#006874 }
    .make-row:hover { background: #f8f9ff; }
    .drop-active    { border-color: #006874 !important; background: #e6f4f5; }
  `],
  template: `

<!-- ── Import tab strip ──────────────────────────────────────────────────── -->
<div style="background:#fff;border-bottom:1px solid #edf1f7;position:sticky;top:64px;z-index:30">
  <div style="max-width:1280px;margin:0 auto;padding:0 24px;display:flex;gap:4px">
    <a routerLink="/import/batches" routerLinkActive="active-tab" class="tab-link">
      <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px"><path d="M213.32,210.32A8,8,0,0,1,205.66,216H50.34a8,8,0,0,1-6.39-12.76l56-72A8,8,0,0,1,112.63,128H184a8,8,0,0,1,0,16h-63l-44.8,57.56A8,8,0,0,1,50.34,216H205.66A8,8,0,0,1,213.32,210.32ZM232,88v32a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0ZM40,152V120a8,8,0,0,1,16,0v32a8,8,0,0,1-16,0Zm96-96H104V40a8,8,0,0,0-16,0V56H72a8,8,0,0,0,0,16h16V88a8,8,0,0,0,16,0V72h16a8,8,0,0,0,0-16Z"/></svg>
      Pricing Data
    </a>
    <a routerLink="/import/vehicles/sync" routerLinkActive="active-tab" class="tab-link">
      <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px"><path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/></svg>
      Vehicle Database
    </a>
  </div>
</div>

<div class="min-h-screen px-6 py-8" style="background:#f0f4fd">
  <div class="max-w-screen-xl mx-auto">

    <!-- ── Page header ───────────────────────────────────────────────────── -->
    <div class="mb-8">
      <h1 class="text-[22px] font-black mb-1"
          style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
        Vehicle Database Sync
      </h1>
      <p class="text-[13px]" style="color:#8b95a6">
        Upload a YMM master file to reconcile vehicle makes, models and
        carname_code mappings. Run this before importing pricing data for a new file.
      </p>
    </div>

    <!-- ── Upload card ───────────────────────────────────────────────────── -->
    <div class="rounded-3xl overflow-hidden mb-8"
         style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">

      <div class="px-8 py-5" style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <h2 class="text-[15px] font-black"
            style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">Upload Master File</h2>
      </div>

      <div class="px-8 py-6 flex flex-col gap-6">

        <!-- Company selector -->
        <div class="max-w-xs">
          <label class="block text-[10px] font-bold uppercase tracking-widest mb-2"
                 style="color:#8b95a6">Company</label>
          <select [ngModel]="selectedCompanyId()" (ngModelChange)="selectedCompanyId.set($event)"
                  class="w-full px-4 py-3 rounded-2xl text-[13px] font-medium focus:outline-none"
                  style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22">
            <option value="">— Select Company —</option>
            @for (c of companies(); track c.id) {
              <option [value]="c.id">{{ c.name }} ({{ c.shortCode }})</option>
            }
          </select>
        </div>

        <!-- Drop zone -->
        <div class="rounded-3xl p-8 text-center transition-all cursor-pointer"
             style="border:2px dashed rgba(17,48,105,0.15)"
             [class.drop-active]="dragOver()"
             (dragover)="$event.preventDefault(); dragOver.set(true)"
             (dragleave)="dragOver.set(false)"
             (drop)="onDrop($event)">

          @if (selectedFile()) {
            <div class="flex items-center justify-center gap-4">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                   style="background:#e6f4f5;color:#006874">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-6 h-6">
                  <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/>
                </svg>
              </div>
              <div class="text-left">
                <p class="text-[14px] font-bold" style="color:#171c22">{{ selectedFile()!.name }}</p>
                <p class="text-[12px]" style="color:#8b95a6">{{ formatSize(selectedFile()!.size) }}</p>
              </div>
              <button (click)="selectedFile.set(null)"
                      class="ml-2 w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
                      style="background:#fff0f0;color:#c0392b">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-3.5 h-3.5">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
                </svg>
              </button>
            </div>
          } @else {
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style="background:#f0f4fd;color:#435d98">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-7 h-7">
                <path d="M240,136a8,8,0,0,1-8,8H184v48a8,8,0,0,1-16,0V144H136a8,8,0,0,1,0-16h32V80a8,8,0,0,1,16,0v48h48A8,8,0,0,1,240,136ZM96,48H56V208H192V112H136a8,8,0,0,1-8-8V48H56Zm8-16H152a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,96v16H136V48H104Z"/>
              </svg>
            </div>
            <p class="text-[13px] font-semibold mb-1" style="color:#5a6270">
              Drop <span class="font-black" style="color:#171c22">db_master_car_master_v2.csv</span> here
            </p>
            <p class="text-[12px]" style="color:#8b95a6">CSV format only</p>
          }

          <label class="mt-5 inline-block cursor-pointer">
            <span class="px-5 py-2 rounded-2xl text-[12px] font-bold transition-all"
                  style="background:#f0f4fd;color:#435d98">
              Browse File
            </span>
            <input type="file" accept=".csv" class="hidden" (change)="onFileChange($event)" />
          </label>
        </div>

        <!-- Error -->
        @if (errorMessage()) {
          <div class="flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[13px] font-semibold"
               style="background:#fff0f0;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
            <span class="flex-1">{{ errorMessage() }}</span>
          </div>
        }

        <!-- Sync button -->
        <div>
          <button (click)="sync()" [disabled]="!canSync()"
                  class="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[13px] font-bold text-white transition-all disabled:opacity-40"
                  style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 10px rgba(0,104,116,0.3)">
            @if (syncing()) {
              <span class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              Syncing… this may take a moment
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
                <path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H64.44C78.74,183,103.26,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.34,58.34A8,8,0,0,0,69.63,69.63C69.86,69.41,92,48,128,48c24.74,0,49.26,25,63.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"/>
              </svg>
              Run Sync
            }
          </button>
        </div>
      </div>
    </div>

    <!-- ── Results ───────────────────────────────────────────────────────── -->
    @if (result()) {
      <div class="flex flex-col gap-6">

        <!-- Stat cards -->
        <div class="rounded-3xl overflow-hidden"
             style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">
          <div class="grid grid-cols-2 md:grid-cols-4">
            <div class="flex flex-col items-center py-6 text-center"
                 style="border-right:1px solid rgba(17,48,105,0.07)">
              <div class="text-[32px] font-black" style="color:#006874;font-family:'Plus Jakarta Sans',sans-serif">
                {{ result()!.newMakes }}
              </div>
              <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">New Makes</div>
              <div class="text-[11px] mt-0.5" style="color:#8b95a6">Added to database</div>
            </div>
            <div class="flex flex-col items-center py-6 text-center"
                 style="border-right:1px solid rgba(17,48,105,0.07)">
              <div class="text-[32px] font-black" style="color:#435d98;font-family:'Plus Jakarta Sans',sans-serif">
                {{ result()!.newModels }}
              </div>
              <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">New Models</div>
              <div class="text-[11px] mt-0.5" style="color:#8b95a6">Added to database</div>
            </div>
            <div class="flex flex-col items-center py-6 text-center"
                 style="border-right:1px solid rgba(17,48,105,0.07)">
              <div class="text-[32px] font-black" style="color:#49b2c1;font-family:'Plus Jakarta Sans',sans-serif">
                {{ result()!.newMappings }}
              </div>
              <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">New Mappings</div>
              <div class="text-[11px] mt-0.5" style="color:#8b95a6">carname_code → model</div>
            </div>
            <div class="flex flex-col items-center py-6 text-center">
              <div class="text-[32px] font-black" style="color:#8b95a6;font-family:'Plus Jakarta Sans',sans-serif">
                {{ result()!.alreadyExisting }}
              </div>
              <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">Already Existed</div>
              <div class="text-[11px] mt-0.5" style="color:#8b95a6">No changes needed</div>
            </div>
          </div>

          <!-- Secondary stats -->
          <div class="flex flex-wrap items-center gap-6 px-8 py-4"
               style="background:#f8f9ff;border-top:1px solid rgba(17,48,105,0.07)">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Total Rows</span>
              <span class="ml-2 text-[14px] font-black" style="color:#171c22">{{ result()!.totalRows | number }}</span>
            </div>
            <div class="w-px h-4" style="background:rgba(17,48,105,0.1)"></div>
            <div>
              <span class="text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Skipped</span>
              <span class="ml-2 text-[14px] font-black" style="color:#171c22">{{ result()!.skippedRows }}</span>
            </div>
            <div class="w-px h-4" style="background:rgba(17,48,105,0.1)"></div>
            <div>
              <span class="text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Makes Processed</span>
              <span class="ml-2 text-[14px] font-black" style="color:#171c22">{{ result()!.makes.length }}</span>
            </div>
          </div>
        </div>

        <!-- Makes breakdown table -->
        <div class="rounded-3xl overflow-hidden"
             style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">

          <div class="flex items-center justify-between px-6 py-4"
               style="border-bottom:1px solid rgba(17,48,105,0.07)">
            <h2 class="text-[15px] font-black"
                style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">Makes Breakdown</h2>
            <div class="flex gap-1.5 p-1 rounded-2xl" style="background:#f0f4fd">
              <button (click)="makesFilter.set('all')"
                      class="px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                      [style]="makesFilter() === 'all'
                        ? 'background:#fff;color:#171c22;box-shadow:0 2px 8px rgba(17,48,105,0.08)'
                        : 'color:#8b95a6;background:transparent'">
                All ({{ result()!.makes.length }})
              </button>
              <button (click)="makesFilter.set('new')"
                      class="px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                      [style]="makesFilter() === 'new'
                        ? 'background:#fff;color:#006874;box-shadow:0 2px 8px rgba(17,48,105,0.08)'
                        : 'color:#8b95a6;background:transparent'">
                New ({{ result()!.makes.filter(m => m.isNew).length }})
              </button>
              <button (click)="makesFilter.set('existing')"
                      class="px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                      [style]="makesFilter() === 'existing'
                        ? 'background:#fff;color:#435d98;box-shadow:0 2px 8px rgba(17,48,105,0.08)'
                        : 'color:#8b95a6;background:transparent'">
                Existing ({{ result()!.makes.filter(m => !m.isNew).length }})
              </button>
            </div>
          </div>

          <div class="overflow-auto" style="max-height:400px">
            <table class="w-full border-collapse">
              <thead>
                <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
                  <th class="text-left px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest sticky top-0"
                      style="color:#8b95a6;background:#f8f9ff">Make</th>
                  <th class="text-right px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest sticky top-0"
                      style="color:#8b95a6;background:#f8f9ff">Models Synced</th>
                  <th class="text-right px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest sticky top-0"
                      style="color:#8b95a6;background:#f8f9ff">New Models</th>
                  <th class="text-center px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest sticky top-0"
                      style="color:#8b95a6;background:#f8f9ff">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (make of filteredMakes(); track make.makeId) {
                  <tr class="make-row" style="border-bottom:1px solid rgba(17,48,105,0.05);transition:background 0.12s">
                    <td class="px-6 py-3.5 text-[13px] font-semibold" style="color:#171c22">{{ make.name }}</td>
                    <td class="px-6 py-3.5 text-right text-[13px]" style="color:#5a6270">
                      {{ makeModelCount(make.makeId) }}
                    </td>
                    <td class="px-6 py-3.5 text-right text-[13px]">
                      @if (makeNewModelCount(make.makeId) > 0) {
                        <span class="font-bold" style="color:#435d98">+{{ makeNewModelCount(make.makeId) }}</span>
                      } @else {
                        <span style="color:#8b95a6">—</span>
                      }
                    </td>
                    <td class="px-6 py-3.5 text-center">
                      @if (make.isNew) {
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                              style="background:#e6f4f5;color:#006874">New</span>
                      } @else {
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                              style="background:#f0f4fd;color:#8b95a6">Existing</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- CTA -->
        <div class="rounded-3xl px-8 py-6 flex items-center justify-between gap-6"
             style="background:linear-gradient(135deg,#e6f4f5,#f0f9fa);border:1px solid rgba(0,104,116,0.12)">
          <div>
            <p class="text-[15px] font-black" style="color:#006874;font-family:'Plus Jakarta Sans',sans-serif">
              Vehicle database is up to date
            </p>
            <p class="text-[13px] mt-1" style="color:#49b2c1">
              You can now import pricing files — all carname_code entries will resolve automatically.
            </p>
          </div>
          <a routerLink="/import/upload"
             class="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-bold text-white transition-all hover:opacity-90"
             style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 10px rgba(0,104,116,0.3)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
              <path d="M74.34,85.66A8,8,0,0,1,85.66,74.34L120,108.69V24a8,8,0,0,1,16,0v84.69l34.34-34.35a8,8,0,0,1,11.32,11.32l-48,48a8,8,0,0,1-11.32,0ZM240,136a8,8,0,0,0-8,8v56H24V144a8,8,0,0,0-16,0v64a8,8,0,0,0,8,8H240a8,8,0,0,0,8-8V144A8,8,0,0,0,240,136Z"/>
            </svg>
            Upload Pricing Data
          </a>
        </div>

      </div>
    }

  </div>
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
