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
  template: `
    <div class="p-6">
      <div class="mb-4">
        <a routerLink="/import/batches" class="text-blue-600 hover:underline text-sm">← Back to Batches</a>
      </div>

      @if (loading()) {
        <div class="text-gray-500 py-8 text-center">Loading...</div>
      } @else if (batch()) {
        <!-- Batch header -->
        <div class="bg-white border rounded-lg p-4 mb-6">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-xl font-semibold">{{ batch()!.sourceFileName }}</h1>
              <p class="text-gray-500 text-sm mt-1">{{ batch()!.companyName }} · Uploaded {{ batch()!.uploadedAt | date:'dd/MM/yyyy HH:mm' }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span [class]="statusClass(batch()!.status)" class="px-3 py-1 rounded text-sm font-medium">
                {{ batch()!.status }}
              </span>
              @if (batch()!.status === 'PendingReview') {
                <button
                  (click)="reResolve()"
                  [disabled]="reResolving()"
                  title="Re-run mapping resolution for all unresolved records"
                  class="bg-gray-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ reResolving() ? 'Re-resolving...' : 'Re-resolve Mappings' }}
                </button>
                @if (batch()!.pendingRows > 0) {
                  <button
                    (click)="rejectAllUnresolved()"
                    [disabled]="rejectingAll()"
                    [title]="'Reject all ' + batch()!.pendingRows + ' unresolved records so you can publish the rest'"
                    class="bg-orange-500 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
                    {{ rejectingAll() ? 'Rejecting...' : 'Reject Unresolved (' + batch()!.pendingRows + ')' }}
                  </button>
                }
                <button
                  (click)="approveAllResolved()"
                  [disabled]="!canApproveAll()"
                  title="Approve all records with resolved mappings in one click"
                  class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ approvingAll() ? 'Approving...' : 'Approve All Resolved' }}
                </button>
                <button
                  (click)="publishBatch()"
                  [disabled]="publishing() || batch()!.pendingRows > 0"
                  [title]="batch()!.pendingRows > 0 ? batch()!.pendingRows + ' unresolved records must be mapped or rejected first' : 'Publish batch'"
                  class="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {{ publishing() ? 'Publishing...' : 'Publish Batch' }}
                </button>
              }
            </div>
          </div>

          <div class="grid grid-cols-5 gap-4 mt-4 text-center text-sm">
            <div class="bg-gray-50 rounded p-3">
              <div class="text-2xl font-bold">{{ batch()!.totalRows }}</div>
              <div class="text-gray-500">Total</div>
            </div>
            <div class="bg-green-50 rounded p-3">
              <div class="text-2xl font-bold text-green-700">{{ batch()!.resolvedRows }}</div>
              <div class="text-gray-500">Resolved</div>
            </div>
            <div class="bg-yellow-50 rounded p-3">
              <div class="text-2xl font-bold text-yellow-700">{{ batch()!.pendingRows }}</div>
              <div class="text-gray-500">Pending</div>
            </div>
            <div class="bg-blue-50 rounded p-3">
              <div class="text-2xl font-bold text-blue-700">{{ batch()!.approvedRows }}</div>
              <div class="text-gray-500">Approved</div>
            </div>
            <div class="bg-red-50 rounded p-3">
              <div class="text-2xl font-bold text-red-700">{{ batch()!.rejectedRows }}</div>
              <div class="text-gray-500">Rejected</div>
            </div>
          </div>
        </div>

        @if (actionError()) {
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {{ actionError() }}
            <button (click)="actionError.set(null)" class="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        }

        @if (actionSuccess()) {
          <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
            {{ actionSuccess() }}
            <button (click)="actionSuccess.set(null)" class="ml-2 text-green-500 hover:text-green-700">✕</button>
          </div>
        }

        <!-- ── Duplicate Records panel ─────────────────────────────────────── -->
        @if (!duplicateReport() && !loadingDuplicates()) {
          <div class="mb-4 flex justify-end">
            <button (click)="loadDuplicates()"
              class="text-xs text-gray-500 hover:text-[#006874] underline">
              Analyse duplicate records
            </button>
          </div>
        }
        @if (loadingDuplicates()) {
          <div class="mb-4 text-xs text-gray-400">Analysing duplicates…</div>
        }
        @if (duplicateReport()) {
          <div class="mb-6 border border-orange-200 rounded-xl overflow-hidden">
            <div class="bg-orange-50 px-4 py-3 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-orange-500 text-lg">⚠</span>
                <h2 class="font-semibold text-orange-800 text-sm">
                  Duplicate Records
                  <span class="ml-1 px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 text-xs font-bold">
                    {{ duplicateReport()!.totalDuplicateRecords }} skipped
                  </span>
                </h2>
                <p class="text-xs text-orange-700">
                  Records share the same unique key — only the first row in each group is kept.
                </p>
              </div>
              <button (click)="duplicateReport.set(null)" class="text-orange-400 hover:text-orange-600 text-sm">✕</button>
            </div>
            <div class="overflow-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-orange-50 text-left text-orange-700">
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Duplicates</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">First Row #</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Repair</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Car Age</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Sum Insured</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Rate Code</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Vehicle Codes (carname_code)</th>
                    <th class="px-3 py-2 border-b border-orange-100 font-medium">Duplicate Rows</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of duplicateReport()!.groups; track $index) {
                    <tr class="border-b border-orange-50 hover:bg-orange-50">
                      <td class="px-3 py-2 font-bold text-orange-700">×{{ g.count }}</td>
                      <td class="px-3 py-2 font-mono text-gray-600">#{{ g.firstRowNumber }}</td>
                      <td class="px-3 py-2 text-gray-600">{{ g.repairType }}</td>
                      <td class="px-3 py-2 text-gray-600">{{ g.minYear }}</td>
                      <td class="px-3 py-2 font-mono text-gray-700">{{ g.sumInsured | number }}</td>
                      <td class="px-3 py-2 font-mono text-gray-500">{{ g.externalPackageId || '—' }}</td>
                      <td class="px-3 py-2">
                        <div class="flex flex-wrap gap-1">
                          @for (v of g.vehicleModels; track v) {
                            <span class="font-mono bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[11px]">{{ v }}</span>
                          }
                        </div>
                      </td>
                      <td class="px-3 py-2 font-mono text-gray-400 text-[11px]">
                        {{ g.duplicateRows.slice(0, 5).join(', ') }}{{ g.duplicateRows.length > 5 ? '…' : '' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (duplicateReport()!.groups.length === 30) {
              <div class="bg-orange-50 px-4 py-2 text-xs text-orange-600">Showing top 30 groups. Re-import with the fix applied to eliminate all duplicates.</div>
            }
          </div>
        }

        <!-- ── Unresolved Vehicle Models panel ──────────────────────────────── -->
        @if (unresolvedGroups().length > 0 && batch()!.status === 'PendingReview') {
          <div class="mb-6 border border-yellow-200 rounded-xl overflow-hidden">
            <div class="bg-yellow-50 px-4 py-3 flex items-center gap-2">
              <span class="text-yellow-600 text-lg">⚠</span>
              <h2 class="font-semibold text-yellow-800 text-sm">
                Unresolved Vehicle Models
                <span class="ml-1 px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800 text-xs font-bold">
                  {{ unresolvedGroups().length }}
                </span>
              </h2>
              <p class="ml-2 text-xs text-yellow-700">
                Map each name to a canonical vehicle model, then click Re-resolve Mappings.
              </p>
            </div>
            <div class="divide-y divide-yellow-100">
              @for (group of unresolvedGroups(); track group.rawName) {
                <div class="flex items-center gap-4 px-4 py-3 bg-white hover:bg-yellow-50 transition-colors">
                  <div class="flex-1 min-w-0">
                    <span class="font-mono text-sm font-semibold text-gray-800">{{ group.rawName }}</span>
                    @if (group.brandHint) {
                      <span class="ml-2 text-xs text-gray-400">({{ group.brandHint }})</span>
                    }
                  </div>
                  <span class="text-xs text-gray-400 whitespace-nowrap">{{ group.count }} row{{ group.count !== 1 ? 's' : '' }}</span>
                  <button
                    (click)="openMappingDialog(group)"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition-colors"
                    style="background:#006874">
                    Map →
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Records table -->
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-lg font-medium">Records</h2>
          <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" [ngModel]="issuesOnly()" (ngModelChange)="onIssuesOnlyChange($event)" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            Show unresolved or problem records only
          </label>
        </div>
        @if (records().length === 0) {
          <p class="text-gray-500">No records.</p>
        } @else {
          <div class="overflow-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-gray-50 text-left text-gray-600">
                  <th class="px-3 py-2 border-b font-medium">#</th>
                  <th class="px-3 py-2 border-b font-medium">Raw Data</th>
                  <th class="px-3 py-2 border-b font-medium">Vehicle Model</th>
                  <th class="px-3 py-2 border-b font-medium">Plan Type</th>
                  <th class="px-3 py-2 border-b font-medium">Mapping</th>
                  <th class="px-3 py-2 border-b font-medium">Review</th>
                  @if (batch()!.status === 'PendingReview') {
                    <th class="px-3 py-2 border-b font-medium">Actions</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (record of records(); track record.id) {
                  <tr class="hover:bg-gray-50 border-b">
                    <td class="px-3 py-2 text-gray-400">{{ record.rowNumber }}</td>
                    <td class="px-3 py-2 max-w-xs">
                      <details class="cursor-pointer">
                        <summary class="text-xs text-blue-600">View</summary>
                        <pre class="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-32">{{ formatRawData(record.rawData) }}</pre>
                      </details>
                    </td>
                    <td class="px-3 py-2">
                      @if (record.resolvedVehicleModel) {
                        <span class="text-green-700">{{ record.resolvedVehicleModel }}</span>
                      } @else {
                        <span class="text-yellow-600 italic">Unresolved</span>
                      }
                    </td>
                    <td class="px-3 py-2">
                      @if (record.resolvedPlanType) {
                        <span class="text-green-700">{{ record.resolvedPlanType }}</span>
                      } @else {
                        <span class="text-yellow-600 italic">Unresolved</span>
                      }
                    </td>
                    <td class="px-3 py-2">
                      <span [class]="mappingStatusClass(record.mappingStatus)" class="px-2 py-0.5 rounded text-xs">
                        {{ record.mappingStatus }}
                      </span>
                    </td>
                    <td class="px-3 py-2">
                      <span [class]="reviewStatusClass(record.reviewStatus)" class="px-2 py-0.5 rounded text-xs">
                        {{ record.reviewStatus }}
                      </span>
                      @if (record.rejectionReason) {
                        <div class="text-xs text-red-500 mt-0.5">{{ record.rejectionReason }}</div>
                      }
                    </td>
                    @if (batch()!.status === 'PendingReview') {
                      <td class="px-3 py-2">
                        @if (record.reviewStatus === 'Pending') {
                          <div class="flex gap-1">
                            <button
                              (click)="approveRecord(record)"
                              [disabled]="record.mappingStatus === 'PendingMapping' || actioning().has(record.id)"
                              [title]="record.mappingStatus === 'PendingMapping' ? 'Resolve mapping first' : 'Approve'"
                              class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed">
                              Approve
                            </button>
                            <button
                              (click)="openRejectDialog(record)"
                              [disabled]="actioning().has(record.id)"
                              class="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40">
                              Reject
                            </button>
                          </div>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="flex justify-between items-center mt-4 text-sm text-gray-600">
            <span>{{ recordPaginationLabel() }}</span>
            <div class="flex gap-2">
              <button (click)="prevRecordPage()" [disabled]="recordPage() <= 1" class="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
              <button (click)="nextRecordPage()" [disabled]="recordPage() * recordPageSize() >= recordsTotalCount()" class="px-3 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        }
      } @else {
        <p class="text-red-600">Batch not found.</p>
      }
    </div>

    <!-- ── Vehicle Model Mapping dialog ──────────────────────────────────── -->
    @if (mappingDialog()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

          <!-- Header -->
          <div class="px-6 py-4 border-b flex items-start justify-between gap-4">
            <div>
              <h3 class="font-bold text-base text-gray-900">Map Vehicle Model</h3>
              <p class="text-xs text-gray-500 mt-0.5">
                Raw name: <span class="font-mono font-semibold text-gray-700">{{ mappingDialog()!.rawName }}</span>
                @if (mappingDialog()!.brandHint) {
                  <span class="ml-1 text-gray-400">({{ mappingDialog()!.brandHint }})</span>
                }
              </p>
            </div>
            <button (click)="closeMappingDialog()" class="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5">✕</button>
          </div>

          <div class="px-6 py-4 overflow-y-auto flex-1 flex flex-col gap-5">

            <!-- Tab: search existing vs create new -->
            <div class="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button (click)="mappingTab.set('search')"
                [class]="mappingTab() === 'search'
                  ? 'flex-1 py-1.5 rounded-md text-sm font-semibold bg-white shadow text-gray-900'
                  : 'flex-1 py-1.5 rounded-md text-sm font-medium text-gray-500'">
                Search existing
              </button>
              <button (click)="mappingTab.set('create')"
                [class]="mappingTab() === 'create'
                  ? 'flex-1 py-1.5 rounded-md text-sm font-semibold bg-white shadow text-gray-900'
                  : 'flex-1 py-1.5 rounded-md text-sm font-medium text-gray-500'">
                Create new
              </button>
            </div>

            @if (mappingTab() === 'search') {
              <!-- Search existing vehicle models -->
              <div>
                <input
                  [(ngModel)]="modelSearch"
                  (ngModelChange)="filterModels()"
                  type="text"
                  placeholder="Type to filter models…"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006874]" />
              </div>
              <div class="border border-gray-100 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                @if (filteredModels().length === 0) {
                  <p class="text-sm text-gray-400 text-center py-6">No models found.</p>
                }
                @for (m of filteredModels(); track m.id) {
                  <button
                    (click)="selectExistingModel(m)"
                    [class]="selectedModelId() === m.id
                      ? 'w-full text-left px-4 py-2.5 flex items-center gap-3 bg-[#e6f4f1] border-l-4 border-[#006874]'
                      : 'w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 border-l-4 border-transparent'"
                    class="border-b border-gray-50 transition-colors">
                    <div class="flex-1 min-w-0">
                      <span class="text-xs text-gray-400">{{ m.makeName }}</span>
                      <div class="text-sm font-medium text-gray-800">
                        {{ m.name }}{{ m.subModel ? ' ' + m.subModel : '' }}
                      </div>
                    </div>
                    @if (selectedModelId() === m.id) {
                      <span class="text-[#006874] text-base">✓</span>
                    }
                  </button>
                }
              </div>
            }

            @if (mappingTab() === 'create') {
              <!-- Create new vehicle model -->
              <div class="flex flex-col gap-3">
                <!-- Make: pick existing or type new -->
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Make (Brand)</label>
                  <div class="flex gap-2">
                    <select [(ngModel)]="newMakeId" (ngModelChange)="onNewMakeSelect($event)"
                      class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006874]">
                      <option value="">-- Select existing --</option>
                      @for (mk of allMakes(); track mk.id) {
                        <option [value]="mk.id">{{ mk.name }}</option>
                      }
                    </select>
                    <span class="text-gray-400 text-sm self-center">or</span>
                    <input [(ngModel)]="newMakeName" (ngModelChange)="newMakeId = ''"
                      type="text" placeholder="New make name"
                      class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006874]" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Model Name</label>
                  <input [(ngModel)]="newModelName" type="text" placeholder="e.g. D9"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006874]" />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Sub-model / Variant
                    <span class="normal-case font-normal text-gray-400">(optional)</span>
                  </label>
                  <input [(ngModel)]="newSubModel" type="text" placeholder="e.g. 1.5 Turbo RS (CVT)"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006874]" />
                  <p class="text-xs text-gray-400 mt-1">
                    Leave blank to create an umbrella model that matches all variants.
                  </p>
                </div>
              </div>
            }

            @if (mappingError()) {
              <p class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ mappingError() }}</p>
            }

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t flex justify-end gap-3">
            <button (click)="closeMappingDialog()"
              class="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button (click)="saveMapping()" [disabled]="mappingSaving()"
              class="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition-colors"
              style="background:#006874">
              {{ mappingSaving() ? 'Saving…' : 'Save Mapping' }}
            </button>
          </div>

        </div>
      </div>
    }

    <!-- Reject dialog -->
    @if (rejectingRecord()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-4">Reject Record #{{ rejectingRecord()!.rowNumber }}</h3>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
          <textarea
            [(ngModel)]="rejectReason"
            rows="3"
            class="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="Enter rejection reason..."></textarea>
          <div class="flex gap-3 mt-4 justify-end">
            <button (click)="cancelReject()" class="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button (click)="confirmReject()" class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">Confirm Reject</button>
          </div>
        </div>
      </div>
    }
  `
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
      if (r.mappingStatus !== 'PendingMapping' || r.resolvedVehicleModel) continue;
      try {
        const raw = JSON.parse(r.rawData);
        const rawName: string = raw['vehicle_model'] ?? '';
        if (!rawName) continue;
        if (!map.has(rawName)) {
          const brandHint: string | undefined = raw['coverage_details']?.['brand_name'];
          map.set(rawName, { rawName, count: 0, brandHint });
        }
        map.get(rawName)!.count++;
      } catch { /* skip malformed rows */ }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
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
    return (b.resolvedRows - b.approvedRows - b.rejectedRows) > 0;
  }

  ngOnInit(): void {
    this.batchId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [detail, unresolved] = await Promise.all([
        this.importApi.getBatchDetail(
          this.batchId, this.recordPage(), this.recordPageSize(), this.issuesOnly()),
        this.importApi.getRecords(this.batchId, 1, 2000, true)
      ]);
      this.batch.set(detail);
      this.records.set(detail.records);
      this.recordsTotalCount.set(detail.recordsTotalCount);
      this.allUnresolvedRecords.set(unresolved.items);
    } finally {
      this.loading.set(false);
    }
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

  // ── Mapping dialog ────────────────────────────────────────────────────────

  async openMappingDialog(group: UnresolvedGroup): Promise<void> {
    this.mappingDialog.set(group);
    this.mappingTab.set('search');
    this.mappingError.set(null);
    this.selectedModelId.set(null);
    this.newMakeId = '';
    this.newMakeName = group.brandHint ?? '';

    // Auto-split composite raw names like "A4 3.0 4 Doors" into
    // model root ("A4") + sub-model ("3.0 4 Doors") for easier canonical record creation.
    const { modelRoot, subModel } = splitModelName(group.rawName);
    this.newModelName = modelRoot;
    this.newSubModel = subModel;

    // Pre-fill search with the root token so existing models are easier to find
    this.modelSearch = modelRoot;

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
          this.newSubModel.trim() || undefined
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
    const count = this.batch()?.pendingRows ?? 0;
    if (!confirm(`Reject all ${count} unresolved records? They will be skipped during publish. This cannot be undone.`)) return;
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

  statusClass(status: string): string {
    const map: Record<string, string> = {
      Processing: 'bg-blue-100 text-blue-700',
      PendingReview: 'bg-yellow-100 text-yellow-700',
      Published: 'bg-green-100 text-green-700',
      Rejected: 'bg-red-100 text-red-700',
      Failed: 'bg-gray-100 text-gray-700'
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  mappingStatusClass(status: string): string {
    return status === 'Resolved'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700';
  }

  reviewStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'bg-gray-100 text-gray-600',
      Approved: 'bg-green-100 text-green-700',
      Rejected: 'bg-red-100 text-red-700'
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }
}
