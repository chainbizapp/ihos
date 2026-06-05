import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  ImportApiService, InsuranceCompany,
  VehicleSyncResult, SyncedMakeDto
} from '../../core/import-api.service';

@Component({
  selector: 'app-vehicle-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  
  templateUrl: './vehicle-sync.component.html',
  styleUrl: './vehicle-sync.component.scss'
})
export class VehicleSyncComponent {
  private readonly importApi = inject(ImportApiService);

  companies   = signal<InsuranceCompany[]>([]);
  selectedCompanyId = signal('');
  selectedFile = signal<File | null>(null);
  syncing     = signal(false);
  dragOver    = signal(false);
  errorMessage = signal('');
  result      = signal<VehicleSyncResult | null>(null);
  makesFilter = signal<'all' | 'new' | 'existing'>('all');

  canSync = computed(() =>
    !!this.selectedCompanyId() && !!this.selectedFile() && !this.syncing()
  );

  filteredMakes = computed(() => {
    const makes = this.result()?.makes ?? [];
    const f = this.makesFilter();
    if (f === 'new')      return makes.filter(m => m.isNew);
    if (f === 'existing') return makes.filter(m => !m.isNew);
    return makes;
  });

  constructor() {
    this.importApi.getCompanies().then(c => {
      this.companies.set(c);
      const viriyah = c.find(co => co.shortCode === 'VRI');
      if (viriyah) this.selectedCompanyId.set(viriyah.id);
    });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    if (!file.name.endsWith('.csv')) {
      this.errorMessage.set('Only CSV files are accepted for vehicle master sync.');
      return;
    }
    this.selectedFile.set(file);
    this.errorMessage.set('');
    this.result.set(null);
  }

  async sync(): Promise<void> {
    if (!this.canSync()) return;
    this.syncing.set(true);
    this.errorMessage.set('');
    this.result.set(null);

    try {
      const res = await this.importApi.syncViriyahMaster(
        this.selectedCompanyId(), this.selectedFile()!
      );
      this.result.set(res);
    } catch (err: any) {
      this.errorMessage.set(
        err?.error?.error ?? err?.error?.title ?? 'Sync failed. Please try again.'
      );
    } finally {
      this.syncing.set(false);
    }
  }

  makeModelCount(makeId: string): number {
    return this.result()?.entries.filter(e => e.makeId === makeId).length ?? 0;
  }

  makeNewModelCount(makeId: string): number {
    return this.result()?.entries.filter(e => e.makeId === makeId && e.isNewModel).length ?? 0;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
