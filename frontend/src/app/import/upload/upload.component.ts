import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ImportApiService, InsuranceCompany, ParseErrorDto } from '../../core/import-api.service';

@Component({
  selector: 'app-import-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Import tab strip -->
    <div class="bg-white border-b px-6 sticky top-16 z-30">
      <div class="max-w-screen-xl mx-auto flex gap-1">
        <a routerLink="/import/batches"
           routerLinkActive="!border-[#006874] !text-[#006874] font-semibold"
           class="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 transition-colors">
          📥 Pricing Data
        </a>
        <a routerLink="/import/vehicles/sync"
           routerLinkActive="!border-[#006874] !text-[#006874] font-semibold"
           class="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 transition-colors">
          🚗 Vehicle Database
        </a>
      </div>
    </div>

    <div class="p-6 max-w-2xl mx-auto">
      <h1 class="text-2xl font-semibold mb-6">Upload Insurance Data</h1>

      <!-- Company selector -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Insurance Company</label>
        <select
          [ngModel]="selectedCompanyId()" (ngModelChange)="selectedCompanyId.set($event)"
          class="w-full border rounded px-3 py-2"
          [disabled]="uploading()">
          <option value="">-- Select Company --</option>
          @for (company of companies(); track company.id) {
            <option [value]="company.id">{{ company.name }} ({{ company.shortCode }})</option>
          }
        </select>
      </div>

      <!-- File drop zone -->
      <div
        class="border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors"
        [class.border-blue-400]="dragOver()"
        [class.border-gray-300]="!dragOver()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragOver.set(false)"
        (drop)="onDrop($event)">
        @if (selectedFile()) {
          <div class="text-green-600">
            <p class="font-medium">{{ selectedFile()!.name }}</p>
            <p class="text-sm text-gray-500">{{ formatFileSize(selectedFile()!.size) }}</p>
          </div>
        } @else {
          <p class="text-gray-500">Drag & drop an Excel (.xlsx) or CSV file here</p>
          <p class="text-sm text-gray-400 mt-1">or</p>
        }
        <label class="mt-3 inline-block cursor-pointer">
          <span class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Browse File
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            class="hidden"
            (change)="onFileChange($event)"
            [disabled]="uploading()" />
        </label>
      </div>

      <!-- Upload progress -->
      @if (uploading()) {
        <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <!-- Stage + elapsed -->
          <div class="flex items-center gap-3 mb-2">
            <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <span class="text-blue-800 font-semibold text-sm flex-1">{{ uploadStage() }}</span>
            <span class="text-blue-500 text-xs font-mono">{{ elapsedLabel() }}</span>
          </div>

          <!-- Progress bar (shown once we have row counts) -->
          @if (totalRows() > 0) {
            <div class="w-full bg-blue-200 rounded-full h-1.5 mb-2">
              <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                   [style.width.%]="progressPct()"></div>
            </div>
            <div class="flex justify-between text-[11px] text-blue-600 font-mono">
              <span>{{ processedRows() | number }} / {{ totalRows() | number }} rows</span>
              <span>{{ etaLabel() }}</span>
            </div>
          }

          <p class="text-xs text-blue-600 mt-2 leading-snug">
            Processing runs in the background — you can
            <a routerLink="/import/batches" class="underline font-medium">go to Import Batches</a>
            to track progress and continue other work.
          </p>
        </div>
      }

      <!-- Parse errors -->
      @if (parseErrors().length > 0) {
        <div class="mb-4 bg-red-50 border border-red-200 rounded p-4">
          <h3 class="font-semibold text-red-700 mb-2">Parse Errors ({{ parseErrors().length }})</h3>
          <div class="overflow-auto max-h-48">
            <table class="text-sm w-full">
              <thead>
                <tr class="text-left text-red-600">
                  <th class="py-1 pr-4">Row</th>
                  <th class="py-1 pr-4">Column</th>
                  <th class="py-1">Reason</th>
                </tr>
              </thead>
              <tbody>
                @for (err of parseErrors(); track $index) {
                  <tr class="border-t border-red-100">
                    <td class="py-1 pr-4">{{ err.row }}</td>
                    <td class="py-1 pr-4">{{ err.column }}</td>
                    <td class="py-1 text-red-700">{{ err.reason }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- General error -->
      @if (errorMessage()) {
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {{ errorMessage() }}
        </div>
      }

      <!-- Master File Tip -->
      @if (hasMasterFileError()) {
        <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <div class="text-xl">💡</div>
          <div>
            <h3 class="font-semibold text-blue-900 mb-1">Vehicle Master File Detected</h3>
            <p class="text-sm text-blue-800 mb-3">It looks like you are trying to upload a vehicle database file. This upload tool is specifically for importing pricing information.</p>
            <a routerLink="/import/vehicles/sync" class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              Go to Vehicle Database Sync &rarr;
            </a>
          </div>
        </div>
      }

      <!-- Upload button -->
      <button
        (click)="upload()"
        [disabled]="!canUpload()"
        class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
        Upload
      </button>
    </div>
  `
})
export class UploadComponent implements OnDestroy {
  private readonly importApi = inject(ImportApiService);
  private readonly router = inject(Router);

  companies = signal<InsuranceCompany[]>([]);
  selectedCompanyId = signal('');
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  dragOver = signal(false);
  parseErrors = signal<ParseErrorDto[]>([]);
  errorMessage = signal('');

  // Progress tracking
  uploadStage    = signal('Uploading file...');
  elapsedSeconds = signal(0);
  processedRows  = signal(0);
  totalRows      = signal(0);
  etaSeconds     = signal<number | null>(null);

  elapsedLabel = computed(() => {
    const s = this.elapsedSeconds();
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  });

  progressPct = computed(() => {
    const t = this.totalRows();
    return t > 0 ? Math.min(100, Math.round(this.processedRows() / t * 100)) : 0;
  });

  etaLabel = computed(() => {
    const eta = this.etaSeconds();
    if (eta == null) return '';
    if (eta < 60) return `~${eta}s left`;
    return `~${Math.ceil(eta / 60)}m left`;
  });

  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  hasMasterFileError = computed(() => {
    const msg = this.errorMessage();
    const errors = this.parseErrors();
    const check = (s: string) => s.includes('Vehicle master file') || s.includes('db_master_car_master_v2.csv');
    return (msg && check(msg)) || errors.some(e => e.reason && check(e.reason));
  });

  canUpload = computed(() =>
    !!this.selectedCompanyId() && !!this.selectedFile() && !this.uploading()
  );

  constructor() {
    this.loadCompanies();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private async loadCompanies(): Promise<void> {
    try {
      const companies = await this.importApi.getCompanies();
      this.companies.set(companies);
    } catch {
      // Companies endpoint may not exist yet; leave empty
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    this.selectedFile.set(file);
    this.parseErrors.set([]);
    this.errorMessage.set('');
  }

  private clearTimers(): void {
    if (this.elapsedTimer) { clearInterval(this.elapsedTimer); this.elapsedTimer = null; }
    if (this.pollTimer)    { clearTimeout(this.pollTimer);     this.pollTimer    = null; }
  }

  private startElapsedTimer(): void {
    this.elapsedSeconds.set(0);
    this.elapsedTimer = setInterval(() => {
      this.elapsedSeconds.update(s => s + 1);
    }, 1000);
  }

  async upload(): Promise<void> {
    if (!this.canUpload()) return;
    this.uploading.set(true);
    this.uploadStage.set('Uploading file...');
    this.processedRows.set(0);
    this.totalRows.set(0);
    this.etaSeconds.set(null);
    this.parseErrors.set([]);
    this.errorMessage.set('');
    this.startElapsedTimer();

    try {
      const job = await this.importApi.upload(this.selectedCompanyId(), this.selectedFile()!);
      this.uploadStage.set('Processing rows — resolving mappings...');
      this.pollJobStatus(job.jobId);
    } catch (err: any) {
      this.clearTimers();
      this.uploading.set(false);
      const body = err?.error;
      if (body?.parseErrors) {
        this.parseErrors.set(body.parseErrors);
      } else {
        this.errorMessage.set(body?.error ?? 'Upload failed. Please try again.');
      }
    }
  }

  private pollJobStatus(jobId: string): void {
    this.pollTimer = setTimeout(async () => {
      try {
        const s = await this.importApi.getJobStatus(jobId);

        if (s.status === 'processing') {
          if (s.stage)          this.uploadStage.set(s.stage);
          if (s.processedRows)  this.processedRows.set(s.processedRows);
          if (s.totalRows)      this.totalRows.set(s.totalRows);
          this.etaSeconds.set(s.etaSeconds ?? null);
          this.pollJobStatus(jobId);

        } else if (s.status === 'done' && s.batchId) {
          this.clearTimers();
          this.uploading.set(false);
          await this.router.navigate(['/import/batches', s.batchId]);

        } else {
          this.clearTimers();
          this.uploading.set(false);
          this.errorMessage.set(s.error ?? 'Processing failed. Please try again.');
        }
      } catch {
        this.clearTimers();
        this.uploading.set(false);
        this.errorMessage.set('Lost connection while checking status. Please refresh.');
      }
    }, 2000);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
