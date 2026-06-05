import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ImportApiService, InsuranceCompany, ParseErrorDto } from '../../core/import-api.service';

@Component({
  selector: 'app-import-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
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
