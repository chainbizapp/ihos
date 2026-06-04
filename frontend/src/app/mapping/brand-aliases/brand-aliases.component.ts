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
  styles: [`
    .card { background:#fff; border-radius:24px; box-shadow:0 12px 32px rgba(17,48,105,0.06); }
    .src-human   { background:#e6f4f5; color:#006874; }
    .src-fuzzy   { background:rgba(73,178,193,0.18); color:#0a7a85; }
    .src-guess   { background:#fef3e8; color:#8c4f00; }
    .src-pending { background:#fff2f2; color:#c0392b; }
    .fs { appearance:none;-webkit-appearance:none;background:#f0f4fd;border:none;border-radius:0.75rem;
          padding:0.5rem 2rem 0.5rem 0.875rem;font-size:13px;font-weight:600;color:#171c22;cursor:pointer;outline:none; }
    input.inp { background:#f0f4fd;border:none;border-radius:0.75rem;padding:0.5rem 0.875rem;font-size:13px;color:#171c22;outline:none; }
    .btn { padding:6px 14px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all .15s; }
    .btn:hover { opacity:.9; }
  `],
  template: `
<div class="min-h-screen px-6 py-8" style="background:#f0f4fd">
  <div class="max-w-screen-xl mx-auto">

    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-[22px] font-black mb-1" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
        Brand Aliases
      </h1>
      <p class="text-[13px]" style="color:#8b95a6">
        จับคู่ชื่อยี่ห้อที่แต่ละบริษัทส่งมา (เช่น MTI "ISUZ") เข้ากับยี่ห้อกลาง (Isuzu)
        — AI เดาให้ก่อน แก้ไข/ยืนยันได้ที่นี่
      </p>
    </div>

    @if (error()) {
      <div class="mb-4 px-5 py-3 rounded-2xl text-[13px] font-semibold"
           style="background:#fff2f2;color:#c0392b">{{ error() }}</div>
    }

    <!-- Toolbar -->
    <div class="card px-5 py-3 mb-5 flex items-center gap-3 flex-wrap">
      <select class="fs" [(ngModel)]="filterProvider" (ngModelChange)="reload()">
        <option value="">ทุก Provider</option>
        @for (p of providers(); track p) { <option [value]="p">{{ p }}</option> }
      </select>
      <label class="flex items-center gap-2 text-[12px] font-semibold" style="color:#5a6270">
        <input type="checkbox" [(ngModel)]="verifiedOnly" (ngModelChange)="reload()">
        เฉพาะที่ยืนยันแล้ว
      </label>
      <span class="text-[12px]" style="color:#8b95a6">
        {{ aliases().length }} รายการ
        @if (pendingCount() > 0) {
          · <span style="color:#8c4f00">{{ pendingCount() }} รอยืนยัน</span>
        }
      </span>
      <button class="btn ml-auto text-white" style="background:linear-gradient(135deg,#006874,#49b2c1)"
              (click)="startAdd()">+ เพิ่ม Alias</button>
    </div>

    <!-- Add row -->
    @if (adding()) {
      <div class="card px-5 py-4 mb-5 flex items-center gap-3 flex-wrap">
        <input class="inp" style="width:110px" placeholder="Provider" [(ngModel)]="newProvider">
        <input class="inp" style="width:200px" placeholder="ชื่อที่ส่งมา (raw)" [(ngModel)]="newRaw">
        <span style="color:#8b95a6">→</span>
        <select class="fs" style="width:220px" [(ngModel)]="newMakeId">
          <option [ngValue]="null">(ไม่ระบุ — Pending)</option>
          @for (m of makes(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
        </select>
        <button class="btn text-white" style="background:#006874" (click)="saveAdd()">บันทึก</button>
        <button class="btn" style="background:#f0f4fd;color:#5a6270" (click)="adding.set(false)">ยกเลิก</button>
      </div>
    }

    <!-- Table -->
    <div class="card overflow-hidden">
      <table class="w-full text-[13px]">
        <thead>
          <tr style="background:#f8f9ff;color:#8b95a6">
            <th class="text-left px-5 py-3 font-bold uppercase tracking-wider text-[10px]">Provider</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">ส่งมา (Raw)</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">→ Canonical Make</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">ที่มา</th>
            <th class="text-right px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Conf.</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">อัปเดต</th>
            <th class="text-right px-5 py-3 font-bold uppercase tracking-wider text-[10px]">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          @for (a of aliases(); track a.id) {
            <tr style="border-top:1px solid rgba(17,48,105,0.06)">
              <td class="px-5 py-3 font-mono text-[11px]" style="color:#5a6270">{{ a.providerCode }}</td>
              <td class="px-3 py-3 font-semibold" style="color:#171c22">
                @if (editId() === a.id) {
                  <input class="inp" style="width:160px" [(ngModel)]="editRaw">
                } @else { {{ a.rawValue }} }
              </td>
              <td class="px-3 py-3">
                @if (editId() === a.id) {
                  <select class="fs" style="width:200px" [(ngModel)]="editMakeId">
                    <option [ngValue]="null">(ไม่ระบุ)</option>
                    @for (m of makes(); track m.id) { <option [ngValue]="m.id">{{ m.name }}</option> }
                  </select>
                } @else {
                  @if (a.canonicalMakeName) {
                    <span style="color:#171c22">{{ a.canonicalMakeName }}</span>
                  } @else {
                    <span style="color:#c0392b">— ยังไม่ map —</span>
                  }
                }
              </td>
              <td class="px-3 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" [class]="srcClass(a.source)">
                  {{ srcLabel(a.source) }}
                </span>
              </td>
              <td class="px-3 py-3 text-right" style="color:#8b95a6">
                {{ a.confidence != null ? a.confidence + '%' : '—' }}
              </td>
              <td class="px-3 py-3" style="color:#8b95a6">{{ a.updatedAt | date:'dd MMM HH:mm' }}</td>
              <td class="px-5 py-3 text-right whitespace-nowrap">
                @if (editId() === a.id) {
                  <button class="btn text-white" style="background:#006874" (click)="saveEdit(a)">บันทึก</button>
                  <button class="btn" style="background:#f0f4fd;color:#5a6270" (click)="editId.set(null)">ยกเลิก</button>
                } @else {
                  @if (!a.isVerified && a.canonicalMakeId) {
                    <button class="btn text-white" style="background:#8c4f00" (click)="verify(a)">✓ ยืนยัน</button>
                  }
                  <button class="btn" style="background:#f0f4fd;color:#435d98" (click)="startEdit(a)">แก้ไข</button>
                  <button class="btn" style="background:#fff2f2;color:#c0392b" (click)="remove(a)">ลบ</button>
                }
              </td>
            </tr>
          }
          @if (aliases().length === 0 && !loading()) {
            <tr><td colspan="7" class="px-6 py-10 text-center" style="color:#8b95a6">ไม่มี alias</td></tr>
          }
        </tbody>
      </table>
    </div>

  </div>
</div>
  `,
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
