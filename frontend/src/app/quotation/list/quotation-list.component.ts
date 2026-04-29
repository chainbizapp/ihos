import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { QuotationService, QuotationSummary } from '../quotation.service';

const PLAN_TYPE_LABELS: Record<string, string> = {
  Type1:    'ชั้น 1',
  Type2Plus:'ชั้น 2+',
  Type2:    'ชั้น 2',
  Type3Plus:'ชั้น 3+',
  Type3:    'ชั้น 3',
};

@Component({
  selector: 'app-quotation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .q-row:hover { background: #f8f9ff; }
  `],
  template: `
<div class="min-h-screen px-6 py-8" style="background:#f0f4fd">
  <div class="max-w-screen-xl mx-auto">

    <!-- ── Page header ───────────────────────────────────────────────────── -->
    <div class="mb-6">
      <p class="text-[11px] font-bold uppercase tracking-widest mb-1" style="color:#435d98">ประวัติ</p>
      <h1 class="text-[28px] font-black"
          style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">Quotations</h1>
    </div>

    <!-- ── Main card ─────────────────────────────────────────────────────── -->
    <div class="rounded-3xl overflow-hidden"
         style="background:#fff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <div class="flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1 max-w-sm"
             style="background:#f8f9ff;border:1.5px solid rgba(17,48,105,0.1)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"
               class="w-4 h-4 flex-shrink-0" style="color:#8b95a6">
            <path d="M229.66,218.34l-50.07-50.06a88.21,88.21,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>
          </svg>
          <input [(ngModel)]="searchQuery"
                 type="text"
                 placeholder="ค้นหาชื่อลูกค้า, ทะเบียน…"
                 class="flex-1 bg-transparent text-[13px] font-medium focus:outline-none"
                 style="color:#171c22" />
          @if (searchQuery) {
            <button (click)="searchQuery = ''"
                    class="w-4 h-4 flex-shrink-0 opacity-40 hover:opacity-80" style="color:#171c22">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
              </svg>
            </button>
          }
        </div>
        <span class="text-[12px] font-medium" style="color:#8b95a6">
          {{ filteredItems().length }} รายการ
          @if (totalCount() > pageSize) {
            <span class="ml-1">({{ totalCount() }} ทั้งหมด)</span>
          }
        </span>
      </div>

      <!-- Loading skeletons -->
      @if (loading()) {
        <table class="w-full border-collapse">
          <thead>
            <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
              <th class="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ลูกค้า / รถ</th>
              <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">บริษัทประกัน</th>
              <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ประเภท</th>
              <th class="text-right px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">เบี้ยประกัน</th>
              <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">วันที่ออก</th>
              <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ออกโดย</th>
              <th class="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody class="animate-pulse">
            @for (s of skeletons; track s) {
              <tr style="border-bottom:1px solid rgba(17,48,105,0.05)">
                <td class="px-5 py-4">
                  <div class="h-3.5 rounded-lg w-32 mb-2" style="background:#f0f4fd"></div>
                  <div class="h-2.5 rounded-lg w-24" style="background:#f8f9ff"></div>
                </td>
                <td class="px-4 py-4"><div class="h-3.5 rounded-lg w-36" style="background:#f0f4fd"></div></td>
                <td class="px-4 py-4"><div class="h-5 rounded-full w-14" style="background:#f0f4fd"></div></td>
                <td class="px-4 py-4 text-right"><div class="h-3.5 rounded-lg w-24 ml-auto" style="background:#f0f4fd"></div></td>
                <td class="px-4 py-4"><div class="h-3.5 rounded-lg w-28" style="background:#f0f4fd"></div></td>
                <td class="px-4 py-4"><div class="h-3.5 rounded-lg w-20" style="background:#f0f4fd"></div></td>
                <td class="px-5 py-4"><div class="h-8 rounded-2xl w-32 ml-auto" style="background:#f0f4fd"></div></td>
              </tr>
            }
          </tbody>
        </table>
      }

      <!-- Empty state -->
      @if (!loading() && filteredItems().length === 0) {
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style="background:#f0f4fd;color:#435d98">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-8 h-8">
              <path d="M72,120a8,8,0,0,1,8-8h96a8,8,0,0,1,0,16H80A8,8,0,0,1,72,120Zm8,40h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16ZM232,56V208a8,8,0,0,1-11.58,7.16L192,200.94l-28.42,14.22a8,8,0,0,1-7.16,0L128,200.94,99.58,215.16a8,8,0,0,1-7.16,0L64,200.94,35.58,215.16A8,8,0,0,1,24,208V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,205.06V56H40V205.06l20.42-10.22a8,8,0,0,1,7.16,0L96,209.06l28.42-14.22a8,8,0,0,1,7.16,0L160,209.06l28.42-14.22a8,8,0,0,1,7.16,0ZM80,96h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16Z"/>
            </svg>
          </div>
          <h3 class="text-[16px] font-bold mb-1" style="color:#171c22">
            {{ searchQuery ? 'ไม่พบผลการค้นหา' : 'ยังไม่มี Quotation' }}
          </h3>
          <p class="text-[13px]" style="color:#8b95a6">
            {{ searchQuery ? 'ลองใช้คำค้นหาอื่น' : 'Quotation ที่ออกจะแสดงที่นี่' }}
          </p>
        </div>
      }

      <!-- Table -->
      @if (!loading() && filteredItems().length > 0) {
        <div class="overflow-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
                <th class="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ลูกค้า / รถ</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">บริษัทประกัน</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ประเภท</th>
                <th class="text-right px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">เบี้ยประกัน / ปี</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">วันที่ออก</th>
                <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ออกโดย</th>
                <th class="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (q of filteredItems(); track q.id) {
                <tr class="q-row" style="border-bottom:1px solid rgba(17,48,105,0.05);transition:background 0.12s">

                  <!-- Customer / Vehicle -->
                  <td class="px-5 py-4">
                    <div class="text-[13px] font-bold" style="color:#171c22;font-family:'Noto Sans Thai',sans-serif">
                      {{ q.customerName }}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span class="text-[11px] font-semibold" style="color:#435d98">
                        {{ q.vehicleMake }} {{ q.vehicleModelName }}
                      </span>
                      <span class="text-[11px]" style="color:#8b95a6">ปี {{ q.vehicleYear }}</span>
                      @if (q.vehicleRegistration) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style="background:#f0f4fd;color:#435d98">{{ q.vehicleRegistration }}</span>
                      }
                    </div>
                  </td>

                  <!-- Company -->
                  <td class="px-4 py-4">
                    <span class="text-[13px] font-semibold"
                          style="color:#171c22;font-family:'Noto Sans Thai',sans-serif">
                      {{ q.companyName }}
                    </span>
                  </td>

                  <!-- Plan type -->
                  <td class="px-4 py-4">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style="background:#e6f4f5;color:#006874">
                      {{ planTypeLabel(q.planType) }}
                    </span>
                  </td>

                  <!-- Premium -->
                  <td class="px-4 py-4 text-right">
                    <span class="text-[16px] font-black"
                          style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
                      ฿{{ q.premiumAtGeneration | number:'1.0-0' }}
                    </span>
                  </td>

                  <!-- Generated at -->
                  <td class="px-4 py-4">
                    <div class="text-[12px] font-semibold" style="color:#171c22">
                      {{ q.generatedAt | date:'dd MMM yyyy' }}
                    </div>
                    <div class="text-[11px]" style="color:#8b95a6">
                      {{ q.generatedAt | date:'HH:mm' }}
                    </div>
                  </td>

                  <!-- Created by -->
                  <td class="px-4 py-4">
                    <span class="text-[12px] font-medium" style="color:#8b95a6">{{ q.createdBy }}</span>
                  </td>

                  <!-- Actions -->
                  <td class="px-5 py-4">
                    <div class="flex items-center gap-2 justify-end">
                      <!-- Preview -->
                      <button (click)="openPreview(q)"
                              [disabled]="previewQuotation()?.id === q.id && pdfLoading()"
                              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-40 hover:opacity-90"
                              style="background:#f0f4fd;color:#435d98">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-3.5 h-3.5">
                          <path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>
                        </svg>
                        Preview
                      </button>
                      <!-- Download -->
                      <button (click)="downloadPdf(q)"
                              [disabled]="downloadingId() === q.id"
                              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-40 hover:opacity-90"
                              style="background:linear-gradient(135deg,#006874,#49b2c1);color:#fff;box-shadow:0 2px 8px rgba(0,104,116,0.2)">
                        @if (downloadingId() === q.id) {
                          <span class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-3.5 h-3.5">
                            <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>
                          </svg>
                        }
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-6 py-4"
             style="background:#f8f9ff;border-top:1px solid rgba(17,48,105,0.07)">
          <span class="text-[12px] font-medium" style="color:#8b95a6">{{ paginationLabel() }}</span>
          <div class="flex gap-2">
            <button (click)="prevPage()" [disabled]="page() <= 1"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                    style="background:#f0f4fd;color:#006874">← ก่อนหน้า</button>
            <button (click)="nextPage()" [disabled]="page() * pageSize >= totalCount()"
                    class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                    style="background:#f0f4fd;color:#006874">ถัดไป →</button>
          </div>
        </div>
      }
    </div>
  </div>
</div>

<!-- ── PDF Preview dialog ─────────────────────────────────────────────────── -->
@if (previewQuotation()) {
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
       style="background:rgba(17,28,34,0.55);backdrop-filter:blur(6px)"
       (click)="closePreview()">

    <!-- Panel -->
    <div class="relative w-full flex flex-col rounded-3xl overflow-hidden"
         style="background:#fff;box-shadow:0 32px 80px rgba(17,48,105,0.22);max-width:860px;max-height:92vh"
         (click)="$event.stopPropagation()">

      <!-- Dialog header -->
      <div class="flex items-start justify-between gap-4 px-6 py-4 flex-shrink-0"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <div class="min-w-0">
          <h3 class="text-[15px] font-black truncate"
              style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
            {{ previewQuotation()!.customerName }}
          </h3>
          <div class="flex flex-wrap items-center gap-2 mt-1">
            <span class="text-[12px] font-semibold" style="color:#435d98">
              {{ previewQuotation()!.vehicleMake }} {{ previewQuotation()!.vehicleModelName }}
              · ปี {{ previewQuotation()!.vehicleYear }}
            </span>
            @if (previewQuotation()!.vehicleRegistration) {
              <span class="px-2 py-0.5 rounded text-[10px] font-bold"
                    style="background:#f0f4fd;color:#435d98">
                {{ previewQuotation()!.vehicleRegistration }}
              </span>
            }
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                  style="background:#e6f4f5;color:#006874">
              {{ planTypeLabel(previewQuotation()!.planType) }}
            </span>
            <span class="text-[12px] font-semibold" style="color:#8b95a6">
              {{ previewQuotation()!.companyName }}
            </span>
            <span class="text-[13px] font-black" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
              ฿{{ previewQuotation()!.premiumAtGeneration | number:'1.0-0' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Download inside dialog -->
          <button (click)="downloadPdf(previewQuotation()!)"
                  [disabled]="downloadingId() === previewQuotation()!.id"
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-40 hover:opacity-90 text-white"
                  style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 10px rgba(0,104,116,0.3)">
            @if (downloadingId() === previewQuotation()!.id) {
              <span class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              กำลังดาวน์โหลด…
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-3.5 h-3.5">
                <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>
              </svg>
              ดาวน์โหลด PDF
            }
          </button>
          <!-- Close -->
          <button (click)="closePreview()"
                  class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                  style="background:#f0f4fd;color:#435d98">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-4 h-4">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- PDF viewer body -->
      <div class="flex-1 relative overflow-hidden" style="min-height:0;background:#e8edf5">

        <!-- Loading -->
        @if (pdfLoading()) {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-4"
               style="background:#f0f4fd">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center"
                 style="background:#e6f4f5;color:#006874">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-6 h-6 animate-pulse">
                <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/>
              </svg>
            </div>
            <div>
              <p class="text-[13px] font-bold text-center" style="color:#171c22">กำลังโหลด PDF…</p>
              <p class="text-[12px] text-center mt-0.5" style="color:#8b95a6">อาจใช้เวลาสักครู่</p>
            </div>
          </div>
        }

        <!-- Error -->
        @if (pdfError() && !pdfLoading()) {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8"
               style="background:#f0f4fd">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center"
                 style="background:#fff0f0;color:#c0392b">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-6 h-6">
                <path d="M236.8,188.09,149.35,36.22a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"/>
              </svg>
            </div>
            <div>
              <p class="text-[14px] font-bold mb-1" style="color:#171c22">ไม่สามารถโหลด PDF ได้</p>
              <p class="text-[12px]" style="color:#8b95a6">{{ pdfError() }}</p>
            </div>
            <button (click)="retryPreview()"
                    class="px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white"
                    style="background:linear-gradient(135deg,#006874,#49b2c1)">
              ลองใหม่อีกครั้ง
            </button>
          </div>
        }

        <!-- iframe -->
        @if (pdfUrl() && !pdfLoading()) {
          <iframe [src]="pdfUrl()!"
                  style="width:100%;height:100%;border:0;display:block;min-height:68vh"
                  title="Quotation PDF Preview">
          </iframe>
        }
      </div>

      <!-- Dialog footer -->
      <div class="flex items-center justify-between px-6 py-3 flex-shrink-0"
           style="background:#f8f9ff;border-top:1px solid rgba(17,48,105,0.07)">
        <span class="text-[11px]" style="color:#8b95a6">
          ออกโดย {{ previewQuotation()!.createdBy }} ·
          {{ previewQuotation()!.generatedAt | date:'dd MMM yyyy HH:mm' }}
        </span>
        <button (click)="closePreview()"
                class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all"
                style="background:#f0f4fd;color:#435d98">
          ปิด
        </button>
      </div>
    </div>
  </div>
}

<!-- ── Download error toast ───────────────────────────────────────────────── -->
@if (downloadError()) {
  <div class="fixed top-5 right-5 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl text-[13px] font-bold text-white"
       style="background:#171c22;box-shadow:0 8px 24px rgba(17,28,34,0.18)">
    <span>{{ downloadError() }}</span>
    <button (click)="downloadError.set('')" class="opacity-60 hover:opacity-100">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="w-3.5 h-3.5">
        <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
      </svg>
    </button>
  </div>
}
  `
})
export class QuotationListComponent implements OnInit, OnDestroy {
  private readonly svc = inject(QuotationService);
  private readonly san = inject(DomSanitizer);

  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly pageSize  = 20;

  loading       = signal(true);
  items         = signal<QuotationSummary[]>([]);
  totalCount    = signal(0);
  page          = signal(1);

  downloadingId = signal<string | null>(null);
  downloadError = signal('');

  // Preview dialog state
  previewQuotation = signal<QuotationSummary | null>(null);
  pdfUrl           = signal<SafeResourceUrl | null>(null);
  pdfLoading       = signal(false);
  pdfError         = signal('');
  private objectUrl: string | null = null;

  searchQuery = '';

  readonly filteredItems = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.items();
    return this.items().filter(i =>
      i.customerName.toLowerCase().includes(q) ||
      (i.vehicleRegistration ?? '').toLowerCase().includes(q) ||
      i.companyName.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void { this.revokeObjectUrl(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.svc.getHistory(this.page(), this.pageSize);
      this.items.set(res.items);
      this.totalCount.set(res.totalCount);
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.totalCount()) { this.page.update(p => p + 1); this.load(); }
  }

  paginationLabel(): string {
    const start = (this.page() - 1) * this.pageSize + 1;
    const end   = Math.min(this.page() * this.pageSize, this.totalCount());
    return `${start}–${end} จาก ${this.totalCount()} รายการ`;
  }

  planTypeLabel(t: string): string {
    return PLAN_TYPE_LABELS[t] ?? t;
  }

  // ── Preview ──────────────────────────────────────────────────────────────

  async openPreview(q: QuotationSummary): Promise<void> {
    this.previewQuotation.set(q);
    this.pdfError.set('');
    this.pdfUrl.set(null);
    this.revokeObjectUrl();
    await this.fetchPdf(q.id);
  }

  closePreview(): void {
    this.previewQuotation.set(null);
    this.pdfUrl.set(null);
    this.pdfError.set('');
    this.revokeObjectUrl();
  }

  async retryPreview(): Promise<void> {
    const q = this.previewQuotation();
    if (q) await this.fetchPdf(q.id);
  }

  private async fetchPdf(id: string): Promise<void> {
    this.pdfLoading.set(true);
    this.pdfError.set('');
    try {
      const blob = await this.svc.downloadPdf(id);
      this.objectUrl = URL.createObjectURL(blob);
      this.pdfUrl.set(this.san.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.pdfError.set('ไม่สามารถโหลด PDF ได้ กรุณาลองดาวน์โหลดโดยตรง');
    } finally {
      this.pdfLoading.set(false);
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────

  async downloadPdf(q: QuotationSummary): Promise<void> {
    this.downloadingId.set(q.id);
    try {
      const blob = await this.svc.downloadPdf(q.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `quotation-${q.customerName.replace(/\s+/g, '-')}-${q.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.downloadError.set('ดาวน์โหลด PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      setTimeout(() => this.downloadError.set(''), 4000);
    } finally {
      this.downloadingId.set(null);
    }
  }
}
