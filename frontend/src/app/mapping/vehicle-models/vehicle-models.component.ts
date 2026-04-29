import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MappingApiService, VehicleModelMappingDto, VehicleModel } from '../../core/mapping-api.service';
import { ImportApiService, InsuranceCompany } from '../../core/import-api.service';

interface MakeGroup {
  make: string;
  items: VehicleModelMappingDto[];
}

@Component({
  selector: 'app-vehicle-models',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`.mapping-row:hover { background: #f8f9ff; }`],
  template: `
<div class="min-h-screen px-6 py-8" style="background:#f0f4fd;font-family:'Noto Sans Thai',sans-serif">

  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <div class="flex items-start justify-between mb-6 flex-wrap gap-4">
    <div>
      <h1 class="text-[22px] font-black" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
        Vehicle Model Mappings
      </h1>
      <p class="text-[13px] mt-0.5" style="color:#8b95a6">
        {{ totalCount() }} mapping{{ totalCount() !== 1 ? 's' : '' }}
        @if (makeFilter || companyFilter) {
          <span> · filtered</span>
        }
      </p>
    </div>
    <button (click)="openCreateDialog()"
            class="px-4 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all"
            style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 10px rgba(0,104,116,0.25)">
      + Add Mapping
    </button>
  </div>

  <!-- ── Filters ──────────────────────────────────────────────────────────── -->
  <div class="flex gap-3 mb-6 flex-wrap">
    <select [(ngModel)]="companyFilter" (ngModelChange)="onFilterChange()"
            class="px-3 py-2 rounded-xl text-[13px] font-medium focus:outline-none"
            style="background:#fff;border:1.5px solid #e2e8f0;color:#171c22;min-width:160px">
      <option value="">All Companies</option>
      @for (c of companies(); track c.id) {
        <option [value]="c.id">{{ c.name }}</option>
      }
    </select>
    <select [(ngModel)]="makeFilter" (ngModelChange)="onFilterChange()"
            class="px-3 py-2 rounded-xl text-[13px] font-medium focus:outline-none"
            style="background:#fff;border:1.5px solid #e2e8f0;color:#171c22;min-width:160px">
      <option value="">All Makes (Brands)</option>
      @for (mk of allMakeNames(); track mk) {
        <option [value]="mk">{{ mk }}</option>
      }
    </select>
    @if (companyFilter || makeFilter) {
      <button (click)="clearFilters()"
              class="px-3 py-2 rounded-xl text-[12px] font-bold transition-all"
              style="background:#fff0f0;color:#c0392b;border:1.5px solid rgba(192,57,43,0.15)">
        ล้างตัวกรอง
      </button>
    }
  </div>

  <!-- ── Content ──────────────────────────────────────────────────────────── -->
  @if (loading()) {
    <div class="rounded-3xl p-12 text-center" style="background:#fff;box-shadow:0 2px 20px rgba(17,48,105,0.07)">
      <div class="text-[13px]" style="color:#8b95a6">กำลังโหลด…</div>
    </div>
  } @else if (makeGroups().length === 0) {
    <div class="rounded-3xl p-12 text-center" style="background:#fff;box-shadow:0 2px 20px rgba(17,48,105,0.07)">
      <div class="text-[13px] font-medium" style="color:#8b95a6">ไม่พบ mapping</div>
    </div>
  } @else {
    @for (group of makeGroups(); track group.make) {
      <div class="rounded-3xl overflow-hidden mb-4"
           style="background:#fff;box-shadow:0 2px 20px rgba(17,48,105,0.07)">

        <!-- Make section header -->
        <div class="flex items-center gap-3 px-6 py-4"
             style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
               style="background:rgba(0,104,116,0.1)">
            <svg viewBox="0 0 256 256" fill="#006874" style="width:15px;height:15px">
              <path d="M240,56v144a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V56A16,16,0,0,1,32,40H224A16,16,0,0,1,240,56ZM32,56v8H224V56Zm0,32v8H224V88Zm0,32v72H224V120Z"/>
            </svg>
          </div>
          <span class="text-[15px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
            {{ group.make || '(No Make)' }}
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                style="background:rgba(0,104,116,0.1);color:#006874">
            {{ group.items.length }}
          </span>
        </div>

        <!-- Mappings table -->
        <div class="overflow-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr style="background:#fafbff;border-bottom:1px solid rgba(17,48,105,0.07)">
                <th class="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6;white-space:nowrap">
                  Source Company
                </th>
                <th class="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">
                  Raw Name (Source)
                </th>
                <th class="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">
                  → Brand (Dest)
                </th>
                <th class="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">
                  → Model (Dest)
                </th>
                <th class="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">Type</th>
                <th class="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (m of group.items; track m.id) {
                <tr class="mapping-row" style="border-bottom:1px solid rgba(17,48,105,0.04)">
                  <!-- Source: Company -->
                  <td class="px-5 py-3">
                    <span class="px-2 py-0.5 rounded-lg text-[11px] font-bold"
                          style="background:#f0f4fd;color:#435d98">
                      {{ m.companyName }}
                    </span>
                  </td>
                  <!-- Source: Raw Name -->
                  <td class="px-5 py-3">
                    <span class="font-mono text-[12px] font-semibold" style="color:#171c22">{{ m.rawName }}</span>
                  </td>
                  <!-- Dest: Make -->
                  <td class="px-5 py-3">
                    <span class="text-[13px] font-bold" style="color:#006874">{{ m.canonicalMakeName || '—' }}</span>
                  </td>
                  <!-- Dest: Model -->
                  <td class="px-5 py-3">
                    <span class="text-[13px] font-semibold" style="color:#171c22">{{ m.canonicalModelName }}</span>
                    @if (m.canonicalSubModel) {
                      <span class="ml-1.5 text-[11px] font-medium" style="color:#8b95a6">{{ m.canonicalSubModel }}</span>
                    }
                    @if (m.canonicalEngineCC) {
                      <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style="background:#f0f4fd;color:#435d98">{{ m.canonicalEngineCC }}cc</span>
                    }
                  </td>
                  <!-- Type badge -->
                  <td class="px-5 py-3">
                    @if (m.isAutoSuggested) {
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            style="background:#fff3e0;color:#e65100">Auto</span>
                    } @else {
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            style="background:#e6f4f5;color:#006874">Manual</span>
                    }
                  </td>
                  <!-- Actions -->
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-1.5">
                      <button (click)="openEditDialog(m)"
                              class="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                              style="background:#f0f4fd;color:#435d98">
                        Edit
                      </button>
                      <button (click)="deleteMapping(m)"
                              [disabled]="deleting().has(m.id)"
                              class="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40"
                              style="background:#fff0f0;color:#c0392b">
                        {{ deleting().has(m.id) ? '…' : 'Delete' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Pagination -->
    <div class="flex items-center justify-between mt-4">
      <span class="text-[12px] font-medium" style="color:#8b95a6">{{ paginationLabel() }}</span>
      <div class="flex gap-2">
        <button (click)="prevPage()" [disabled]="page() <= 1"
                class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                style="background:#fff;color:#006874;border:1.5px solid #e2e8f0">
          ← ก่อนหน้า
        </button>
        <button (click)="nextPage()" [disabled]="page() * pageSize() >= totalCount()"
                class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                style="background:#fff;color:#006874;border:1.5px solid #e2e8f0">
          ถัดไป →
        </button>
      </div>
    </div>
  }
</div>

<!-- ── Create / Edit Dialog ───────────────────────────────────────────────── -->
@if (dialogOpen()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
       style="background:rgba(17,28,34,0.45);backdrop-filter:blur(4px)"
       (click)="closeDialog()">
    <div class="relative w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
         style="background:#fff;box-shadow:0 24px 64px rgba(17,48,105,0.18);max-height:90vh"
         (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-5"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <h3 class="text-[16px] font-black"
            style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
          {{ editingId() ? 'Edit' : 'Create' }} Vehicle Model Mapping
        </h3>
        <button (click)="closeDialog()"
                class="w-8 h-8 rounded-xl flex items-center justify-center"
                style="background:#f0f4fd;color:#435d98">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 overflow-y-auto flex-1 flex flex-col gap-4">
        @if (!editingId()) {
          <!-- Company -->
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">Company (Source)</label>
            <select [(ngModel)]="form.companyId"
                    class="w-full px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                    style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22">
              <option value="">— select company —</option>
              @for (c of companies(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <!-- Raw Name -->
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">Raw Name (Source)</label>
            <input [(ngModel)]="form.rawName" type="text" placeholder="Exact name from source file"
                   class="w-full px-3 py-2.5 rounded-2xl text-[13px] font-mono focus:outline-none"
                   style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
          </div>
        }

        <!-- Dest Make filter -->
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">→ Brand (Dest Make)</label>
          <select [(ngModel)]="form.filterMakeId" (ngModelChange)="onDialogMakeSelect($event)"
                  class="w-full px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                  style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22">
            <option value="">— select make —</option>
            @for (mk of dialogMakes(); track mk.id) {
              <option [value]="mk.id">{{ mk.name }}</option>
            }
          </select>
        </div>

        <!-- Dest Model search -->
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">→ Model (Dest)</label>
          <input [(ngModel)]="dialogModelSearch" (ngModelChange)="filterDialogModels()"
                 type="text" placeholder="พิมพ์เพื่อค้นหารุ่น…"
                 class="w-full px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none mb-2"
                 style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
          <div class="rounded-2xl overflow-y-auto"
               style="border:1px solid rgba(17,48,105,0.08);max-height:200px">
            @if (dialogFilteredModels().length === 0) {
              <div class="py-6 text-center text-[12px]" style="color:#8b95a6">
                {{ form.filterMakeId ? 'ไม่พบรุ่น' : 'กรุณาเลือก Brand ก่อน' }}
              </div>
            }
            @for (m of dialogFilteredModels(); track m.id) {
              <button (click)="selectDialogModel(m)"
                      class="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                      style="border-bottom:1px solid rgba(17,48,105,0.05)"
                      [style.background]="form.canonicalModelId === m.id ? '#e6f4f5' : 'transparent'">
                <div class="flex-1 min-w-0">
                  <div class="text-[10px] font-bold uppercase tracking-wider" style="color:#8b95a6">{{ m.makeName }}</div>
                  <div class="text-[13px] font-semibold" style="color:#171c22">
                    {{ m.name }}{{ m.subModel ? ' · ' + m.subModel : '' }}{{ m.engineCC ? ' (' + m.engineCC + 'cc)' : '' }}
                  </div>
                </div>
                @if (form.canonicalModelId === m.id) {
                  <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                       style="background:#006874">
                    <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </div>
                }
              </button>
            }
          </div>
          @if (form.canonicalModelId) {
            <p class="text-[11px] mt-2 font-semibold" style="color:#006874">
              Selected: {{ selectedModelLabel() }}
            </p>
          }
        </div>

        @if (dialogError()) {
          <div class="px-4 py-3 rounded-2xl text-[12px] font-semibold"
               style="background:#fff0f0;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
            {{ dialogError() }}
          </div>
        }
      </div>

      <div class="flex gap-3 px-6 py-5" style="border-top:1px solid rgba(17,48,105,0.07)">
        <button (click)="closeDialog()"
                class="flex-1 py-2.5 rounded-2xl text-[13px] font-bold"
                style="background:#f0f4fd;color:#435d98">ยกเลิก</button>
        <button (click)="saveMapping()" [disabled]="saving()"
                class="flex-1 py-2.5 rounded-2xl text-[13px] font-bold text-white disabled:opacity-40"
                style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 10px rgba(0,104,116,0.3)">
          {{ saving() ? 'กำลังบันทึก…' : 'Save Mapping' }}
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class VehicleModelsComponent implements OnInit {
  private readonly mappingApi = inject(MappingApiService);
  private readonly importApi = inject(ImportApiService);

  mappings = signal<VehicleModelMappingDto[]>([]);
  companies = signal<InsuranceCompany[]>([]);
  loading = signal(true);
  page = signal(1);
  pageSize = signal(50);
  totalCount = signal(0);
  companyFilter = '';
  makeFilter = '';

  // All makes for the filter dropdown
  allMakeNames = signal<string[]>([]);

  // Grouped view
  readonly makeGroups = computed<MakeGroup[]>(() => {
    const map = new Map<string, VehicleModelMappingDto[]>();
    for (const m of this.mappings()) {
      const key = m.canonicalMakeName || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()]
      .map(([make, items]) => ({ make, items }))
      .sort((a, b) => a.make.localeCompare(b.make));
  });

  deleting = signal<Set<string>>(new Set());

  // Dialog state
  dialogOpen = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  dialogError = signal<string | null>(null);

  form = {
    companyId: '',
    rawName: '',
    canonicalModelId: '',
    filterMakeId: '',
  };

  // Dialog model selection
  dialogMakes = signal<{ id: string; name: string }[]>([]);
  dialogAllModels = signal<VehicleModel[]>([]);
  dialogFilteredModels = signal<VehicleModel[]>([]);
  dialogModelSearch = '';

  paginationLabel(): string {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), this.totalCount());
    return `${start}–${end} of ${this.totalCount()}`;
  }

  selectedModelLabel(): string {
    const m = this.dialogAllModels().find(x => x.id === this.form.canonicalModelId);
    if (!m) return this.form.canonicalModelId;
    return `${m.makeName} ${m.name}${m.subModel ? ' · ' + m.subModel : ''}`;
  }

  ngOnInit(): void {
    Promise.all([
      this.importApi.getCompanies(),
      this.mappingApi.getVehicleMakes(),
    ]).then(([companies, makes]) => {
      this.companies.set(companies);
      this.allMakeNames.set(makes.map(m => m.name).sort());
    });
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.mappingApi.getVehicleModelMappings({
        companyId: this.companyFilter || undefined,
        makeName: this.makeFilter || undefined,
        page: this.page(),
        pageSize: this.pageSize(),
      });
      this.mappings.set(result.items);
      this.totalCount.set(result.totalCount);
    } finally {
      this.loading.set(false);
    }
  }

  onFilterChange(): void {
    this.page.set(1);
    this.load();
  }

  clearFilters(): void {
    this.companyFilter = '';
    this.makeFilter = '';
    this.onFilterChange();
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize() < this.totalCount()) { this.page.update(p => p + 1); this.load(); }
  }

  async deleteMapping(m: VehicleModelMappingDto): Promise<void> {
    const label = `${m.rawName} → ${m.canonicalMakeName} ${m.canonicalModelName}`;
    if (!confirm(`Delete mapping "${label}"?\n\nThis will not affect already-imported records but new imports will need to be re-mapped.`)) return;
    this.deleting.update(s => new Set([...s, m.id]));
    try {
      await this.mappingApi.deleteVehicleModelMapping(m.id);
      await this.load();
    } catch (err: any) {
      alert(err?.error?.error ?? 'Failed to delete mapping.');
    } finally {
      this.deleting.update(s => { const n = new Set(s); n.delete(m.id); return n; });
    }
  }

  async openCreateDialog(): Promise<void> {
    this.editingId.set(null);
    this.form = { companyId: '', rawName: '', canonicalModelId: '', filterMakeId: '' };
    this.dialogModelSearch = '';
    this.dialogError.set(null);
    await this.loadDialogData();
    this.dialogOpen.set(true);
  }

  async openEditDialog(m: VehicleModelMappingDto): Promise<void> {
    this.editingId.set(m.id);
    this.form = {
      companyId: m.companyId,
      rawName: m.rawName,
      canonicalModelId: m.canonicalModelId,
      filterMakeId: '',
    };
    this.dialogModelSearch = m.canonicalModelName;
    this.dialogError.set(null);
    await this.loadDialogData();
    // Pre-select the make filter to narrow down the model list
    const make = this.dialogMakes().find(mk => mk.name === m.canonicalMakeName);
    if (make) {
      this.form.filterMakeId = make.id;
      this.filterDialogModels();
    }
    this.dialogOpen.set(true);
  }

  private async loadDialogData(): Promise<void> {
    if (this.dialogAllModels().length === 0) {
      const [makes, models] = await Promise.all([
        this.mappingApi.getVehicleMakes(),
        this.mappingApi.getVehicleModels(),
      ]);
      this.dialogMakes.set(makes);
      this.dialogAllModels.set(models);
    }
    this.filterDialogModels();
  }

  onDialogMakeSelect(makeId: string): void {
    this.form.filterMakeId = makeId;
    this.dialogModelSearch = '';
    this.filterDialogModels();
  }

  filterDialogModels(): void {
    const makeId = this.form.filterMakeId;
    const q = this.dialogModelSearch.toLowerCase().trim();
    let pool = this.dialogAllModels();

    if (makeId) pool = pool.filter(m => m.makeId === makeId);
    if (q) pool = pool.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.subModel?.toLowerCase().includes(q) ?? false)
    );
    this.dialogFilteredModels.set(pool);
  }

  selectDialogModel(m: VehicleModel): void {
    this.form.canonicalModelId = m.id;
    // Auto-select the make in the filter dropdown
    if (!this.form.filterMakeId) {
      this.form.filterMakeId = m.makeId;
      this.filterDialogModels();
    }
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  async saveMapping(): Promise<void> {
    this.dialogError.set(null);

    if (!this.form.canonicalModelId) {
      this.dialogError.set('Please select a destination model.');
      return;
    }
    if (!this.editingId() && !this.form.companyId) {
      this.dialogError.set('Please select a company.');
      return;
    }
    if (!this.editingId() && !this.form.rawName.trim()) {
      this.dialogError.set('Raw name is required.');
      return;
    }

    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) {
        await this.mappingApi.updateVehicleModelMapping(id, this.form.canonicalModelId);
      } else {
        await this.mappingApi.createVehicleModelMapping(
          this.form.companyId, this.form.rawName.trim(), this.form.canonicalModelId);
      }
      this.dialogOpen.set(false);
      await this.load();
    } catch (err: any) {
      this.dialogError.set(err?.error?.error ?? 'Failed to save mapping.');
    } finally {
      this.saving.set(false);
    }
  }
}
