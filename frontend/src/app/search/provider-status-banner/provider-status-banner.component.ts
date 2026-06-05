import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AggregatedSearchResult, ProviderSearchResult } from '../../core/search-api.service';

/**
 * Compact strip that summarizes the per-provider outcome of a multi-provider
 * aggregated search. Feature 002 — Phase 3 + Phase 7.
 *
 * Each provider chip carries TWO independent signals:
 *
 *   1. Status        — Success / NoMatch / Timeout / BreakerOpen / Failed
 *                      Colour the chip (green/grey/red).
 *
 *   2. DataSource    — Import (local DB, e.g. Allianz) vs Api (live insurer call).
 *                      Plus the special Cache state when isStale=true.
 *                      Rendered as a small pill next to the company name.
 */
@Component({
  selector: 'app-provider-status-banner',
  standalone: true,
  imports: [CommonModule],
  
  templateUrl: './provider-status-banner.component.html',
  styleUrl: './provider-status-banner.component.scss',
})
export class ProviderStatusBannerComponent {
  aggregated = input<AggregatedSearchResult | null>(null);

  visible = computed(() => (this.aggregated()?.results.length ?? 0) > 0);

  successCount = computed(() =>
    this.aggregated()?.results.filter(r => r.status === 'Success').length ?? 0);

  totalPlans = computed(() =>
    this.aggregated()?.results.reduce((sum, r) => sum + r.plans.length, 0) ?? 0);

  cachedCount = computed(() =>
    this.aggregated()?.results.filter(r => r.isStale).length ?? 0);

  // ── Status chip (background of whole chip) ───────────────────────────────────
  chipStyle(r: ProviderSearchResult): string {
    switch (r.status) {
      case 'Success':
        return 'background:#e6f4f5;color:#006874';
      case 'NoMatch':
        return 'background:#f0f4fd;color:#5a6270';
      case 'Timeout':
      case 'BreakerOpen':
      case 'Failed':
        return 'background:#fff2f2;color:#c0392b';
      default:
        return 'background:#f0f4fd;color:#5a6270';
    }
  }

  iconFor(r: ProviderSearchResult): string {
    switch (r.status) {
      case 'Success':     return '✓';
      case 'NoMatch':     return '○';
      case 'Timeout':     return '⏱';
      case 'BreakerOpen': return '⚡';
      case 'Failed':      return '⚠';
      default:            return '·';
    }
  }

  labelFor(r: ProviderSearchResult): string {
    switch (r.status) {
      case 'Success':
        return `${r.plans.length} แผน · ${r.providerLatencyMs} ms`;
      case 'NoMatch':
        return 'ไม่มีแผนตรงเงื่อนไข';
      case 'Timeout':
        return 'ไม่ตอบสนอง';
      case 'BreakerOpen':
        return 'ระบบไม่พร้อม';
      case 'Failed':
        return 'ขัดข้อง';
      default:
        return r.status;
    }
  }

  // ── DataSource / Cache pill (the small badge next to company name) ──────────
  /**
   * Three states:
   *   Import        → "🗃 Import"  (grey)         pre-loaded local data
   *   Api + isStale → "💾 Cache"   (amber)        cached response (either fresh-cache or stale fallback)
   *   Api + fresh   → "🌐 Live"    (subtle blue)  freshly fetched
   */
  sourcePillLabel(r: ProviderSearchResult): string {
    if (r.dataSource === 'Import') return '🗃 Import';
    if (r.isStale)                 return '💾 Cache';
    return '🌐 Live';
  }

  sourcePillStyle(r: ProviderSearchResult): string {
    if (r.dataSource === 'Import')
      return 'background:rgba(67,93,152,0.12);color:#435d98';
    if (r.isStale)
      return 'background:#fef3e8;color:#8c4f00';
    // Live API fresh
    return 'background:rgba(73,178,193,0.18);color:#0a7a85';
  }

  tooltipFor(r: ProviderSearchResult): string {
    const parts = [
      `${r.companyDisplayName} (${r.companyShortCode})`,
      `Status: ${r.status}${r.isStale ? ' (cache)' : ''}`,
      `Data source: ${r.dataSource === 'Import' ? 'Local DB (Excel import)' : 'Live API'}`,
      `Latency: ${r.providerLatencyMs} ms`,
    ];
    if (r.errorMessage) parts.push(`Error: ${r.errorMessage}`);
    return parts.join('\n');
  }
}
