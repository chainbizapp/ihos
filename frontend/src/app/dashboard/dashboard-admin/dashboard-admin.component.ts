import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface UserItem    { id: string; email: string; fullName: string; role: string; status: string; }
interface AuditEntry  { id: string; actorId: string | null; actorFullName?: string | null; actorEmail?: string | null; actionType: string; outcome: string; occurredAt: string; }
interface ImportBatch { id: string; companyName: string; sourceFileName: string; uploadedBy: string; uploadedAt: string; status: string; totalRows: number; pendingRows: number; approvedRows: number; rejectedRows: number; }
interface UsagePeriod { period: string; quotationCount: number; searchCount: number; }
interface Paged<T>    { items: T[]; totalCount: number; }

interface BarDay  { label: string; success: number; fail: number; }
interface HBar    { label: string; labelTh: string; count: number; }
interface Slice   { label: string; value: number; color: string; }
interface Point   { label: string; value: number; }
interface TopUser { name: string; role: string; count: number; }

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Agent: '#435d98', SeniorStaff: '#f7941d', Manager: '#e05c5c', Admin: '#c0392b',
};
const ROLE_BG: Record<string, string> = {
  Agent: 'rgba(67,93,152,.12)', SeniorStaff: 'rgba(247,148,29,.14)',
  Manager: 'rgba(224,92,92,.12)', Admin: 'rgba(192,57,43,.12)',
};
const ROLE_LABEL: Record<string, string> = {
  Agent: 'Agent', SeniorStaff: 'Senior Agent', Manager: 'Manager', Admin: 'Admin',
};
const ACT_LABEL: Record<string, string> = {
  SearchPlans: 'ค้นหา', GenerateQuotation: 'คำนวณ', UserLogin: 'เข้าสู่ระบบ',
  ExportReport: 'ส่งออกข้อมูล', ApproveRecord: 'อนุมัติ', RejectRecord: 'ปฏิเสธ',
};
const INS_COLOR = ['#006874', '#1e8a9b', '#4caf7d', '#8bc34a', '#f7941d', '#9e9e9e'];

// ── Pure helpers ───────────────────────────────────────────────────────────────

