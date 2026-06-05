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
  templateUrl: './plan-types.component.html',
  styleUrl: './plan-types.component.scss'
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
