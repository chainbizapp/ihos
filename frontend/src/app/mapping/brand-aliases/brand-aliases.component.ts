import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandAlias, BrandAliasApiService, VehicleMake } from './brand-alias-api.service';

/**
 * Admin page for provider brand aliases (feature 003).
 * Lists each provider's raw brand → canonical make crosswalk, with the data source
 * (Human / AI fuzzy / AI guess / Pending) shown so reviewers know which rows to trust.
 * AI guesses can be approved one-click, any row edited or deleted, new aliases added.
 */
@Component({
  selector: 'app-brand-aliases',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  
  templateUrl: './brand-aliases.component.html',
  styleUrl: './brand-aliases.component.scss',
})
export class BrandAliasesComponent implements OnInit {
  private readonly api = inject(BrandAliasApiService);

  aliases = signal<BrandAlias[]>([]);
  providers = signal<string[]>([]);
  makes = signal<VehicleMake[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  filterProvider = '';
  verifiedOnly = false;

  adding = signal(false);
  newProvider = ''; newRaw = ''; newMakeId: string | null = null;

  editId = signal<string | null>(null);
  editRaw = ''; editMakeId: string | null = null;

  pendingCount = computed(() => this.aliases().filter(a => !a.isVerified).length);

  async ngOnInit(): Promise<void> {
    this.makes.set(await this.api.getMakes());
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const r = await this.api.list(this.filterProvider || undefined, this.verifiedOnly || undefined);
      this.aliases.set(r.items);
      this.providers.set(r.providerCodes);
      this.error.set(null);
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'โหลดข้อมูลไม่สำเร็จ');
    } finally { this.loading.set(false); }
  }

  startAdd(): void { this.adding.set(true); this.newProvider=''; this.newRaw=''; this.newMakeId=null; }
  async saveAdd(): Promise<void> {
    if (!this.newProvider.trim() || !this.newRaw.trim()) { this.error.set('กรอก Provider + Raw ให้ครบ'); return; }
    try {
      await this.api.create(this.newProvider.trim(), this.newRaw.trim(), this.newMakeId);
      this.adding.set(false);
      await this.reload();
    } catch (e: any) { this.error.set(e?.error?.error ?? 'บันทึกไม่สำเร็จ'); }
  }

  startEdit(a: BrandAlias): void {
    this.editId.set(a.id); this.editRaw = a.rawValue; this.editMakeId = a.canonicalMakeId ?? null;
  }
  async saveEdit(a: BrandAlias): Promise<void> {
    try {
      await this.api.update(a.id, a.providerCode, this.editRaw.trim(), this.editMakeId);
      this.editId.set(null);
      await this.reload();
    } catch (e: any) { this.error.set(e?.error?.error ?? 'แก้ไขไม่สำเร็จ'); }
  }

  async verify(a: BrandAlias): Promise<void> {
    try { await this.api.verify(a.id); await this.reload(); }
    catch (e: any) { this.error.set(e?.error?.error ?? 'ยืนยันไม่สำเร็จ'); }
  }

  async remove(a: BrandAlias): Promise<void> {
    if (!confirm(`ลบ alias "${a.rawValue}" ?`)) return;
    try { await this.api.delete(a.id); await this.reload(); }
    catch (e: any) { this.error.set(e?.error?.error ?? 'ลบไม่สำเร็จ'); }
  }

  srcClass(s: string): string {
    switch (s) {
      case 'Human': return 'src-human';
      case 'AiFuzzy': return 'src-fuzzy';
      case 'AiGuess': return 'src-guess';
      default: return 'src-pending';
    }
  }
  srcLabel(s: string): string {
    switch (s) {
      case 'Human': return '✅ คน';
      case 'AiFuzzy': return '🤖 AI';
      case 'AiGuess': return '⚠️ AI เดา';
      default: return '❓ รอ';
    }
  }
}
