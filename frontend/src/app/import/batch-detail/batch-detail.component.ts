import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ImportApiService, ImportBatchDetail, ImportRecordDto } from '../../core/import-api.service';
import { MappingApiService, VehicleModel } from '../../core/mapping-api.service';

/** One unresolved raw vehicle name + how many records share it. */
interface UnresolvedGroup {
  rawName: string;
  count: number;
  /** Brand hint extracted from coverage_details.brand_name (Allianz-specific). */
  brandHint?: string;
  /** Parsed model root hint, e.g. "BT-50 PRO" from "BT-50 PRO 2.2 2 Doors". */
  modelRootHint?: string;
  /** Parsed engine CC hint, e.g. "2.2" from "BT-50 PRO 2.2 2 Doors". */
  engineCCHint?: string;
}

/** What autoMapAll would do for a single unresolved group. */
interface GroupPreview {
  /** map = will link to an existing model; create = will create make+model; manual = no brand info */
  method: 'map' | 'create' | 'manual';
  brand: string;
  model: string;
}

/**
 * Splits a composite model raw name into a base model name and optional sub-model.
 * Handles Allianz-style names like "A4 3.0 4 Doors" → { modelRoot: "A4", subModel: "3.0 4 Doors" }.
 * Simple names like "D9" or "X9 Plus" are returned unchanged with no sub-model.
 */
function splitModelName(rawName: string): { modelRoot: string; subModel: string } {
  const tokens = rawName.trim().split(' ');
  let cutIndex = tokens.length;
  for (let i = 1; i < tokens.length; i++) {
    // A token is a "spec suffix" if it starts with a digit or decimal point
    if (/^[\d.]/.test(tokens[i])) {
      cutIndex = i;
      break;
    }
  }
  return {
    modelRoot: tokens.slice(0, cutIndex).join(' '),
    subModel:  tokens.slice(cutIndex).join(' ')
  };
}

@Component({
  selector: 'app-batch-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  
  templateUrl: './batch-detail.component.html',
  styleUrl: './batch-detail.component.scss'
})
export class BatchDetailComponent implements OnInit {
  private readonly importApi = inject(ImportApiService);
  private readonly mappingApi = inject(MappingApiService);
  private readonly route = inject(ActivatedRoute);

  batch = signal<ImportBatchDetail | null>(null);
  records = signal<ImportRecordDto[]>([]);
  loading = signal(true);
  recordPage = signal(1);
  recordPageSize = signal(50);
  recordsTotalCount = signal(0);
  issuesOnly = signal(false);

  actioning = signal<Set<string>>(new Set());
  publishing = signal(false);
  approvingAll = signal(false);
  rejectingAll = signal(false);
  reResolving = signal(false);
  autoMappingAll = signal(false);

