import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MappingApiService, PlanTypeMappingDto } from '../../core/mapping-api.service';
import { ImportApiService, InsuranceCompany } from '../../core/import-api.service';

const PLAN_TYPES = ['Type1', 'Type2', 'Type3', 'Type2Plus', 'Type3Plus'];

@Component({
  selector: 'app-plan-types',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-semibold mb-6">Plan Type Mappings</h1>

      <!-- Filters -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <select [(ngModel)]="companyFilter" (ngModelChange)="load()" class="border rounded px-3 py-1.5 text-sm">
          <option value="">All Companies</option>
          @for (c of companies(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <button (click)="openCreateDialog()" class="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
          + Add Mapping
        </button>
      </div>

      @if (loading()) {
        <div class="text-gray-500 py-8 text-center">Loading...</div>
      } @else if (mappings().length === 0) {
        <div class="text-gray-500 py-8 text-center">No plan type mappings found.</div>
      } @else {
        <div class="overflow-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-left text-gray-600">
                <th class="px-4 py-2 border-b font-medium">Company</th>
                <th class="px-4 py-2 border-b font-medium">Raw Name</th>
                <th class="px-4 py-2 border-b font-medium">Canonical Plan Type</th>
                <th class="px-4 py-2 border-b"></th>
              </tr>
            </thead>
            <tbody>
              @for (m of mappings(); track m.id) {
                <tr class="hover:bg-gray-50 border-b">
                  <td class="px-4 py-2">{{ m.companyName }}</td>
                  <td class="px-4 py-2 font-mono text-xs">{{ m.rawName }}</td>
                  <td class="px-4 py-2">
                    <span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{{ m.canonicalPlanType }}</span>
                  </td>
                  <td class="px-4 py-2">
                    <button (click)="openEditDialog(m)" class="text-blue-600 hover:underline text-xs">Edit</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex justify-between items-center mt-4 text-sm text-gray-600">
          <span>{{ paginationLabel() }}</span>
          <div class="flex gap-2">
            <button (click)="prevPage()" [disabled]="page() <= 1" class="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
            <button (click)="nextPage()" [disabled]="page() * pageSize() >= totalCount()" class="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      }
    </div>

    <!-- Create/Edit Dialog -->
    @if (dialogOpen()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-4">{{ editingId() ? 'Edit' : 'Create' }} Plan Type Mapping</h3>

          @if (!editingId()) {
            <div class="mb-3">
              <label class="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select [(ngModel)]="form.companyId" class="w-full border rounded px-3 py-2 text-sm">
                <option value="">Select company...</option>
                @for (c of companies(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div class="mb-3">
              <label class="block text-sm font-medium text-gray-700 mb-1">Raw Name</label>
              <input [(ngModel)]="form.rawName" type="text" placeholder="Exact name from source file"
                class="w-full border rounded px-3 py-2 text-sm" />
            </div>
          }

          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Canonical Plan Type</label>
            <select [(ngModel)]="form.canonicalPlanType" class="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select plan type...</option>
              @for (pt of planTypes; track pt) {
                <option [value]="pt">{{ pt }}</option>
              }
            </select>
          </div>

          @if (dialogError()) {
            <p class="text-red-600 text-sm mb-3">{{ dialogError() }}</p>
          }

          <div class="flex gap-3 justify-end">
            <button (click)="closeDialog()" class="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button (click)="saveMapping()" [disabled]="saving()"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">
              {{ saving() ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PlanTypesComponent implements OnInit {
  private readonly mappingApi = inject(MappingApiService);
  private readonly importApi = inject(ImportApiService);

  mappings = signal<PlanTypeMappingDto[]>([]);
  companies = signal<InsuranceCompany[]>([]);
  loading = signal(true);
  page = signal(1);
  pageSize = signal(50);
  totalCount = signal(0);
  companyFilter = '';
  planTypes = PLAN_TYPES;

  dialogOpen = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  dialogError = signal<string | null>(null);
  form = { companyId: '', rawName: '', canonicalPlanType: '' };

  paginationLabel(): string {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), this.totalCount());
    return `${start}–${end} of ${this.totalCount()}`;
  }

  ngOnInit(): void {
    this.loadCompanies();
    this.load();
  }

  async loadCompanies(): Promise<void> {
    const companies = await this.importApi.getCompanies();
    this.companies.set(companies);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.mappingApi.getPlanTypeMappings({
        companyId: this.companyFilter || undefined,
        page: this.page(),
        pageSize: this.pageSize()
      });
      this.mappings.set(result.items);
      this.totalCount.set(result.totalCount);
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize() < this.totalCount()) { this.page.update(p => p + 1); this.load(); }
  }

  openCreateDialog(): void {
    this.editingId.set(null);
    this.form = { companyId: '', rawName: '', canonicalPlanType: '' };
    this.dialogError.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(m: PlanTypeMappingDto): void {
    this.editingId.set(m.id);
    this.form = { companyId: m.companyId, rawName: m.rawName, canonicalPlanType: m.canonicalPlanType };
    this.dialogError.set(null);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  async saveMapping(): Promise<void> {
    this.dialogError.set(null);
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) {
        await this.mappingApi.updatePlanTypeMapping(id, this.form.canonicalPlanType);
      } else {
        await this.mappingApi.createPlanTypeMapping(
          this.form.companyId, this.form.rawName, this.form.canonicalPlanType);
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
