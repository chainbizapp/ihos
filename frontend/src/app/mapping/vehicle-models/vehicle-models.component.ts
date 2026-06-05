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
  
  templateUrl: './vehicle-models.component.html',
  styleUrl: './vehicle-models.component.scss'
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