  duplicateReport = signal<{ totalDuplicateRecords: number; groups: any[] } | null>(null);
  loadingDuplicates = signal(false);
  rejectingRecord = signal<ImportRecordDto | null>(null);
  rejectReason = '';
  actionError = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);

  // ── Unresolved vehicle models ─────────────────────────────────────────────
  /** All unresolved records loaded separately (large page) for grouping. */
  private allUnresolvedRecords = signal<ImportRecordDto[]>([]);

  unresolvedGroups = computed<UnresolvedGroup[]>(() => {
    const map = new Map<string, UnresolvedGroup>();
    for (const r of this.allUnresolvedRecords()) {
      if (r.mappingStatus !== 'PendingMapping' || r.reviewStatus !== 'Pending') continue;
      try {
        const raw = JSON.parse(r.rawData);
        const rawName: string = raw['vehicle_model'] ?? '';
        if (!rawName) continue;
        if (!map.has(rawName)) {
          let brandHint: string | undefined;
          let modelRootHint: string | undefined;
          let engineCCHint: string | undefined;
          try {
            const cd = raw['coverage_details'];
            // coverage_details is stored as a JSON string inside the outer JSON
            const cdObj = typeof cd === 'string' ? JSON.parse(cd) : cd;
            brandHint     = cdObj?.['brand_name']       || undefined;
            modelRootHint = cdObj?.['parsed_model_root'] || undefined;
            engineCCHint  = cdObj?.['parsed_engine_cc']  || undefined;
          } catch { /* ignore parse errors */ }
          map.set(rawName, { rawName, count: 0, brandHint, modelRootHint, engineCCHint });
        }
        map.get(rawName)!.count++;
      } catch { /* skip malformed rows */ }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  });

  /** Preview of what autoMapAll would do for each unresolved group. */
  readonly unresolvedGroupPreviews = computed<Map<string, GroupPreview>>(() => {
    const models = this.allModels();
    const result = new Map<string, GroupPreview>();
    if (models.length === 0) return result;
    for (const group of this.unresolvedGroups()) {
      result.set(group.rawName, this.computePreview(group, models));
    }
    return result;
  });

  // ── Mapping dialog ────────────────────────────────────────────────────────
  mappingDialog = signal<UnresolvedGroup | null>(null);
  mappingTab = signal<'search' | 'create'>('search');
  mappingError = signal<string | null>(null);
  mappingSaving = signal(false);

  // Search tab
  modelSearch = '';
  selectedModelId = signal<string | null>(null);

  // All makes & models (loaded once when dialog opens)
  allMakes = signal<{ id: string; name: string }[]>([]);
  allModels = signal<VehicleModel[]>([]);
  filteredModels = signal<VehicleModel[]>([]);

  // Create tab
  newMakeId = '';
  newMakeName = '';
  newModelName = '';
  newSubModel = '';
  newEngineCC = '';

  private batchId = '';

  recordPaginationLabel(): string {
    const start = (this.recordPage() - 1) * this.recordPageSize() + 1;
    const end = Math.min(this.recordPage() * this.recordPageSize(), this.recordsTotalCount());
    return `Records ${start}–${end} of ${this.recordsTotalCount()}`;
  }

  canApproveAll(): boolean {
    const b = this.batch();
    if (!b || this.approvingAll()) return false;
    if (b.status !== 'PendingReview') return false;
    return b.resolvedRows > 0;
  }

  ngOnInit(): void {
    this.batchId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      // Load models once — needed for the preview column and autoMapAll
      const fetchModels = this.allModels().length === 0
        ? Promise.all([this.mappingApi.getVehicleMakes(), this.mappingApi.getVehicleModels()])
            .then(([makes, models]) => { this.allMakes.set(makes); this.allModels.set(models); })
        : Promise.resolve();

      const [detail] = await Promise.all([
        this.importApi.getBatchDetail(
          this.batchId, this.recordPage(), this.recordPageSize(), this.issuesOnly()),
        fetchModels,
      ]);
      this.batch.set(detail);
      this.records.set(detail.records);
      this.recordsTotalCount.set(detail.recordsTotalCount);

      // Fetch ALL pending records across all pages so every unresolved vehicle model
      // group is visible at once — avoids the "click Auto Map All 5 times" problem
      // caused by a 2000-record hard cap missing groups on later pages.
      await this.loadAllUnresolvedRecords();
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAllUnresolvedRecords(): Promise<void> {
    const PAGE_SIZE = 500;
    const all: ImportRecordDto[] = [];
    let page = 1;
    while (true) {
      const result = await this.importApi.getRecords(this.batchId, page, PAGE_SIZE, true);
      all.push(...result.items);
      if (all.length >= result.totalCount || result.items.length < PAGE_SIZE) break;
      page++;
    }
    this.allUnresolvedRecords.set(all);
  }

  prevRecordPage(): void {
    if (this.recordPage() > 1) {
      this.recordPage.update(p => p - 1);
      this.loadRecords();
    }
  }

  nextRecordPage(): void {
    if (this.recordPage() * this.recordPageSize() < this.recordsTotalCount()) {
      this.recordPage.update(p => p + 1);
      this.loadRecords();
    }
  }

  private async loadRecords(): Promise<void> {
    const result = await this.importApi.getRecords(
      this.batchId, this.recordPage(), this.recordPageSize(), this.issuesOnly());
    this.records.set(result.items);
    this.recordsTotalCount.set(result.totalCount);
  }

  onIssuesOnlyChange(val: boolean): void {
    this.issuesOnly.set(val);
    this.recordPage.set(1);
    this.loadRecords();
  }

  async approveRecord(record: ImportRecordDto): Promise<void> {
    this.actionError.set(null);
    this.actioning.update(s => new Set([...s, record.id]));
    try {
      await this.importApi.approveRecord(record.id);
      await this.load();
      this.actionSuccess.set(`Record #${record.rowNumber} approved.`);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to approve record.');
    } finally {
      this.actioning.update(s => { const n = new Set(s); n.delete(record.id); return n; });
    }
  }

  openRejectDialog(record: ImportRecordDto): void {
    this.rejectReason = '';
    this.rejectingRecord.set(record);
  }

  cancelReject(): void {
    this.rejectingRecord.set(null);
  }

  async confirmReject(): Promise<void> {
    const record = this.rejectingRecord();
    if (!record) return;
    this.actionError.set(null);
    this.actioning.update(s => new Set([...s, record.id]));
    this.rejectingRecord.set(null);
    try {
      await this.importApi.rejectRecord(record.id, this.rejectReason || undefined);
      await this.load();
      this.actionSuccess.set(`Record #${record.rowNumber} rejected.`);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to reject record.');
    } finally {
      this.actioning.update(s => { const n = new Set(s); n.delete(record.id); return n; });
    }
  }

  async reResolve(): Promise<void> {
    this.actionError.set(null);
    this.reResolving.set(true);
    try {
      const result = await this.importApi.reResolveMappings(this.batchId);
      await this.load();
      this.actionSuccess.set(`Re-resolve complete: ${result.resolvedCount} newly resolved, ${result.stillPending} still pending.`);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to re-resolve mappings.');
    } finally {
      this.reResolving.set(false);
    }
  }

  async autoMapAll(): Promise<void> {
    if (this.unresolvedGroups().length === 0) return;
    
    this.autoMappingAll.set(true);
    this.actionError.set(null);
    
    try {
      // 1. Ensure models are loaded
      if (this.allModels().length === 0) {
        const [makes, models] = await Promise.all([
          this.mappingApi.getVehicleMakes(),
          this.mappingApi.getVehicleModels()
        ]);
        this.allMakes.set(makes);
        this.allModels.set(models);
      }
      
      const models = this.allModels();
      const companyId = this.batch()?.companyId;
      if (!companyId) throw new Error('Company ID not found');
      
      let mappedCount = 0;
      let needsManualCount = 0;

      // 2. For each group, find the best match
      for (const group of this.unresolvedGroups()) {
        const rawName = group.rawName;

        // Prefer adapter-parsed hints (Allianz embeds CC in the name).
        // Fall back to the generic heuristic: split on first decimal token, convert to cc.
        let modelRoot: string;
        let ccHint: string | null;
        if (group.modelRootHint) {
          modelRoot = group.modelRootHint;
          ccHint    = group.engineCCHint ?? null;
        } else {
          const { modelRoot: root, subModel } = splitModelName(rawName);
          modelRoot = root;
          const ccMatch = subModel.match(/^(\d+\.\d+)/);
          ccHint = ccMatch ? String(Math.round(parseFloat(ccMatch[1]) * 1000)) : null;
        }

        // When a brandHint is available (Allianz coverage_details.brand_name),
        // restrict to models under that make so "X9" never matches a DENZA model
        // instead of the correct XPENG model.
        const brandPool = group.brandHint
          ? models.filter(m => m.makeName?.toLowerCase() === group.brandHint!.toLowerCase())
          : models;

        // Within the brand pool, further restrict by CC when available.
        const ccPool = ccHint
          ? brandPool.filter(m => (m.engineCC ?? '') === ccHint)
          : brandPool;

        // Prefer brand+CC pool → brand-only pool → full pool (in that priority order).
        // IMPORTANT: when brandHint is known, NEVER fall back to all models.
        // An empty brand pool means no models exist for that brand yet → skip to Path 2
        // (create new Make + Model). Without this guard, "D9" with brandHint="DENZA"
        // would fall through to all models and Levenshtein-match an EVO/other brand model.
        const candidates =
          ccPool.length > 0    ? ccPool    :
          brandPool.length > 0 ? brandPool :
          group.brandHint      ? []        :
          models;

        let bestModel: VehicleModel | null = null;
        let minDistance = 3; // accept distance <= 2 (same as backend MappingResolverService)

        for (const m of candidates) {
          // Build candidate string: name only (subModel is a further variant, not part of root match)
          const candidate = m.name;

          // 1. Exact match on model root
          if (modelRoot.toLowerCase() === candidate.toLowerCase()) {
            bestModel = m;
            minDistance = 0;
            break;
          }

          // 2. Levenshtein on model root vs candidate name
          if (Math.abs(modelRoot.length - candidate.length) < minDistance) {
            const d = this.levenshtein(modelRoot, candidate);
            if (d < minDistance) {
              minDistance = d;
              bestModel = m;
            }
          }
        }

        if (bestModel && minDistance <= 2) {
          // ── Path 1: map to existing model ──────────────────────────────────
          try {
            await this.mappingApi.createVehicleModelMapping(companyId, rawName, bestModel.id);
            mappedCount++;
          } catch (err) {
            console.warn(`Failed to auto-map "${rawName}":`, err);
          }
        } else if (modelRoot) {
          // ── Path 2: create new Make + Model + Mapping ───────────────────────
          // brandHint supplies the make name (available when the adapter embeds it,
          // e.g. Allianz coverage_details.brand_name).
          // Without a brandHint we cannot determine which make to create under,
          // so those groups are counted as "needs manual" and skipped.
          if (!group.brandHint) {
            needsManualCount++;
          } else {
            try {
              // 1. Find or create VehicleMake
              let make = this.allMakes().find(
                m => m.name.toLowerCase() === group.brandHint!.toLowerCase()
              );
              let makeId: string;
              if (make) {
                makeId = make.id;
              } else {
                const created = await this.mappingApi.createVehicleMake(group.brandHint!);
                makeId = created.id;
                if (created.isNew) {
                  this.allMakes.set([...this.allMakes(), { id: created.id, name: created.name }]);
                }
              }

              // 2. Create VehicleModel (server handles find-or-create by unique key)
              const model = await this.mappingApi.createVehicleModel(
                makeId, modelRoot, undefined, ccHint ?? undefined
              );
              if (model.isNew) {
                // Refresh local pool so subsequent iterations can find this new model
                const refreshed = await this.mappingApi.getVehicleModels();
                this.allModels.set(refreshed);
              }

              // 3. Create the raw-name → canonical model mapping
              await this.mappingApi.createVehicleModelMapping(companyId, rawName, model.id);
              mappedCount++;
            } catch (err) {
              console.warn(`Failed to create new record for "${rawName}":`, err);
            }
          }
        }
      }

      const parts: string[] = [];
      if (mappedCount > 0) parts.push(`${mappedCount} mapped/created`);
      if (needsManualCount > 0) parts.push(`${needsManualCount} need manual mapping (no brand info)`);

      if (mappedCount > 0) {
        this.actionSuccess.set(`Auto Map complete: ${parts.join(', ')}. Re-resolving...`);
        await this.reResolve();
      } else if (needsManualCount > 0) {
        this.actionError.set(`Could not auto-map: ${needsManualCount} group(s) have no brand info — please map them manually.`);
      } else {
        this.actionError.set('Could not find any matches to auto-map.');
      }
      
    } catch (err: any) {
      this.actionError.set(err?.message ?? 'Auto-map failed.');
    } finally {
      this.autoMappingAll.set(false);
    }
  }


  private computePreview(group: UnresolvedGroup, models: VehicleModel[]): GroupPreview {
    let modelRoot: string;
    let ccHint: string | null;
    if (group.modelRootHint) {
      modelRoot = group.modelRootHint;
      ccHint    = group.engineCCHint ?? null;
    } else {
      const { modelRoot: root, subModel } = splitModelName(group.rawName);
      modelRoot = root;
      const ccMatch = subModel.match(/^(\d+\.\d+)/);
      ccHint = ccMatch ? String(Math.round(parseFloat(ccMatch[1]) * 1000)) : null;
    }

    const brandPool = group.brandHint
      ? models.filter(m => m.makeName?.toLowerCase() === group.brandHint!.toLowerCase())
      : models;
    const ccPool = ccHint
      ? brandPool.filter(m => (m.engineCC ?? '') === ccHint)
      : brandPool;
    const candidates =
      ccPool.length > 0    ? ccPool    :
      brandPool.length > 0 ? brandPool :
      group.brandHint      ? []        :
      models;

    let bestModel: VehicleModel | null = null;
    let minDistance = 3; // accept distance <= 2 (same as backend MappingResolverService)
    for (const m of candidates) {
      if (modelRoot.toLowerCase() === m.name.toLowerCase()) {
        bestModel = m; minDistance = 0; break;
      }
      if (Math.abs(modelRoot.length - m.name.length) < minDistance) {
        const d = this.levenshtein(modelRoot, m.name);
        if (d < minDistance) { minDistance = d; bestModel = m; }
      }
    }

    if (bestModel && minDistance <= 2) {
      return { method: 'map', brand: bestModel.makeName ?? '', model: bestModel.name };
    } else if (modelRoot && group.brandHint) {
      return { method: 'create', brand: group.brandHint, model: modelRoot };
    } else {
      return { method: 'manual', brand: '', model: '' };
    }
  }

  private levenshtein(s1: string, s2: string): number {
    let a = s1.toLowerCase();
    let b = s2.toLowerCase();
    
    if (a.length < b.length) { [a, b] = [b, a]; }
    if (b.length === 0) return a.length;

    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = i;
      for (let j = 1; j <= b.length; j++) {
        const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
        row[j - 1] = prev;
        prev = val;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  }

  // ── Mapping dialog ────────────────────────────────────────────────────────

  async openMappingDialog(group: UnresolvedGroup): Promise<void> {
    this.mappingDialog.set(group);
    this.mappingTab.set('search');
    this.mappingError.set(null);
    this.selectedModelId.set(null);
    this.newMakeId = '';
    this.newMakeName = group.brandHint ?? '';

    // If the adapter already parsed the model name (Allianz-style "BT-50 PRO 2.2 2 Doors"),
    // use those hints directly. Otherwise fall back to the generic splitModelName heuristic.
    if (group.modelRootHint) {
      this.newModelName = group.modelRootHint;
      this.newEngineCC  = group.engineCCHint ?? '';
      this.newSubModel  = '';
      this.modelSearch  = group.modelRootHint;
    } else {
      const { modelRoot, subModel } = splitModelName(group.rawName);
      this.newModelName = modelRoot;
      this.modelSearch  = modelRoot;

      // If the subModel starts with a decimal CC token (e.g. "2.8 2 Doors"),
      // extract it as Engine CC (×1000) and keep the rest as the actual sub-model.
      const ccMatch = subModel.match(/^(\d+\.\d+)(?:\s+(.+))?$/);
      if (ccMatch) {
        this.newEngineCC = String(Math.round(parseFloat(ccMatch[1]) * 1000));
        this.newSubModel = ccMatch[2]?.trim() ?? '';
      } else {
        this.newEngineCC = '';
        this.newSubModel = subModel;
      }
    }

    // Load makes & models if not already loaded
    if (this.allModels().length === 0) {
      const [makes, models] = await Promise.all([
        this.mappingApi.getVehicleMakes(),
        this.mappingApi.getVehicleModels()
      ]);
      this.allMakes.set(makes);
      this.allModels.set(models);
    }
    this.filterModels();
  }

  closeMappingDialog(): void {
    this.mappingDialog.set(null);
  }

  filterModels(): void {
    const q = this.modelSearch.toLowerCase().trim();
    if (!q) {
      this.filteredModels.set(this.allModels());
      return;
    }
    this.filteredModels.set(
      this.allModels().filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.makeName?.toLowerCase().includes(q) ||
        (m.subModel?.toLowerCase().includes(q) ?? false)
      )
    );
  }

  selectExistingModel(m: VehicleModel): void {
    this.selectedModelId.set(m.id);
  }

  onNewMakeSelect(makeId: string): void {
    this.newMakeId = makeId;
    if (makeId) this.newMakeName = '';
  }

  async saveMapping(): Promise<void> {
    const group = this.mappingDialog();
    if (!group) return;

    this.mappingError.set(null);
    this.mappingSaving.set(true);

    try {
      let canonicalModelId: string;

      if (this.mappingTab() === 'search') {
        const selId = this.selectedModelId();
        if (!selId) { this.mappingError.set('Please select a vehicle model.'); this.mappingSaving.set(false); return; }
        canonicalModelId = selId;

      } else {
        // Create tab: find-or-create make, then find-or-create model
        if (!this.newMakeId && !this.newMakeName.trim()) {
          this.mappingError.set('Enter a make name or select an existing make.');
          this.mappingSaving.set(false); return;
        }
        if (!this.newModelName.trim()) {
          this.mappingError.set('Model name is required.');
          this.mappingSaving.set(false); return;
        }

        let makeId = this.newMakeId;
        if (!makeId) {
          const mk = await this.mappingApi.createVehicleMake(this.newMakeName.trim());
          makeId = mk.id;
          // Refresh makes list if a new one was created
          if (mk.isNew) this.allMakes.set([...this.allMakes(), { id: mk.id, name: mk.name }]);
        }

        const model = await this.mappingApi.createVehicleModel(
          makeId,
          this.newModelName.trim(),
          this.newSubModel.trim() || undefined,
          this.newEngineCC.trim() || undefined
        );
        canonicalModelId = model.id;

        // Refresh models list
        if (model.isNew) {
          const refreshed = await this.mappingApi.getVehicleModels();
          this.allModels.set(refreshed);
          this.filterModels();
        }
      }

      // Create the vehicle model mapping for this company + rawName
      const batchDetail = this.batch();
      if (!batchDetail) return;
      await this.mappingApi.createVehicleModelMapping(
        batchDetail.companyId, group.rawName, canonicalModelId
      );

      this.closeMappingDialog();
      this.actionSuccess.set(`Mapping saved for "${group.rawName}". Click Re-resolve Mappings to apply.`);
    } catch (err: any) {
      this.mappingError.set(err?.error?.error ?? 'Failed to save mapping.');
    } finally {
      this.mappingSaving.set(false);
    }
  }

  async rejectAllUnresolved(): Promise<void> {
    const b = this.batch();
    const count = (b?.pendingRows ?? 0) + (b?.resolvedRows ?? 0);
    if (!confirm(`Reject all ${count} remaining records? They will be skipped during publish. This cannot be undone.`)) return;
    this.actionError.set(null);
    this.rejectingAll.set(true);
    try {
      const result = await this.importApi.rejectAllUnresolved(this.batchId);
      await this.load();
      this.actionSuccess.set(`${result.rejectedCount} unresolved record(s) rejected. You can now publish the remaining approved records.`);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to reject unresolved records.');
    } finally {
      this.rejectingAll.set(false);
    }
  }

  async approveAllResolved(): Promise<void> {
    this.actionError.set(null);
    this.approvingAll.set(true);
    try {
      const result = await this.importApi.approveAllResolved(this.batchId);
      await this.load();
      this.actionSuccess.set(`${result.approvedCount} record(s) approved.`);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to approve records.');
    } finally {
      this.approvingAll.set(false);
    }
  }

  async loadDuplicates(): Promise<void> {
    this.loadingDuplicates.set(true);
    try {
      const result = await this.importApi.getBatchDuplicates(this.batchId, 30);
      this.duplicateReport.set(result);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to load duplicates.');
    } finally {
      this.loadingDuplicates.set(false);
    }
  }

  async publishBatch(): Promise<void> {
    this.actionError.set(null);
    this.publishing.set(true);
    try {
      const result = await this.importApi.publishBatch(this.batchId);
      await this.load();
      const parts = [`${result.plansCreated} plan(s) created`];
      if (result.plansUpdated > 0) parts.push(`${result.plansUpdated} updated`);
      if (result.errorCount > 0) parts.push(`${result.errorCount} skipped (duplicate key)`);
      this.actionSuccess.set(`Batch published. ${parts.join(', ')}.`);
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'Failed to publish batch.');
    } finally {
      this.publishing.set(false);
    }
  }

  formatRawData(rawData: string): string {
    try {
      return JSON.stringify(JSON.parse(rawData), null, 2);
    } catch {
      return rawData;
    }
  }

  statusStyle(status: string): string {
    const map: Record<string, string> = {
      Processing:    'background:#e8eef8;color:#435d98',
      PendingReview: 'background:#fff3e0;color:#e65100',
      Published:     'background:#e6f4f5;color:#006874',
      Rejected:      'background:#fff0f0;color:#c0392b',
      Failed:        'background:#f0f4fd;color:#8b95a6',
    };
    return map[status] ?? 'background:#f0f4fd;color:#8b95a6';
  }

  mappingStatusStyle(status: string): string {
    return status === 'Resolved'
      ? 'background:#e6f4f5;color:#006874'
      : 'background:#fff3e0;color:#e65100';
  }

  reviewStatusStyle(status: string): string {
    const map: Record<string, string> = {
      Pending:  'background:#f0f4fd;color:#8b95a6',
      Approved: 'background:#e6f4f5;color:#006874',
      Rejected: 'background:#fff0f0;color:#c0392b',
    };
    return map[status] ?? 'background:#f0f4fd;color:#8b95a6';
  }
}
