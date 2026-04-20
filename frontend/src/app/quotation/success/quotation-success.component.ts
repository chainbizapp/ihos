import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuotationService } from '../quotation.service';

@Component({
  selector: 'app-quotation-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 max-w-lg mx-auto text-center">
      <div class="text-6xl mb-4">✅</div>
      <h1 class="text-2xl font-semibold text-gray-900 mb-2">Quotation Generated</h1>
      <p class="text-gray-600 mb-6">
        Your quotation has been created successfully. Download the PDF below.
      </p>

      @if (quotationId()) {
        <div class="bg-gray-50 rounded-lg border p-4 mb-6 text-sm text-gray-700">
          <span class="font-medium">Quotation ID:</span>
          <span class="ml-2 font-mono text-gray-900">{{ quotationId()!.substring(0, 8).toUpperCase() }}</span>
        </div>
      }

      @if (downloadError()) {
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {{ downloadError() }}
        </div>
      }

      <div class="flex flex-col gap-3">
        <button
          (click)="downloadPdf()"
          [disabled]="downloading()"
          class="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          @if (downloading()) {
            Downloading...
          } @else {
            Download PDF
          }
        </button>

        <a
          routerLink="/search"
          class="w-full py-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 text-center block">
          Back to Search
        </a>
      </div>
    </div>
  `
})
export class QuotationSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly quotationService = inject(QuotationService);

  quotationId = signal<string | null>(null);
  downloading = signal(false);
  downloadError = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('quotationId');
    this.quotationId.set(id);
  }

  async downloadPdf(): Promise<void> {
    const id = this.quotationId();
    if (!id) return;

    this.downloading.set(true);
    this.downloadError.set(null);

    try {
      const blob = await this.quotationService.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `quotation_${id.substring(0, 8).toUpperCase()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      this.downloadError.set('Failed to download PDF. Please try again.');
    } finally {
      this.downloading.set(false);
    }
  }
}
