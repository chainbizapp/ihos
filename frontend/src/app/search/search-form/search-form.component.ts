import { Component, inject, signal, output, input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { VehicleSelectorComponent, VehicleSelection } from '../../shared/vehicle-selector/vehicle-selector.component';
import { ImportApiService, InsuranceCompany } from '../../core/import-api.service';
import { SearchParams } from '../../core/search-api.service';
import { SearchPreferencesService } from '../../core/search-preferences.service';

const PHOSPHOR: Record<string, string> = {
  car: `<path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/>`,
  users: `<path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,196.11a8,8,0,1,0,13.4,8.76,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.76A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a95.87,95.87,0,0,0-52.76-38.8,60,60,0,1,0-63.6,0,95.87,95.87,0,0,0-52.76,38.8,8,8,0,0,0,13.4,8.76,80.11,80.11,0,0,1,134.32,0,8,8,0,0,0,13.4-8.76ZM160,172a44,44,0,1,1,44-44A44.05,44.05,0,0,1,160,172Z"/>`,
  heart: `<path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.27,196.15,128,206.8Z"/>`,
  reset: `<path d="M224,128a96,96,0,1,1-96-96,95.7,95.7,0,0,1,66.29,26.5l-21.5,21.5A8,8,0,0,0,184,96h40a8,8,0,0,0,8-8V48a8,8,0,0,0-13.66-5.66L197.73,62.93A112,112,0,1,0,240,128a8,8,0,0,0-16,0Z"/>`,
};

const PLAN_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'Type1', label: 'ชั้น 1 (Comprehensive)' },
  { value: 'Type2Plus', label: 'ชั้น 2+ (Third Party+)' },
  { value: 'Type2', label: 'ชั้น 2 (Third Party+OD)' },
  { value: 'Type3Plus', label: 'ชั้น 3+ (Third Party+)' },
  { value: 'Type3', label: 'ชั้น 3 (Third Party)' },
];
const CURRENT_YEAR = new Date().getFullYear();