function isoShift(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function shortMon(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function dateKey(iso: string): string { return iso.slice(0, 10); }

function dDash(v: number, total: number, r: number): string {
  if (!total) return `0 ${2 * Math.PI * r}`;
  const c = 2 * Math.PI * r;
  const d = (v / total) * c;
  return `${d.toFixed(2)} ${(c - d).toFixed(2)}`;
}

function dOffset(prevFrac: number, r: number): number {
  return 2 * Math.PI * r * (0.25 - prevFrac);
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.scss',
})
export class DashboardAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api  = environment.apiUrl;

  // ── Set to false when backend is ready ──────────────────────────────────
  private readonly USE_MOCK = true;

  // ── Signals ────────────────────────────────────────────────────────────────
  readonly loading = signal(true);

  readonly totalUsers    = signal(0);
  readonly activeUsers   = signal(0);
  readonly inactiveUsers = signal(0);
  readonly roleCount     = signal(0);
  readonly roleSlices    = signal<Slice[]>([]);
  readonly roleTotal     = computed(() => this.roleSlices().reduce((s, x) => s + x.value, 0));

  readonly auditDays      = signal<BarDay[]>([]);
  readonly popularActions = signal<HBar[]>([]);
  readonly topUsers       = signal<TopUser[]>([]);

  readonly quotationDays = signal<Point[]>([]);
  readonly topInsurers   = signal<Slice[]>([]);
  readonly insTotal      = computed(() => this.topInsurers().reduce((s, x) => s + x.value, 0));

  readonly pendingCount  = signal(0);
  readonly monthImport   = signal(0);
  readonly todayQ        = signal(0);
  readonly monthQ        = signal(0);
  readonly importBatches = signal<ImportBatch[]>([]);

  // ── Computed card lists ────────────────────────────────────────────────────
  readonly kpiCards = computed(() => [
    { label: 'ผู้ใช้งานทั้งหมด',      value: this.totalUsers()    },
    { label: 'ผู้ใช้งานที่ใช้งานอยู่', value: this.activeUsers()   },
    { label: 'ถูกปิดใช้งาน',           value: this.inactiveUsers() },
    { label: 'บทบาท',                  value: this.roleCount()     },
  ]);

  readonly importStats = computed(() => [
    { label: 'รออนุมัตินำเข้าแผนประกัน',           value: this.pendingCount(), warn: true  },
    { label: 'การนำเข้าข้อมูลแผนประกันในเดือนนี้', value: this.monthImport(),  warn: false },
    { label: 'ใบเสนอราคาวันนี้',                    value: this.todayQ(),       warn: false },
    { label: 'ใบเสนอราคาเดือนนี้',                 value: this.monthQ(),       warn: false },
  ]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await Promise.allSettled([
      this.loadUsers(),
      this.loadAudit(),
      this.loadQuotations(),
      this.loadImport(),
    ]);
    this.loading.set(false);
  }

  // ── Data loaders ───────────────────────────────────────────────────────────

  private async loadUsers(): Promise<void> {
    try {
      if (this.USE_MOCK) throw new Error('mock');
      const r = await firstValueFrom(
        this.http.get<Paged<UserItem>>(`${this.api}/users`, {
          params: new HttpParams().set('pageSize', '500'),
        })
      );
      const users = r.items;
      this.totalUsers.set(users.length);
      this.activeUsers.set(users.filter(u => u.status === 'Active').length);
      this.inactiveUsers.set(users.filter(u => u.status === 'Inactive').length);
      const rc: Record<string, number> = {};
      for (const u of users) rc[u.role] = (rc[u.role] ?? 0) + 1;
      this.roleCount.set(Object.keys(rc).length);
      this.roleSlices.set(
        ['Agent', 'SeniorStaff', 'Manager', 'Admin']
          .filter(r => rc[r])
          .map(r => ({ label: ROLE_LABEL[r] ?? r, value: rc[r], color: ROLE_COLOR[r] ?? '#8896ad' }))
      );
    } catch {
      this.totalUsers.set(87);
      this.activeUsers.set(75);
      this.inactiveUsers.set(12);
      this.roleCount.set(4);
      this.roleSlices.set([
        { label: 'Agent',        value: 62, color: '#435d98' },
        { label: 'Senior Agent', value: 21, color: '#f7941d' },
        { label: 'Manager',      value: 16, color: '#e05c5c' },
        { label: 'Admin',        value:  4, color: '#c0392b' },
      ]);
    }
  }

  private async loadAudit(): Promise<void> {
    try {
      if (this.USE_MOCK) throw new Error('mock');
      const today = new Date();
      const from  = new Date(today); from.setDate(from.getDate() - 13);
      const r = await firstValueFrom(
        this.http.get<Paged<AuditEntry>>(`${this.api}/audit-logs`, {
          params: new HttpParams()
            .set('from', from.toISOString().slice(0, 10))
            .set('pageSize', '2000'),
        })
      );
      const entries = r.items;
      this.auditDays.set(
        Array.from({ length: 14 }, (_, i) => {
          const dk = isoShift(from, i);
          const de = entries.filter(e => dateKey(e.occurredAt) === dk);
          return {
            label:   String(new Date(dk).getDate()),
            success: de.filter(e => e.outcome === 'Success').length,
            fail:    de.filter(e => e.outcome !== 'Success').length,
          };
        })
      );
      const from7 = isoShift(today, -6);
      const week  = entries.filter(e => dateKey(e.occurredAt) >= from7);
      const ac: Record<string, number> = {};
      for (const e of week) ac[e.actionType] = (ac[e.actionType] ?? 0) + 1;
      this.popularActions.set(
        Object.entries(ac)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([a, c]) => ({ label: a, labelTh: ACT_LABEL[a] ?? a, count: c }))
      );
      const todayK = dateKey(today.toISOString());
      const todayE = entries.filter(e => dateKey(e.occurredAt) === todayK);
      const uc: Record<string, { count: number; name: string; role: string }> = {};
      for (const e of todayE) {
        if (!e.actorId) continue;
        if (!uc[e.actorId]) uc[e.actorId] = { count: 0, name: e.actorFullName ?? e.actorEmail ?? e.actorId.slice(0, 8), role: 'Staff' };
        uc[e.actorId].count++;
      }
      this.topUsers.set(
        Object.values(uc).sort((a, b) => b.count - a.count).slice(0, 5)
          .map(u => ({ name: u.name, role: u.role, count: u.count }))
      );
    } catch {
      const today = new Date();
      this.auditDays.set(
        Array.from({ length: 14 }, (_, i) => ({
          label:   String(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13 + i).getDate()),
          success: 600 + Math.round(Math.random() * 700),
          fail:    Math.round(Math.random() * 80),
        }))
      );
      this.popularActions.set([
        { label: 'SearchPlans',       labelTh: 'ค้นหา',          count: 210 },
        { label: 'GenerateQuotation', labelTh: 'คำนวณ',          count: 180 },
        { label: 'UserLogin',         labelTh: 'เข้าสู่ระบบ',    count: 140 },
        { label: 'ExportReport',      labelTh: 'ส่งออกข้อมูล',   count: 110 },
        { label: 'ApproveRecord',     labelTh: 'อนุมัติ',         count:  90 },
        { label: 'RejectRecord',      labelTh: 'ปฏิเสธ',          count:  55 },
      ]);
      this.topUsers.set([
        { name: 'สมชาย ใจดี',     role: 'Agent',       count: 660    },
        { name: 'สมชาย ใจดี',     role: 'Admin',       count: 295500 },
        { name: 'บัวชา ปานทอง',   role: 'Agent',       count: 295500 },
        { name: 'วิชัย รุ่งเรือง', role: 'SeniorStaff', count: 114373 },
        { name: 'กนิกา ศรีสุข',   role: 'Manager',     count: 5095   },
      ]);
    }
  }

  private async loadQuotations(): Promise<void> {
    try {
      if (this.USE_MOCK) throw new Error('mock');
      const today = new Date();
      const from  = new Date(today); from.setDate(from.getDate() - 29);
      const r = await firstValueFrom(
        this.http.get<{ periods: UsagePeriod[] }>(`${this.api}/reports/usage-statistics`, {
          params: new HttpParams()
            .set('from', from.toISOString().slice(0, 10))
            .set('to',   today.toISOString().slice(0, 10))
            .set('granularity', 'daily'),
        })
      );
      this.quotationDays.set(r.periods.map(p => ({ label: shortMon(p.period), value: p.quotationCount })));
      const ms = today.toISOString().slice(0, 7);
      this.todayQ.set(r.periods.find(p => p.period === dateKey(today.toISOString()))?.quotationCount ?? 0);
      this.monthQ.set(r.periods.filter(p => p.period.startsWith(ms)).reduce((s, p) => s + p.quotationCount, 0));
    } catch {
      const today = new Date();
      const from  = new Date(today); from.setDate(from.getDate() - 29);
      const base  = [100,115,108,125,140,132,120,138,155,148,160,145,158,170,162,150,168,175,165,178,185,172,168,182,190,178,185,195,188,175];
      this.quotationDays.set(base.map((v, i) => ({ label: shortMon(isoShift(from, i)), value: v })));
      this.todayQ.set(175);
      this.monthQ.set(4210);
    }
  }

  private async loadImport(): Promise<void> {
    try {
      if (this.USE_MOCK) throw new Error('mock');
      const r = await firstValueFrom(
        this.http.get<Paged<ImportBatch>>(`${this.api}/imports/batches`, {
          params: new HttpParams().set('pageSize', '20'),
        })
      );
      const batches = r.items;
      this.importBatches.set(batches.slice(0, 10));
      this.pendingCount.set(batches.filter(b => b.status === 'PendingReview').length);
      const ms   = new Date().toISOString().slice(0, 7);
      this.monthImport.set(batches.filter(b => b.uploadedAt.startsWith(ms)).reduce((s, b) => s + (b.totalRows ?? 0), 0));
      const from7 = new Date(); from7.setDate(from7.getDate() - 6);
      const im: Record<string, number> = {};
      for (const b of batches.filter(b => new Date(b.uploadedAt) >= from7))
        im[b.companyName] = (im[b.companyName] ?? 0) + (b.totalRows ?? 0);
      const sorted = Object.entries(im).sort((a, b) => b[1] - a[1]);
      const top5   = sorted.slice(0, 5).map(([n, v], i) => ({ label: n, value: v, color: INS_COLOR[i] }));
      const rest   = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
      if (rest) top5.push({ label: 'อื่นๆ', value: rest, color: '#9e9e9e' });
      this.topInsurers.set(top5);
    } catch {
      this.pendingCount.set(8);
      this.monthImport.set(968);
      this.importBatches.set([
        { id:'1', companyName:'Allianz Ayudhya General Insurance', sourceFileName:'Premium table Type1 for AA_Q2_2026.xlsx',    uploadedBy:'somchai.t',  uploadedAt:'2026-05-11T19:49:00Z', status:'PendingReview', totalRows:295500, pendingRows:120, approvedRows:0,   rejectedRows:0  },
        { id:'2', companyName:'Allianz Ayudhya General Insurance', sourceFileName:'Premium table Non-Type1 for AA_2026.xlsx',   uploadedBy:'nattaya.p',  uploadedAt:'2026-05-11T19:32:03Z', status:'PendingReview', totalRows:295500, pendingRows:95,  approvedRows:200, rejectedRows:5  },
        { id:'3', companyName:'Allianz Ayudhya General Insurance', sourceFileName:'Premium table Type1 for AA_May_update.xlsx', uploadedBy:'wicha.r',    uploadedAt:'2026-05-11T18:49:23Z', status:'PendingReview', totalRows:295500, pendingRows:0,   approvedRows:0,   rejectedRows:0  },
        { id:'4', companyName:'Viriyah Insurance',                 sourceFileName:'Premium table Non-Type1 for VRI_Q2.xlsx',    uploadedBy:'wicharee.y', uploadedAt:'2026-05-11T16:32:20Z', status:'PendingReview', totalRows:114373, pendingRows:50,  approvedRows:100, rejectedRows:10 },
        { id:'5', companyName:'Viriyah Insurance',                 sourceFileName:'X37_report_list_car_and_package_2026.xlsx',  uploadedBy:'pranee.k',   uploadedAt:'2026-05-11T10:02:00Z', status:'PendingReview', totalRows:5095,   pendingRows:10,  approvedRows:50,  rejectedRows:2  },
      ]);
      this.topInsurers.set([
        { label: 'Allianz Ayudhya',   value: 295500, color: '#006874' },
        { label: 'Muang Thai',        value: 180000, color: '#1e8a9b' },
        { label: 'Viriyah',           value: 114373, color: '#4caf7d' },
        { label: 'Bangkok Insurance', value:  80000, color: '#8bc34a' },
        { label: 'Dhipaya',           value:  45000, color: '#f7941d' },
        { label: 'อื่นๆ',             value:  20000, color: '#9e9e9e' },
      ]);
    }
  }

  // ── SVG: Bar chart ─────────────────────────────────────────────────────────

  private readonly CW = 600; private readonly CH = 160;
  private readonly PL = 44;  private readonly PR = 10;
  private readonly PT = 10;  private readonly PB = 20;

  private get maxAudit(): number {
    return Math.max(...this.auditDays().map(d => d.success + d.fail), 1);
  }

  bX(i: number): number {
    const n    = this.auditDays().length || 14;
    const slot = (this.CW - this.PL - this.PR) / n;
    return this.PL + i * slot + 2;
  }
  bW(): number {
    const n = this.auditDays().length || 14;
    return (this.CW - this.PL - this.PR) / n - 4;
  }
  bTop(v: number): number {
    const ph = this.CH - this.PT - this.PB;
    return this.PT + ph * (1 - v / this.maxAudit);
  }
  bHt(v: number): number {
    return (this.CH - this.PT - this.PB) * (v / this.maxAudit);
  }
  auditGridY(): { y: number; v: string }[] {
    const max = this.maxAudit;
    const ph  = this.CH - this.PT - this.PB;
    return [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: this.PT + ph * (1 - f),
      v: Math.round(max * f).toLocaleString(),
    }));
  }

  // ── SVG: Area chart ────────────────────────────────────────────────────────

  private readonly TCW = 600; private readonly TCH = 165;
  private readonly TPL = 38;  private readonly TPR = 10;
  private readonly TPT = 10;  private readonly TPB = 20;

  private get maxQ(): number {
    return Math.max(...this.quotationDays().map(p => p.value), 1);
  }

  tX(i: number): number {
    const n = Math.max(this.quotationDays().length - 1, 1);
    return this.TPL + (i / n) * (this.TCW - this.TPL - this.TPR);
  }
  tY(v: number): number {
    const ph = this.TCH - this.TPT - this.TPB;
    return this.TPT + ph * (1 - v / this.maxQ);
  }
  trendGrid(): { y: number; v: string }[] {
    const ph = this.TCH - this.TPT - this.TPB;
    return [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: this.TPT + ph * (1 - f),
      v: Math.round(this.maxQ * f).toString(),
    }));
  }
  readonly trendPaths = computed<{ line: string; area: string } | null>(() => {
    const pts = this.quotationDays();
    if (pts.length < 2) return null;
    const xs  = pts.map((_, i) => this.tX(i));
    const ys  = pts.map(p => this.tY(p.value));
    const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
    const bY  = this.tY(0);
    const area = line + ` L ${xs[xs.length - 1].toFixed(1)} ${bY.toFixed(1)} L ${xs[0].toFixed(1)} ${bY.toFixed(1)} Z`;
    return { line, area };
  });

  // ── SVG: Donut ─────────────────────────────────────────────────────────────

  dDash(v: number, total: number, r: number): string {
    return dDash(v, total, r);
  }
  dOff(idx: number, slices: Slice[], r: number): number {
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (!total) return 0;
    const prev = slices.slice(0, idx).reduce((s, x) => s + x.value, 0);
    return dOffset(prev / total, r);
  }

  // ── Horizontal bar ─────────────────────────────────────────────────────────

  hPct(v: number): number {
    return (v / Math.max(...this.popularActions().map(b => b.count), 1)) * 100;
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  roleBg(role: string):    string { return ROLE_BG[role]    ?? '#f0f2f7'; }
  roleClr(role: string):   string { return ROLE_COLOR[role] ?? '#5a6a8a'; }
  roleLabel(role: string): string { return ROLE_LABEL[role] ?? role; }

  sLabel(status: string): string {
    return ({ Processing: 'กำลังประมวลผล', PendingReview: 'รอการตรวจสอบ', Published: 'เผยแพร่แล้ว', Failed: 'ล้มเหลว' } as Record<string, string>)[status] ?? status;
  }
  sBg(status: string): string {
    return ({ Processing: 'rgba(67,93,152,.12)', PendingReview: 'rgba(247,148,29,.15)', Published: 'rgba(76,175,125,.12)', Failed: 'rgba(232,84,84,.12)' } as Record<string, string>)[status] ?? '#f0f2f7';
  }
  sClr(status: string): string {
    return ({ Processing: '#435d98', PendingReview: '#a05a00', Published: '#2e7d5a', Failed: '#b71c1c' } as Record<string, string>)[status] ?? '#5a6a8a';
  }

  private eMin(at: string): number {
    return Math.floor((Date.now() - new Date(at).getTime()) / 60000);
  }
  elapsed(at: string): string {
    const m = this.eMin(at);
    if (m < 60) return `${m} นาที`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ชม.`;
    const d = Math.floor(h / 24), rh = h % 24;
    return rh > 0 ? `${d} วัน ${rh} ชม.` : `${d} วัน`;
  }
  eBg(at: string): string {
    const h = this.eMin(at) / 60;
    return h >= 72 ? 'rgba(232,84,84,.15)' : h >= 24 ? 'rgba(247,148,29,.15)' : h >= 2 ? 'rgba(255,200,0,.18)' : 'rgba(76,175,125,.15)';
  }
  eClr(at: string): string {
    const h = this.eMin(at) / 60;
    return h >= 72 ? '#b71c1c' : h >= 24 ? '#a05a00' : h >= 2 ? '#7a6000' : '#1b5e40';
  }

  fmtDate(iso: string): string {
    const d   = new Date(iso);
    const dd  = String(d.getDate()).padStart(2, '0');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    const hh  = String(d.getHours()).padStart(2, '0');
    const mm  = String(d.getMinutes()).padStart(2, '0');
    return `${dd} ${mon} ${d.getFullYear()}, ${hh}:${mm}`;
  }
}
