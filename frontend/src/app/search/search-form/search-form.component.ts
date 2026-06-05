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
  templateUrl: './search-form.component.html',
  styleUrl: './search-form.component.scss'
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