@Component({
  selector: 'app-search-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full">
      <!-- Title Block -->
      <div class="flex items-center gap-3 mb-8">
        <div class="w-10 h-10 rounded-full bg-[#e6f4f1] flex items-center justify-center text-[#006874]">
          <span class="w-5 h-5" [innerHTML]="icon('car')"></span>
        </div>
        <div>
          <h2 class="text-[18px] font-extrabold text-[#1a202c] font-['Plus_Jakarta_Sans'] tracking-tight">Policy Finder</h2>
          <div class="text-[11px] text-gray-500 font-medium tracking-wide">Refine your protection</div>
        </div>
      </div>

      <form (ngSubmit)="onSubmit()" #f="ngForm" class="flex flex-col gap-6">
        <!-- Vehicle selection summary in sidebar (informational) -->
        @if (vehicleSelection()) {
          <div class="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <div class="text-[10px] text-gray-400 font-bold uppercase mb-1">Current Vehicle</div>
            <div class="text-[13px] font-bold text-[#2d3748]">
              {{ vehicleSelection()?.makeName }} {{ vehicleSelection()?.modelName }}
            </div>
            @if (vehicleSelection()?.year || vehicleSelection()?.engineCC) {
              <div class="text-[11px] text-gray-500 mt-0.5">
                {{ vehicleSelection()?.year }} · {{ vehicleSelection()?.engineCC }} L
              </div>
            }
          </div>
        }

        <!-- Plan type -->
        <div>
          <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">Plan Type</label>
          <div class="flex flex-wrap gap-1.5">
            @for (opt of planTypeOptions; track opt.value) {
              <button type="button"
                (click)="form.planType = opt.value"
                [class]="form.planType === opt.value
                  ? 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#006874] text-white border border-[#006874]'
                  : 'px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white text-gray-500 border border-gray-200 hover:border-[#006874] hover:text-[#006874] transition-colors'">
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        <!-- Repair type -->
        <div>
          <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">Repair Type</label>
          <div class="flex gap-6 mt-1">
            <label class="flex items-center gap-2 text-[13px] font-semibold text-[#2d3748] cursor-pointer group">
              <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors"
                [class]="form.repairType === 'Garage' ? 'border-[#006874]' : 'border-gray-300 group-hover:border-gray-400'">
                @if(form.repairType === 'Garage') { <div class="w-2 h-2 rounded-full bg-[#006874]"></div> }
              </div>
              <input type="radio" [(ngModel)]="form.repairType" name="repairType" value="Garage" class="absolute opacity-0 w-0 h-0" />
              Garage
            </label>
            <label class="flex items-center gap-2 text-[13px] font-semibold text-[#2d3748] cursor-pointer group">
              <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors"
                [class]="form.repairType === 'Dealer' ? 'border-[#006874]' : 'border-gray-300 group-hover:border-gray-400'">
                @if(form.repairType === 'Dealer') { <div class="w-2 h-2 rounded-full bg-[#006874]"></div> }
              </div>
              <input type="radio" [(ngModel)]="form.repairType" name="repairType" value="Dealer" class="absolute opacity-0 w-0 h-0" />
              Dealer
            </label>
          </div>
        </div>

        @if (validationError()) {
          <div class="text-red-500 text-[12px] font-medium leading-tight">{{ validationError() }}</div>
        }

        @if (showFilters()) {
          <div class="bg-white border p-3 rounded-lg flex flex-col gap-3">
             <select [(ngModel)]="form.companyId" name="companyId"
                class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] font-medium text-[#2d3748]">
                <option value="">Any company</option>
                @for (c of companies(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select>
          </div>
        }

        <div class="flex gap-2 mt-2">
          <button type="submit" [disabled]="searching()"
            class="flex-1 bg-[#f6921d] text-white py-3.5 rounded-lg font-bold text-[15px] hover:bg-[#e08419] transition-colors shadow-sm tracking-wide disabled:opacity-50">
            {{ searching() ? 'Searching...' : 'Apply Filters' }}
          </button>
          <button type="button" (click)="resetForm()" [disabled]="searching()"
            class="w-12 flex items-center justify-center py-3.5 rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            title="Reset form">
            <span class="w-4 h-4" [innerHTML]="icon('reset')"></span>
          </button>
        </div>
      </form>
    </div>
  `
})
export class SearchFormComponent implements OnInit {
  private readonly importApi = inject(ImportApiService);
  private readonly prefs = inject(SearchPreferencesService);
  readonly #san = inject(DomSanitizer);

  companies = signal<InsuranceCompany[]>([]);
  showFilters = signal(false);
  searching = signal(false);
  validationError = signal<string | null>(null);
  planTypeOptions = PLAN_TYPE_OPTIONS;
  currentYear = CURRENT_YEAR;
  savedVehicleSelection = signal<VehicleSelection | null>(null);

  /** Injected by parent from the top bar */
  vehicleSelection = input<VehicleSelection | null>(null);

  form = {
    planType: '',
    repairType: 'Garage',
    companyId: '',
    excessMin: null as number | null,
    excessMax: null as number | null
  };

  @ViewChild(VehicleSelectorComponent) vehicleSelectorRef!: VehicleSelectorComponent;

  readonly searchSubmit = output<SearchParams>();
  readonly formReset = output<void>();

  icon(name: string): SafeHtml {
    const inner = PHOSPHOR[name] ?? '';
    return this.#san.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" style="width:100%;height:100%">${inner}</svg>`
    );
  }

  ngOnInit(): void {
    this.importApi.getCompanies().then(c => this.companies.set(c));
    const saved = this.prefs.load();
    if (saved) {
      this.form.planType = saved.planType;
      this.form.repairType = saved.repairType;
      this.savedVehicleSelection.set({
        makeId: saved.makeId,
        makeName: saved.makeName,
        modelId: saved.modelId,
        modelName: saved.modelName,
        engineCC: saved.engineCC,
        year: saved.vehicleYear
      });
    }
  }

  onVehicleSelected(selection: VehicleSelection | null): void {
    // No longer needed as it is passed via input
  }

  resetSearching(): void {
    this.searching.set(false);
  }

  resetForm(): void {
    this.form.planType = '';
    this.form.repairType = 'Garage';
    this.form.companyId = '';
    this.form.excessMin = null;
    this.form.excessMax = null;
    this.savedVehicleSelection.set(null);
    this.validationError.set(null);
    this.formReset.emit();
    this.prefs.save({
      makeId: '', makeName: '', modelId: '', modelName: '',
      planType: '', repairType: 'Garage'
    });
  }

  submit(): void {
    this.onSubmit();
  }

  onSubmit(): void {
    const selection = this.vehicleSelection();
    if (!selection) {
      this.validationError.set('Please select a vehicle make and model.');
      return;
    }
    if (!this.form.repairType) {
      this.validationError.set('Please select a repair type.');
      return;
    }
    const params: SearchParams = {
      vehicleModelId: selection.modelId,
      registrationYear: selection.year ?? CURRENT_YEAR,
      planType: this.form.planType,
      repairType: this.form.repairType,
      companyId: this.form.companyId || undefined,
      excessMin: this.form.excessMin ?? undefined,
      excessMax: this.form.excessMax ?? undefined,
      engineCC: selection.engineCC || undefined,
      gearType: selection.gearType || undefined,
      allVariants: selection.allVariants || undefined
    };

    this.prefs.save({
      makeId: selection.makeId,
      makeName: selection.makeName,
      modelId: selection.modelId,
      modelName: selection.modelName,
      engineCC: selection.engineCC,
      gearType: selection.gearType,
      vehicleYear: selection.year,
      planType: this.form.planType,
      repairType: this.form.repairType
    });

    this.searching.set(true);
    this.searchSubmit.emit(params);
  }
}
