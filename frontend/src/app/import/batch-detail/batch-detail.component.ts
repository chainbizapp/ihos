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
  styles: [`
    .record-row:hover { background: #f8f9ff; }
  `],
  template: `
<div class="min-h-screen px-6 py-8" style="background:#f0f4fd">

  <!-- Back -->
  <div class="mb-6">
    <a routerLink="/import/batches"
       class="inline-flex items-center gap-2 text-[13px] font-bold transition-colors"
       style="color:#435d98">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
        <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>
      </svg>
      กลับรายการ Batch
    </a>
  </div>

  @if (loading()) {
    <div class="rounded-3xl overflow-hidden animate-pulse"
         style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">
      <div class="px-8 py-6" style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <div class="h-5 rounded-lg w-72 mb-3" style="background:#f0f4fd"></div>
        <div class="h-3.5 rounded-lg w-48" style="background:#f8f9ff"></div>
      </div>
      <div class="grid grid-cols-5">
        @for (s of [1,2,3,4,5]; track s) {
          <div class="py-6 flex flex-col items-center gap-2" style="border-right:1px solid rgba(17,48,105,0.07)">
            <div class="h-8 w-14 rounded-lg" style="background:#f0f4fd"></div>
            <div class="h-3 w-10 rounded" style="background:#f8f9ff"></div>
          </div>
        }
      </div>
    </div>
  } @else if (batch()) {

    <!-- ── Batch header card ─────────────────────────────────────────────── -->
    <div class="rounded-3xl overflow-hidden mb-6"
         style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">

      <div class="px-8 py-6 flex flex-wrap items-start justify-between gap-4"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <div class="min-w-0">
          <div class="flex items-center gap-3 flex-wrap mb-1">
            <h1 class="text-[18px] font-black"
                style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
              {{ batch()!.sourceFileName }}
            </h1>
            <span class="px-3 py-1 rounded-full text-[11px] font-bold"
                  [style]="statusStyle(batch()!.status)">
              {{ batch()!.status }}
            </span>
          </div>
          <p class="text-[13px]" style="color:#8b95a6">
            {{ batch()!.companyName }} · {{ batch()!.uploadedAt | date:'dd/MM/yyyy HH:mm' }}
          </p>
        </div>

        @if (batch()!.status === 'PendingReview') {
          <div class="flex flex-wrap gap-2">
            <button (click)="reResolve()" [disabled]="reResolving()"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-40"
                    style="background:#f0f4fd;color:#435d98">
              {{ reResolving() ? 'Re-resolving…' : 'Re-resolve Mappings' }}
            </button>
            @if ((batch()!.pendingRows + batch()!.resolvedRows) > 0) {
              <button (click)="rejectAllUnresolved()" [disabled]="rejectingAll()"
                      class="px-4 py-2 rounded-2xl text-[12px] font-bold text-white transition-all disabled:opacity-40"
                      style="background:linear-gradient(135deg,#e65100,#f7941d)">
                {{ rejectingAll() ? 'Rejecting…' : 'Reject Remaining (' + (batch()!.pendingRows + batch()!.resolvedRows) + ')' }}
              </button>
            }
            <button (click)="approveAllResolved()" [disabled]="!canApproveAll()"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold text-white transition-all disabled:opacity-40"
                    style="background:linear-gradient(135deg,#435d98,#6b84c8)">
              {{ approvingAll() ? 'Approving…' : 'Approve All Resolved' }}
            </button>
            <button (click)="publishBatch()"
                    [disabled]="publishing() || batch()!.pendingRows > 0 || batch()!.resolvedRows > 0"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold text-white transition-all disabled:opacity-40"
                    style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 8px rgba(0,104,116,0.25)">
              {{ publishing() ? 'Publishing…' : 'Publish Batch' }}
            </button>
          </div>
        }
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-5">
        <div class="flex flex-col items-center py-5 text-center" style="border-right:1px solid rgba(17,48,105,0.07)">
          <div class="text-[28px] font-black" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">{{ batch()!.totalRows }}</div>
          <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">ทั้งหมด</div>
        </div>
        <div class="flex flex-col items-center py-5 text-center" style="border-right:1px solid rgba(17,48,105,0.07)">
          <div class="text-[28px] font-black" style="color:#006874;font-family:'Plus Jakarta Sans',sans-serif">{{ batch()!.resolvedRows }}</div>
          <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">Resolved</div>
        </div>
        <div class="flex flex-col items-center py-5 text-center" style="border-right:1px solid rgba(17,48,105,0.07)">
          <div class="text-[28px] font-black" style="color:#e65100;font-family:'Plus Jakarta Sans',sans-serif">{{ batch()!.pendingRows }}</div>
          <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">Pending</div>
        </div>
        <div class="flex flex-col items-center py-5 text-center" style="border-right:1px solid rgba(17,48,105,0.07)">
          <div class="text-[28px] font-black" style="color:#435d98;font-family:'Plus Jakarta Sans',sans-serif">{{ batch()!.approvedRows }}</div>
          <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">Approved</div>
        </div>
        <div class="flex flex-col items-center py-5 text-center">
          <div class="text-[28px] font-black" style="color:#c0392b;font-family:'Plus Jakarta Sans',sans-serif">{{ batch()!.rejectedRows }}</div>
          <div class="text-[11px] font-bold uppercase tracking-widest mt-1" style="color:#8b95a6">Rejected</div>
        </div>
      </div>
    </div>

    <!-- ── Alerts ────────────────────────────────────────────────────────── -->
    @if (actionError()) {
      <div class="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-4 text-[13px] font-semibold"
           style="background:#fff0f0;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
        <span class="flex-1">{{ actionError() }}</span>
        <button (click)="actionError.set(null)" class="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
      </div>
    }
    @if (actionSuccess()) {
      <div class="flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-4 text-[13px] font-semibold"
           style="background:#e6f4f5;color:#006874;border:1px solid rgba(0,104,116,0.15)">
        <span class="flex-1">{{ actionSuccess() }}</span>
        <button (click)="actionSuccess.set(null)" class="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
      </div>
    }

    <!-- ── Duplicate records panel ───────────────────────────────────────── -->
    @if (!duplicateReport() && !loadingDuplicates()) {
      <div class="flex justify-end mb-4">
        <button (click)="loadDuplicates()"
                class="text-[12px] font-bold transition-colors"
                style="color:#8b95a6">
          วิเคราะห์ระเบียนซ้ำ →
        </button>
      </div>
    }
    @if (loadingDuplicates()) {
      <div class="mb-4 text-[12px]" style="color:#8b95a6">กำลังวิเคราะห์…</div>
    }
    @if (duplicateReport()) {
      <div class="rounded-3xl overflow-hidden mb-6"
           style="border:1px solid rgba(230,81,0,0.18);box-shadow:0 4px 16px rgba(230,81,0,0.06)">
        <div class="px-6 py-4 flex items-center justify-between gap-3"
             style="background:#fff8f4;border-bottom:1px solid rgba(230,81,0,0.1)">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style="background:rgba(230,81,0,0.12);color:#e65100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
                <path d="M236.8,188.09,149.35,36.22a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"/>
              </svg>
            </div>
            <div>
              <span class="text-[13px] font-bold" style="color:#e65100">Duplicate Records</span>
              <span class="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style="background:rgba(230,81,0,0.12);color:#e65100">
                {{ duplicateReport()!.totalDuplicateRecords }} skipped
              </span>
              <p class="text-[12px] mt-0.5" style="color:#8b95a6">ระเบียนที่มี key ซ้ำ — เก็บแถวแรกเท่านั้น</p>
            </div>
          </div>
          <button (click)="duplicateReport.set(null)" class="opacity-50 hover:opacity-100 text-lg">✕</button>
        </div>
        <div class="overflow-auto" style="background:#fff">
          <table class="w-full border-collapse">
            <thead>
              <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">ซ้ำ</th>
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">แถว #</th>
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">ซ่อมแซม</th>
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">อายุรถ</th>
                <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">ทุนประกัน</th>
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">Rate Code</th>
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">Vehicle Codes</th>
                <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">แถวซ้ำ</th>
              </tr>
            </thead>
            <tbody>
              @for (g of duplicateReport()!.groups; track $index) {
                <tr style="border-bottom:1px solid rgba(17,48,105,0.05)">
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style="background:rgba(230,81,0,0.1);color:#e65100">×{{ g.count }}</span>
                  </td>
                  <td class="px-4 py-3 font-mono text-[12px]" style="color:#5a6270">#{{ g.firstRowNumber }}</td>
                  <td class="px-4 py-3 text-[12px]" style="color:#5a6270">{{ g.repairType }}</td>
                  <td class="px-4 py-3 text-[12px]" style="color:#5a6270">{{ g.registrationYear }}</td>
                  <td class="px-4 py-3 text-right font-mono text-[12px] font-semibold" style="color:#171c22">{{ g.sumInsured | number }}</td>
                  <td class="px-4 py-3 font-mono text-[11px]" style="color:#8b95a6">{{ g.externalPackageId || '—' }}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      @for (v of g.vehicleModels; track v) {
                        <span class="font-mono text-[10px] px-1.5 py-0.5 rounded"
                              style="background:#f0f4fd;color:#435d98">{{ v }}</span>
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 font-mono text-[11px]" style="color:#8b95a6">
                    {{ g.duplicateRows.slice(0,5).join(', ') }}{{ g.duplicateRows.length > 5 ? '…' : '' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (duplicateReport()!.groups.length === 30) {
          <div class="px-6 py-3 text-[12px]"
               style="background:#fff8f4;color:#e65100;border-top:1px solid rgba(230,81,0,0.1)">
            แสดง 30 กลุ่มแรก — แก้ไขแล้ว Re-import เพื่อล้างทั้งหมด
          </div>
        }
      </div>
    }

    <!-- ── Unresolved vehicle models panel ──────────────────────────────── -->
    @if (unresolvedGroups().length > 0 && batch()!.status === 'PendingReview') {
      <div class="rounded-3xl overflow-hidden mb-6"
           style="border:1px solid rgba(230,119,0,0.18);box-shadow:0 4px 16px rgba(230,119,0,0.06)">
        <div class="px-6 py-4 flex items-center justify-between gap-3"
             style="background:#fffaf0;border-bottom:1px solid rgba(230,119,0,0.1)">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style="background:rgba(230,119,0,0.12);color:#e67700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
                <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"/>
              </svg>
            </div>
            <div>
              <span class="text-[13px] font-bold" style="color:#e67700">Unresolved Vehicle Models</span>
              <span class="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style="background:rgba(230,119,0,0.12);color:#e67700">
                {{ unresolvedGroups().length }}
              </span>
              <p class="text-[12px] mt-0.5" style="color:#8b95a6">Map each name to a canonical vehicle model</p>
            </div>
          </div>
          <button (click)="autoMapAll()" [disabled]="autoMappingAll()"
                  class="px-4 py-2 rounded-2xl text-[12px] font-bold text-white transition-all disabled:opacity-40"
                  style="background:linear-gradient(135deg,#e67700,#f7941d)">
            {{ autoMappingAll() ? 'Auto Mapping…' : 'Auto Map All' }}
          </button>
        </div>
        @for (group of unresolvedGroups(); track group.rawName) {
          @let preview = unresolvedGroupPreviews().get(group.rawName);
          <div class="flex items-center gap-3 px-6 py-4 transition-colors"
               style="border-bottom:1px solid rgba(17,48,105,0.05);background:#fff">

            <!-- Source raw name -->
            <div class="min-w-0" style="flex:0 0 auto;max-width:200px">
              <div class="font-mono text-[13px] font-bold truncate" style="color:#171c22">{{ group.rawName }}</div>
              @if (group.brandHint) {
                <div class="text-[11px] mt-0.5" style="color:#8b95a6">{{ group.brandHint }}</div>
              }
            </div>

            <!-- Arrow + preview -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#8b95a6" class="w-4 h-4 flex-shrink-0">
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>
              </svg>
              @if (preview) {
                @if (preview.method === 'map') {
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                        style="background:#e6f4f5;color:#006874">Map</span>
                  <div class="min-w-0">
                    <div class="text-[11px]" style="color:#8b95a6">{{ preview.brand }}</div>
                    <div class="text-[13px] font-semibold truncate" style="color:#006874">{{ preview.model }}</div>
                  </div>
                } @else if (preview.method === 'create') {
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                        style="background:#e8eef8;color:#435d98">Create</span>
                  <div class="min-w-0">
                    <div class="text-[11px]" style="color:#8b95a6">{{ preview.brand }}</div>
                    <div class="text-[13px] font-semibold truncate" style="color:#435d98">{{ preview.model }}</div>
                  </div>
                } @else {
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                        style="background:#f0f4fd;color:#8b95a6">Manual</span>
                  <span class="text-[12px]" style="color:#8b95a6">ไม่มีข้อมูล brand</span>
                }
              }
            </div>

            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0"
                  style="background:#f0f4fd;color:#435d98">
              {{ group.count }} แถว
            </span>
            <button (click)="openMappingDialog(group)"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold text-white flex-shrink-0 transition-all hover:opacity-90"
                    style="background:linear-gradient(135deg,#006874,#49b2c1)">
              Map →
            </button>
          </div>
        }
      </div>
    }

    <!-- ── Records table card ────────────────────────────────────────────── -->
    <div class="rounded-3xl overflow-hidden"
         style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">

      <!-- Toolbar -->
      <div class="flex items-center justify-between px-6 py-4"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <h2 class="text-[15px] font-black"
            style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">Records</h2>
        <label class="flex items-center gap-2 cursor-pointer" (click)="onIssuesOnlyChange(!issuesOnly())">
          <div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
               [style]="issuesOnly()
                 ? 'background:linear-gradient(135deg,#006874,#49b2c1);border-color:#006874'
                 : 'border-color:rgba(17,48,105,0.25)'">
            @if (issuesOnly()) {
              <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            }
          </div>
          <span class="text-[12px] font-semibold" style="color:#5a6270">แสดงเฉพาะระเบียนที่มีปัญหา</span>
        </label>
      </div>

      @if (records().length === 0) {
        <div class="flex flex-col items-center justify-center py-16">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
               style="background:#f0f4fd;color:#435d98">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-6 h-6">
              <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"/>
            </svg>
          </div>
          <p class="text-[13px] font-semibold" style="color:#8b95a6">ไม่มีระเบียน</p>
        </div>
      } @else {
        <div class="overflow-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">#</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Raw Data</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Vehicle Model</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Plan Type</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Mapping</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">Review</th>
                @if (batch()!.status === 'PendingReview') {
                  <th class="px-4 py-4"></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (record of records(); track record.id) {
                <tr class="record-row" style="border-bottom:1px solid rgba(17,48,105,0.05)">
                  <td class="px-4 py-4 font-mono text-[12px]" style="color:#8b95a6">{{ record.rowNumber }}</td>
                  <td class="px-4 py-4 max-w-[160px]">
                    <details class="cursor-pointer">
                      <summary class="text-[12px] font-bold" style="color:#006874">ดูข้อมูล</summary>
                      <pre class="text-[10px] p-2 rounded-xl mt-1.5 overflow-auto max-h-32"
                           style="background:#f8f9ff;color:#5a6270">{{ formatRawData(record.rawData) }}</pre>
                    </details>
                  </td>
                  <td class="px-4 py-4">
                    @if (record.resolvedVehicleModel) {
                      <div>
                        @if (record.resolvedVehicleMake) {
                          <div class="text-[11px]" style="color:#8b95a6">{{ record.resolvedVehicleMake }}</div>
                        }
                        <div class="text-[13px] font-semibold" style="color:#006874">{{ record.resolvedVehicleModel }}</div>
                      </div>
                    } @else {
                      <span class="text-[12px] font-medium" style="color:#e67700">ยังไม่ได้ map</span>
                    }
                  </td>
                  <td class="px-4 py-4">
                    @if (record.resolvedPlanType) {
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style="background:#e6f4f5;color:#006874">{{ record.resolvedPlanType }}</span>
                    } @else {
                      <span class="text-[12px] font-medium" style="color:#e67700">ยังไม่ได้ map</span>
                    }
                  </td>
                  <td class="px-4 py-4">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                          [style]="mappingStatusStyle(record.mappingStatus)">
                      {{ record.mappingStatus }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                          [style]="reviewStatusStyle(record.reviewStatus)">
                      {{ record.reviewStatus }}
                    </span>
                    @if (record.rejectionReason) {
                      <div class="text-[11px] mt-0.5" style="color:#c0392b">{{ record.rejectionReason }}</div>
                    }
                  </td>
                  @if (batch()!.status === 'PendingReview') {
                    <td class="px-4 py-4">
                      @if (record.reviewStatus === 'Pending') {
                        <div class="flex gap-1.5">
                          <button (click)="approveRecord(record)"
                                  [disabled]="record.mappingStatus === 'PendingMapping' || actioning().has(record.id)"
                                  class="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-30"
                                  style="background:#e6f4f5;color:#006874">
                            Approve
                          </button>
                          <button (click)="openRejectDialog(record)"
                                  [disabled]="actioning().has(record.id)"
                                  class="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-30"
                                  style="background:#fff0f0;color:#c0392b">
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
        <div class="flex items-center justify-between px-6 py-4"
             style="background:#f8f9ff;border-top:1px solid rgba(17,48,105,0.07)">
          <span class="text-[12px] font-medium" style="color:#8b95a6">{{ recordPaginationLabel() }}</span>
          <div class="flex gap-2">
            <button (click)="prevRecordPage()" [disabled]="recordPage() <= 1"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                    style="background:#f0f4fd;color:#006874">
              ← ก่อนหน้า
            </button>
            <button (click)="nextRecordPage()"
                    [disabled]="recordPage() * recordPageSize() >= recordsTotalCount()"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                    style="background:#f0f4fd;color:#006874">
              ถัดไป →
            </button>
          </div>
        </div>
      }
    </div>

  } @else {
    <div class="flex flex-col items-center justify-center py-24">
      <p class="text-[15px] font-semibold" style="color:#c0392b">ไม่พบ Batch</p>
    </div>
  }
</div>

<!-- ── Vehicle Model Mapping dialog ──────────────────────────────────────── -->
@if (mappingDialog()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
       style="background:rgba(17,28,34,0.45);backdrop-filter:blur(4px)"
       (click)="closeMappingDialog()">
    <div class="relative w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
         style="background:#fff;box-shadow:0 24px 64px rgba(17,48,105,0.18);max-height:90vh"
         (click)="$event.stopPropagation()">

      <div class="flex items-start justify-between gap-4 px-6 py-5"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <div>
          <h3 class="text-[16px] font-black"
              style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">Map Vehicle Model</h3>
          <p class="text-[12px] mt-1" style="color:#8b95a6">
            Raw name: <span class="font-mono font-bold" style="color:#171c22">{{ mappingDialog()!.rawName }}</span>
            @if (mappingDialog()!.brandHint) {
              <span class="ml-1">({{ mappingDialog()!.brandHint }})</span>
            }
          </p>
        </div>
        <button (click)="closeMappingDialog()"
                class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style="background:#f0f4fd;color:#435d98">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 overflow-y-auto flex-1 flex flex-col gap-5">
        <!-- Tabs -->
        <div class="flex gap-1 p-1 rounded-2xl" style="background:#f0f4fd">
          <button (click)="mappingTab.set('search')"
                  class="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                  [style]="mappingTab() === 'search'
                    ? 'background:#fff;color:#171c22;box-shadow:0 2px 8px rgba(17,48,105,0.08)'
                    : 'color:#8b95a6;background:transparent'">
            ค้นหา existing
          </button>
          <button (click)="mappingTab.set('create')"
                  class="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                  [style]="mappingTab() === 'create'
                    ? 'background:#fff;color:#171c22;box-shadow:0 2px 8px rgba(17,48,105,0.08)'
                    : 'color:#8b95a6;background:transparent'">
            สร้างใหม่
          </button>
        </div>

        @if (mappingTab() === 'search') {
          <input [(ngModel)]="modelSearch" (ngModelChange)="filterModels()"
                 type="text" placeholder="พิมพ์เพื่อกรองรุ่นรถ…"
                 class="w-full px-4 py-3 rounded-2xl text-[13px] font-medium focus:outline-none"
                 style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
          <div class="rounded-2xl overflow-y-auto"
               style="border:1px solid rgba(17,48,105,0.08);max-height:256px">
            @if (filteredModels().length === 0) {
              <div class="flex items-center justify-center py-10 text-[13px]" style="color:#8b95a6">
                ไม่พบรุ่นรถ
              </div>
            }
            @for (m of filteredModels(); track m.id) {
              <button (click)="selectExistingModel(m)"
                      class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                      style="border-bottom:1px solid rgba(17,48,105,0.05)"
                      [style.background]="selectedModelId() === m.id ? '#e6f4f5' : 'transparent'">
                <div class="flex-1 min-w-0">
                  <div class="text-[10px] font-bold uppercase tracking-wider" style="color:#8b95a6">{{ m.makeName }}</div>
                  <div class="text-[13px] font-semibold" style="color:#171c22">
                    {{ m.name }}{{ m.subModel ? ' ' + m.subModel : '' }}
                  </div>
                </div>
                @if (selectedModelId() === m.id) {
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
        }

        @if (mappingTab() === 'create') {
          <div class="flex flex-col gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">Make (Brand)</label>
              <div class="flex gap-2">
                <select [(ngModel)]="newMakeId" (ngModelChange)="onNewMakeSelect($event)"
                        class="flex-1 px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                        style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22">
                  <option value="">-- Select existing --</option>
                  @for (mk of allMakes(); track mk.id) {
                    <option [value]="mk.id">{{ mk.name }}</option>
                  }
                </select>
                <span class="text-[12px] self-center flex-shrink-0" style="color:#8b95a6">หรือ</span>
                <input [(ngModel)]="newMakeName" (ngModelChange)="newMakeId = ''"
                       type="text" placeholder="New make name"
                       class="flex-1 px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                       style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">Model Name</label>
              <input [(ngModel)]="newModelName" type="text" placeholder="e.g. D9"
                     class="w-full px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                     style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">
                Sub-model / Variant
                <span class="normal-case font-normal ml-1" style="color:#8b95a6">(optional)</span>
              </label>
              <input [(ngModel)]="newSubModel" type="text" placeholder="e.g. PRO, 4 Doors"
                     class="w-full px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                     style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
              <p class="text-[11px] mt-1.5" style="color:#8b95a6">เว้นว่างเพื่อสร้างรุ่นหลักที่ match ทุก variant</p>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">
                Engine CC
                <span class="normal-case font-normal ml-1" style="color:#8b95a6">(optional)</span>
              </label>
              <input [(ngModel)]="newEngineCC" type="text" placeholder="e.g. 2.2, 1.5, 3.0"
                     class="w-full px-3 py-2.5 rounded-2xl text-[13px] focus:outline-none"
                     style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22" />
              <p class="text-[11px] mt-1.5" style="color:#8b95a6">แยกรุ่นเครื่องยนต์ที่มีราคาต่างกัน</p>
            </div>
          </div>
        }

        @if (mappingError()) {
          <div class="px-4 py-3 rounded-2xl text-[12px] font-semibold"
               style="background:#fff0f0;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
            {{ mappingError() }}
          </div>
        }
      </div>

      <div class="flex gap-3 px-6 py-5" style="border-top:1px solid rgba(17,48,105,0.07)">
        <button (click)="closeMappingDialog()"
                class="flex-1 py-2.5 rounded-2xl text-[13px] font-bold"
                style="background:#f0f4fd;color:#435d98">ยกเลิก</button>
        <button (click)="saveMapping()" [disabled]="mappingSaving()"
                class="flex-1 py-2.5 rounded-2xl text-[13px] font-bold text-white disabled:opacity-40 hover:opacity-90"
                style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 10px rgba(0,104,116,0.3)">
          {{ mappingSaving() ? 'กำลังบันทึก…' : 'Save Mapping' }}
        </button>
      </div>
    </div>
  </div>
}

<!-- ── Reject record dialog ───────────────────────────────────────────────── -->
@if (rejectingRecord()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
       style="background:rgba(17,28,34,0.45);backdrop-filter:blur(4px)"
       (click)="cancelReject()">
    <div class="w-full max-w-md rounded-3xl overflow-hidden"
         style="background:#fff;box-shadow:0 24px 64px rgba(17,48,105,0.18)"
         (click)="$event.stopPropagation()">
      <div class="px-6 py-5" style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <h3 class="text-[16px] font-black"
            style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
          ปฏิเสธ Record #{{ rejectingRecord()!.rowNumber }}
        </h3>
      </div>
      <div class="px-6 py-5">
        <label class="block text-[10px] font-bold uppercase tracking-widest mb-2" style="color:#8b95a6">
          เหตุผล (optional)
        </label>
        <textarea [(ngModel)]="rejectReason" rows="3"
                  placeholder="ระบุเหตุผลการปฏิเสธ…"
                  class="w-full px-4 py-3 rounded-2xl text-[13px] resize-none focus:outline-none"
                  style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1);color:#171c22"></textarea>
      </div>
      <div class="flex gap-3 px-6 py-5" style="border-top:1px solid rgba(17,48,105,0.07)">
        <button (click)="cancelReject()"
                class="flex-1 py-2.5 rounded-2xl text-[13px] font-bold"
                style="background:#f0f4fd;color:#435d98">ยกเลิก</button>
        <button (click)="confirmReject()"
                class="flex-1 py-2.5 rounded-2xl text-[13px] font-bold text-white"
                style="background:linear-gradient(135deg,#c0392b,#e74c3c)">
          ยืนยันการปฏิเสธ
        </button>
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
