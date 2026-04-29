import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchApiService, VehicleMake, VehicleModel } from '../../core/search-api.service';
import { SearchPreferencesService } from '../../core/search-preferences.service';

// ── Recently Viewed ───────────────────────────────────────────────────────────

export interface RecentVehicle {
  makeId: string; makeName: string;
  modelId: string; modelName: string;
  subModel?: string;
  year?: number;
  gearType?: string;
  savedAt: number;
}

const RECENT_KEY = 'ihos_recent_vehicles';
const RECENT_LIMIT = 4;

function loadRecent(): RecentVehicle[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(v: RecentVehicle): void {
  let list = loadRecent().filter(r => r.modelId !== v.modelId);
  list = [v, ...list].slice(0, RECENT_LIMIT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

// ── Popular brands (matched by name against API) ──────────────────────────────
const POPULAR_MAKE_NAMES = [
  'Toyota', 'Honda', 'Isuzu', 'Mitsubishi', 'Nissan',
  'Mazda', 'Ford', 'BYD', 'MG',
];

// ── Popular models per brand (matched case-insensitively against API) ─────────
const POPULAR_MODELS: Record<string, string[]> = {
  toyota:     ['Hilux Revo', 'Fortuner', 'Yaris ATIV', 'Yaris Cross', 'Corolla Altis', 'Corolla Cross', 'Camry', 'Vios', 'Alphard'],
  honda:      ['City', 'City Hatchback', 'Civic', 'Accord', 'HR-V', 'CR-V', 'BR-V', 'Jazz', 'Mobilio'],
  isuzu:      ['D-Max', 'MU-X', 'D-Max Hi-Lander', 'D-Max V-Cross', 'D-Max Spark', 'D-Max Cab4', 'MU-X Active', 'MU-X Elegant', 'MU-X Ultimate'],
  mitsubishi: ['Triton', 'Pajero Sport', 'Xpander', 'Xpander Cross', 'Attrage', 'Mirage', 'Outlander PHEV', 'Triton Athlete', 'Triton Single Cab'],
  nissan:     ['Almera', 'Navara', 'Terra', 'Kicks e-Power', 'Sylphy', 'Note', 'March', 'Teana', 'X-Trail'],
  mazda:      ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'CX-8', 'BT-50', 'MX-5', 'CX-60'],
  ford:       ['Ranger', 'Everest', 'Ranger Raptor', 'Ranger Wildtrak', 'Ranger XL', 'Ranger XLS', 'Ranger XLT', 'Everest Sport', 'Everest Titanium'],
  byd:        ['Dolphin', 'Atto 3', 'Seal', 'Sealion 6', 'Sealion 7', 'Yuan Plus', 'Qin Plus', 'Song Plus', 'Dolphin Mini'],
  mg:         ['MG4 Electric', 'MG5', 'MG ZS EV', 'MG HS', 'MG ES', 'MG3 Hybrid+', 'MG VS HEV', 'MG EP', 'Maxus 9'],
};

const MAKE_LOGO: Record<string, string> = {
  toyota: 'logos/toyota.png',
  honda: 'logos/honda.png',
  isuzu: 'logos/isuzu.png',
  mitsubishi: 'logos/mitsubishi.png',
  nissan: 'logos/nissan.png',
  mazda: 'logos/mazda.png',
  ford: 'logos/ford.png',
  byd: 'logos/byd.png',
  mg: 'logos/mg.png',
};

// ── Province data ─────────────────────────────────────────────────────────────

export interface Province { id: string; name: string; shortName: string; count: number }

const POPULAR_PROVINCES: Province[] = [
  { id: 'กรุงเทพมหานคร', name: 'กรุงเทพมหานคร', shortName: 'กทม.',       count: 10_244_144 },
  { id: 'ชลบุรี',         name: 'ชลบุรี',         shortName: 'ชลบุรี',      count:  1_570_782 },
  { id: 'เชียงใหม่',      name: 'เชียงใหม่',      shortName: 'เชียงใหม่',   count:  1_457_217 },
  { id: 'นครราชสีมา',    name: 'นครราชสีมา',    shortName: 'โคราช',       count:  1_368_421 },
  { id: 'ขอนแก่น',        name: 'ขอนแก่น',        shortName: 'ขอนแก่น',     count:    866_989 },
  { id: 'สงขลา',          name: 'สงขลา',          shortName: 'สงขลา',       count:    829_239 },
  { id: 'ระยอง',          name: 'ระยอง',          shortName: 'ระยอง',       count:    744_140 },
  { id: 'อุบลราชธานี',   name: 'อุบลราชธานี',   shortName: 'อุบลฯ',       count:    738_943 },
  { id: 'เชียงราย',       name: 'เชียงราย',       shortName: 'เชียงราย',    count:    738_735 },
];

const ALL_PROVINCES: string[] = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร',
  'ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท',
  'ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง',
  'ตราด','ตาก','นครนายก','นครปฐม','นครพนม',
  'นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส',
  'น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์',
  'ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา',
  'พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์',
  'แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน',
  'ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง',
  'ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย',
  'ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี',
  'สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย',
  'หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์',
  'อุทัยธานี','อุบลราชธานี',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSearchId(): string {
  return 'MTR-' + Math.floor(1000 + Math.random() * 9000);
}

function makeAbbr(name: string): string {
  return name.slice(0, 3).toUpperCase();
}

@Component({
  selector: 'app-search-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .fl { display:block;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7a8d;margin-bottom:6px }
    .fs { width:100%;background:#fff;border:1.5px solid #e2e8f0;border-radius:.625rem;padding:.625rem .875rem;font-size:14px;font-family:'Noto Sans Thai',sans-serif;color:#171c22;outline:none;transition:border-color .15s,box-shadow .15s;appearance:none;-webkit-appearance:none;cursor:pointer;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='%23006874'%3E%3Cpath d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right .75rem center;background-size:14px;padding-right:2.5rem }
    .fs:focus { border-color:#006874;box-shadow:0 0 0 3px rgba(0,104,116,.1) }
    .fs:disabled { background-color:#f8f9ff;color:#b0b9c6;cursor:not-allowed }
    /* ── Brand tiles ─── */
    .brand-tile { display:flex;flex-direction:column;align-items:stretch;border-radius:18px;border:2px solid #edf1f7;background:transparent;cursor:pointer;transition:all .18s;position:relative;min-width:0;overflow:hidden }
    .brand-tile:hover { border-color:#006874;box-shadow:0 4px 14px rgba(0,104,116,.13);transform:translateY(-2px) }
    .brand-tile.selected { border-color:#006874;box-shadow:0 4px 16px rgba(0,104,116,.18) }
    .brand-logo { width:100%;aspect-ratio:1;background-size:contain;background-repeat:no-repeat;background-position:center;background-color:#f4f7fd;position:relative }
    .brand-tile.selected .brand-logo { background-color:#ddf2f5 }
    .brand-abbr { width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;letter-spacing:.04em;background:#f4f7fd;color:#435d98 }
    .brand-tile.selected .brand-abbr { background:#ddf2f5;color:#006874 }
    .brand-name { font-size:11px;font-weight:700;color:#5a6270;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 6px;background:transparent }
    .brand-tile.selected .brand-name { color:#006874;font-weight:800 }
    .check-badge { position:absolute;top:7px;right:7px;width:18px;height:18px;border-radius:50%;background:#006874;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,104,116,.4) }
    /* ── Dialog ─── */
    .dlg-overlay { position:fixed;inset:0;background:rgba(17,48,105,0.45);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .15s ease }
    .dlg-card { background:#fff;border-radius:20px;width:100%;max-width:580px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,0.2);animation:slideUp .18s ease }
    .dlg-search { width:100%;background:#f5f8ff;border:1.5px solid #e2e8f0;border-radius:10px;padding:.6rem .875rem .6rem 2.4rem;font-size:14px;font-family:'Noto Sans Thai',sans-serif;color:#171c22;outline:none;transition:border-color .15s }
    .dlg-search:focus { border-color:#006874;background:#fff;box-shadow:0 0 0 3px rgba(0,104,116,.1) }
    .dlg-search::placeholder { color:#b0b9c6 }
@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes slideUp { from { opacity:0;transform:translateY(12px) } to { opacity:1;transform:translateY(0) } }
  `],
  template: `
<div style="background:#f0f4fd;font-family:'Noto Sans Thai',sans-serif;min-height:calc(100vh - 4rem)">
  <div class="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14">

    <!-- ── Hero ──────────────────────────────────────────────────────── -->
    <div class="mb-2">
      <div class="flex items-center gap-1.5 mb-3 text-[12px] font-bold tracking-wide" style="color:#006874">
        <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">
          <path d="M234.29,114.85l-45,38.83L203,211a16,16,0,0,1-23.84,17.49L128,198.29,76.88,228.46A16,16,0,0,1,53,211l13.76-57.32-45-38.83A16,16,0,0,1,31.08,86l58.34-5.06,22.76-54.71a16,16,0,0,1,29.64,0l22.76,54.71,58.34,5.06a16,16,0,0,1,9.17,28.86Z"/>
        </svg>
        เริ่มต้นการเช็คเบี้ยประกันที่แม่นยำ
      </div>
      <h1 class="text-[34px] md:text-[42px] font-black leading-tight mb-2"
          style="color:#004d58;font-family:'Plus Jakarta Sans',sans-serif">
        เลือกข้อมูลรถยนต์ของคุณ
      </h1>
      <p class="text-[14px]" style="color:#6b7a8d">
        กรุณาเลือกยี่ห้อรถยนต์ที่คุณต้องการทำประกัน เพื่อรับข้อเสนอที่ดีที่สุด
      </p>
    </div>

    <!-- ── 2-column: form + sidebar ──────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-[1fr_272px] gap-5 mt-7" style="align-items:start">

      <!-- ── Form card ─────────────────────────────────────────────── -->
      <div class="rounded-2xl p-6" style="background:#ffffff;box-shadow:0 2px 20px rgba(17,48,105,0.07)">

        <!-- ── Step indicator ──────────────────────────────────────── -->
        <div class="flex items-center mb-6">
          @for (s of steps; track s.n; let last = $last) {
            <div class="flex items-center" [class.flex-1]="!last">
              <button class="flex items-center gap-2" (click)="goToStep(s.n)" [disabled]="!canGoToStep(s.n)">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-all"
                     [style]="currentStep() > s.n
                       ? 'background:#006874;color:#fff'
                       : currentStep() === s.n
                         ? 'background:#006874;color:#fff;box-shadow:0 0 0 3px rgba(0,104,116,0.15)'
                         : 'background:#f0f4fd;color:#9aa5b4;border:2px solid #e2e8f0'">
                  @if (currentStep() > s.n) {
                    <svg viewBox="0 0 20 20" fill="currentColor" style="width:11px;height:11px">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  } @else {
                    {{ s.n }}
                  }
                </div>
                <span class="text-[12px] font-semibold hidden sm:block transition-colors"
                      [style]="currentStep() >= s.n ? 'color:#006874' : 'color:#9aa5b4'">
                  {{ s.label }}
                </span>
              </button>
              @if (!last) {
                <div class="flex-1 h-px mx-3 transition-all"
                     [style]="currentStep() > s.n ? 'background:#006874' : 'background:#e2e8f0'"></div>
              }
            </div>
          }
        </div>

        <!-- ── Step 1: เลือกยี่ห้อ ──────────────────────────────────── -->
        @if (currentStep() === 1) {
          <div class="mb-4">
            <span class="text-[13px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">ยี่ห้อยอดนิยม</span>
          </div>
          <div class="grid gap-3" style="grid-template-columns:repeat(5,1fr)">
            @for (m of popularMakes(); track m.id) {
              <button class="brand-tile" [class.selected]="selectedMakeId === m.id"
                      (click)="selectMakeStep(m.id)">
                @if (selectedMakeId === m.id) {
                  <span class="check-badge">
                    <svg viewBox="0 0 20 20" fill="white" style="width:11px;height:11px">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </span>
                }
                @if (makeLogo(m.name); as logo) {
                  <div class="brand-logo" [style.background-image]="'url(' + logo + ')'"></div>
                } @else {
                  <div class="brand-abbr">{{ makeAbbr(m.name) }}</div>
                }
                <span class="brand-name">{{ m.name }}</span>
              </button>
            }
            <button class="brand-tile" [class.selected]="selectedMakeId && !isPopularMake()"
                    (click)="openBrandDialog()">
              @if (selectedMakeId && !isPopularMake()) {
                <span class="check-badge">
                  <svg viewBox="0 0 20 20" fill="white" style="width:11px;height:11px">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                </span>
                <div class="brand-abbr">{{ makeAbbr(selectedMakeName()) }}</div>
                <span class="brand-name">{{ selectedMakeName() }}</span>
              } @else {
                <div class="brand-abbr" style="font-size:22px;font-weight:400;letter-spacing:0">···</div>
                <span class="brand-name">ยี่ห้ออื่นๆ</span>
              }
            </button>
          </div>
        }

        <!-- ── Step 2: รุ่นและปี ────────────────────────────────────── -->
        @if (currentStep() === 2) {
          <!-- Selected make summary -->
          <div class="flex items-center gap-3 mb-5 pb-4" style="border-bottom:1px solid #f0f4fd">
            @if (makeLogo(selectedMakeName()); as logo) {
              <div class="w-10 h-10 rounded-xl flex-shrink-0"
                   [style.background-image]="'url(' + logo + ')'"
                   style="background-size:contain;background-repeat:no-repeat;background-position:center;background-color:#f4f7fd"></div>
            } @else {
              <div class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-[12px] font-black"
                   style="background:#f4f7fd;color:#435d98">{{ makeAbbr(selectedMakeName()) }}</div>
            }
            <div>
              <div class="text-[13px] font-extrabold" style="color:#171c22">{{ selectedMakeName() }}</div>
              <button (click)="goToStep(1)" class="text-[11px] font-semibold" style="color:#006874;background:none;border:none;cursor:pointer;padding:0">เปลี่ยนยี่ห้อ</button>
            </div>
          </div>

          @if (loadingModels()) {
            <div class="py-8 text-center text-[13px]" style="color:#9aa5b4">กำลังโหลดรุ่นรถ…</div>
          } @else {
            @if (popularModelTiles().length > 0) {
              <div class="mb-4">
                <span class="text-[13px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">รุ่นยอดนิยม</span>
              </div>
              <div class="grid gap-3" style="grid-template-columns:repeat(5,1fr)">
                @for (tile of popularModelTiles(); track tile.name) {
                  <button class="brand-tile" [class.selected]="selectedModelName() === tile.groupName"
                          (click)="onModelChange(tile.groupName)">
                    @if (selectedModelName() === tile.groupName) {
                      <span class="check-badge">
                        <svg viewBox="0 0 20 20" fill="white" style="width:11px;height:11px">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                      </span>
                    }
                    <div class="brand-abbr"
                         style="font-size:10px;font-weight:800;letter-spacing:0;white-space:normal;text-align:center;padding:8px 4px;line-height:1.3;word-break:break-word">
                      {{ tile.name }}
                    </div>
                  </button>
                }
                <!-- Other / รุ่นอื่นๆ -->
                <button class="brand-tile" [class.selected]="selectedModelName() && !isPopularModel()"
                        (click)="openModelDialog()">
                  @if (selectedModelName() && !isPopularModel()) {
                    <span class="check-badge">
                      <svg viewBox="0 0 20 20" fill="white" style="width:11px;height:11px">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                      </svg>
                    </span>
                    <div class="brand-abbr"
                         style="font-size:10px;font-weight:800;letter-spacing:0;white-space:normal;text-align:center;padding:8px 4px;line-height:1.3;word-break:break-word">
                      {{ selectedModelName() }}
                    </div>
                  } @else {
                    <div class="brand-abbr" style="font-size:22px;font-weight:400;letter-spacing:0">···</div>
                  }
                  <span class="brand-name">รุ่นอื่นๆ</span>
                </button>
              </div>
            } @else {
              <!-- Fallback: no popular models configured for this brand → dropdown -->
              <div class="mb-4">
                <label class="fl">เลือกรุ่น (MODEL)</label>
                <select class="fs" [ngModel]="selectedModelName()" (ngModelChange)="onModelChange($event)">
                  <option value="">กรุณาเลือก</option>
                  @for (g of modelGroups(); track g.name) { <option [value]="g.name">{{ g.name }}</option> }
                </select>
              </div>
            }

            <!-- Year + Trim — shown only after a model is selected -->
            @if (selectedModelName()) {
              <div class="grid grid-cols-2 gap-4 mt-5">
                <div>
                  <label class="fl">ปีรถยนต์ (YEAR)</label>
                  <select class="fs" [ngModel]="selectedYear()" (ngModelChange)="selectedYear.set(+$event)"
                          [disabled]="yearOptions().length === 0">
                    <option [value]="0">ทุกปี</option>
                    @for (yr of yearOptions(); track yr) { <option [value]="yr">{{ yr }}</option> }
                  </select>
                </div>
                <div>
                  <label class="fl">รุ่นย่อย / Trim</label>
                  <select class="fs" [ngModel]="selectedVariantId()" (ngModelChange)="selectedVariantId.set($event)">
                    @for (v of variantOptions(); track v.id) { <option [value]="v.id">{{ v.label }}</option> }
                  </select>
                </div>
              </div>
            }
          }

          <button (click)="goToStep(3)" [disabled]="!selectedModelId()"
                  class="w-full mt-4 py-3.5 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  style="background:#006874;box-shadow:0 4px 14px rgba(0,104,116,0.25)">
            ถัดไป
            <svg viewBox="0 0 256 256" fill="currentColor" style="width:16px;height:16px">
              <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>
            </svg>
          </button>
        }

        <!-- ── Step 3: ข้อมูลเพิ่มเติม ──────────────────────────────── -->
        @if (currentStep() === 3) {

          <!-- Plan type -->
          <div class="mb-5">
            <div class="text-[12px] font-bold mb-3 uppercase tracking-widest" style="color:#6b7a8d">ประเภทประกัน</div>
            <div class="flex flex-wrap gap-2">
              @for (pt of planTypeOptions; track pt.value) {
                <button (click)="selectedPlanType.set(selectedPlanType() === pt.value ? '' : pt.value)"
                        class="px-4 py-2 rounded-full text-[13px] font-bold transition-all"
                        [style]="selectedPlanType() === pt.value
                          ? 'background:#006874;color:#fff;box-shadow:0 2px 8px rgba(0,104,116,0.25)'
                          : 'background:#f0f4fd;color:#435d98;border:1.5px solid #e2e8f0'">
                  {{ pt.label }}
                </button>
              }
            </div>
            @if (!selectedPlanType()) {
              <p class="text-[11px] mt-2" style="color:#9aa5b4">ไม่เลือก = แสดงทุกประเภท</p>
            }
          </div>

          <!-- Repair type -->
          <div class="mb-5">
            <div class="text-[12px] font-bold mb-3 uppercase tracking-widest" style="color:#6b7a8d">ประเภทการซ่อม</div>
            <div class="flex gap-2">
              @for (rt of repairTypeOptions; track rt.value) {
                <button (click)="selectedRepairType.set(rt.value)"
                        class="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                        [style]="selectedRepairType() === rt.value
                          ? 'background:#006874;color:#fff;box-shadow:0 2px 8px rgba(0,104,116,0.2)'
                          : 'background:#f0f4fd;color:#435d98;border:1.5px solid #e2e8f0'">
                  {{ rt.label }}
                </button>
              }
            </div>
          </div>

          <!-- Province -->
          <div class="mb-5" style="border-top:1px solid #f0f4fd;padding-top:16px">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-[12px] font-bold uppercase tracking-widest" style="color:#6b7a8d">จังหวัดจดทะเบียน</span>
              <span class="text-[11px]" style="color:#9aa5b4">(ไม่บังคับ)</span>
              @if (selectedProvinceId()) {
                <button (click)="selectedProvinceId.set('')"
                        style="margin-left:auto;font-size:11px;color:#006874;font-weight:700;background:none;border:none;cursor:pointer;padding:0">ล้าง</button>
              }
            </div>
            <div class="grid gap-2" style="grid-template-columns:repeat(5,1fr)">
              @for (p of popularProvinces; track p.id) {
                <button class="brand-tile" [class.selected]="selectedProvinceId() === p.id" (click)="selectProvince(p.id)">
                  @if (selectedProvinceId() === p.id) {
                    <span class="check-badge">
                      <svg viewBox="0 0 20 20" fill="white" style="width:11px;height:11px">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                      </svg>
                    </span>
                  }
                  <span class="brand-name" style="font-size:12px;font-weight:700;white-space:normal;text-align:center;line-height:1.3;padding:8px 4px">{{ p.shortName }}</span>
                </button>
              }
              <button class="brand-tile" [class.selected]="isOtherProvince()" (click)="openProvinceDialog()">
                @if (isOtherProvince()) {
                  <span class="check-badge">
                    <svg viewBox="0 0 20 20" fill="white" style="width:11px;height:11px">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </span>
                  <span class="brand-name" style="font-size:11px;font-weight:700;white-space:normal;text-align:center;line-height:1.3;padding:8px 4px">{{ selectedProvinceId() }}</span>
                } @else {
                  <span class="brand-name" style="font-size:12px;font-weight:700;white-space:normal;text-align:center;line-height:1.3;padding:8px 4px">อื่น ๆ</span>
                }
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button (click)="goToStep(2)"
                    class="px-5 py-3.5 rounded-xl text-[13px] font-bold transition-all"
                    style="background:#f0f4fd;color:#435d98">
              ← ย้อนกลับ
            </button>
            <button (click)="onSearch()" [disabled]="!selectedModelId()"
                    class="flex-1 py-3.5 rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                    style="background:#006874;box-shadow:0 4px 16px rgba(0,104,116,0.3)">
              เช็คเบี้ยประกัน
              <svg viewBox="0 0 256 256" fill="currentColor" style="width:18px;height:18px">
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>
              </svg>
            </button>
          </div>
        }
      </div>

      <!-- ── Right sidebar ───────────────────────────────────────────── -->
      <div class="hidden md:flex flex-col gap-4">
        <div class="rounded-2xl overflow-hidden relative text-white"
             style="background:linear-gradient(150deg,#004d58,#006874 50%,#1a7a6e);min-height:200px;box-shadow:0 4px 20px rgba(0,104,116,0.3)">
          <div class="absolute inset-0 opacity-20"
               style="background:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><circle cx=%22150%22 cy=%2250%22 r=%22100%22 fill=%22%2349b2c1%22 opacity=%220.4%22/></svg>') center/cover"></div>
          <div class="relative p-5 flex flex-col justify-end" style="min-height:200px">
            <div class="mb-2">
              <span class="text-[10px] font-bold tracking-widest px-2 py-1 rounded" style="background:#f7941d;color:white">MEMBER EXCLUSIVE</span>
            </div>
            <div class="text-[18px] font-black leading-snug mb-1" style="font-family:'Plus Jakarta Sans',sans-serif">
              EV Insurance:<br>The Future is Here
            </div>
            <p class="text-[11px] leading-relaxed" style="color:rgba(255,255,255,0.75)">
              Specialized coverage for high-capacity battery units and specialized motors.
            </p>
          </div>
        </div>
        <div class="rounded-2xl p-5" style="background:#ffffff;box-shadow:0 2px 12px rgba(17,48,105,0.07)">
          <div class="text-[14px] font-extrabold mb-4" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">Need Assistance?</div>
          <div class="flex flex-col gap-4">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(246,146,29,0.1)">
                <svg viewBox="0 0 256 256" fill="#f7941d" style="width:16px;height:16px"><path d="M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.23.39-.47.57-.72a16,16,0,0,0,1.32-15.06l-.06-.13L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46Z"/></svg>
              </div>
              <div>
                <div class="text-[13px] font-bold" style="color:#171c22">24/7 Expert Chat</div>
                <div class="text-[11px]" style="color:#9aa5b4">Connect with our insurance advisors instantly.</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(0,104,116,0.08)">
                <svg viewBox="0 0 256 256" fill="#006874" style="width:16px;height:16px"><path d="M201.54,54.46A104,104,0,1,0,54.46,201.54,104,104,0,1,0,201.54,54.46ZM128,216a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a16,16,0,1,1,16,16A16,16,0,0,1,112,84Z"/></svg>
              </div>
              <div>
                <div class="text-[13px] font-bold" style="color:#171c22">Help Center</div>
                <div class="text-[11px]" style="color:#9aa5b4">Browse our comprehensive policy guide.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Recently Viewed ────────────────────────────────────────────── -->
    @if (recentVehicles().length > 0) {
      <div class="mt-10">
        <div class="text-[11px] font-bold tracking-widest uppercase mb-4" style="color:#9aa5b4">Recently Viewed Configurations</div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
          @for (v of recentVehicles(); track v.modelId) {
            <button (click)="loadRecent(v)" class="text-left rounded-xl p-4 transition-all active:scale-[0.98]"
                    style="background:#ffffff;border:1.5px solid #e8eef4;box-shadow:0 1px 6px rgba(17,48,105,0.05)">
              <div class="text-[11px] font-bold mb-1" style="color:#006874">{{ v.makeName }}</div>
              <div class="text-[15px] font-extrabold leading-snug mb-2" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
                {{ v.modelName }} {{ v.year ?? '' }}
              </div>
              <div class="text-[11px]" style="color:#9aa5b4">{{ v.subModel ?? 'All Variants' }}</div>
            </button>
          }
        </div>
      </div>
    }

  </div>
</div>

<!-- ── Province picker dialog ─────────────────────────────────────────────── -->
@if (showProvinceDialog()) {
  <div class="dlg-overlay" (click)="closeProvinceDialog()">
    <div class="dlg-card" (click)="$event.stopPropagation()">

      <!-- Dialog header -->
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid #f0f4fd">
        <div>
          <div class="text-[15px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">เลือกจังหวัดจดทะเบียน</div>
          <div class="text-[11px] mt-0.5" style="color:#9aa5b4">77 จังหวัดทั่วประเทศ</div>
        </div>
        <button (click)="closeProvinceDialog()"
                style="width:30px;height:30px;border-radius:8px;border:none;background:#f0f4fd;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7a8d;font-size:14px;font-weight:700">✕</button>
      </div>

      <!-- Search input -->
      <div class="px-5 py-3" style="border-bottom:1px solid #f7f9fc">
        <div style="position:relative">
          <svg viewBox="0 0 256 256" fill="#9aa5b4" style="width:15px;height:15px;position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none">
            <path d="M229.66,218.34l-50.07-50.06a88.21,88.21,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>
          </svg>
          <input class="dlg-search" type="text" placeholder="ค้นหาจังหวัด..."
                 [ngModel]="dialogProvinceSearch()" (ngModelChange)="dialogProvinceSearch.set($event)"/>
          @if (dialogProvinceSearch()) {
            <button (click)="dialogProvinceSearch.set('')"
                    style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9aa5b4;font-size:13px;font-weight:700;padding:0;line-height:1">✕</button>
          }
        </div>
      </div>

      <!-- Province list -->
      <div style="overflow-y:auto;flex:1">
        @if (provinceDialogResults().length === 0) {
          <div class="py-8 text-center text-[13px]" style="color:#b0b9c6">ไม่พบจังหวัดที่ค้นหา</div>
        } @else {
          @for (name of provinceDialogResults(); track name) {
            <button (click)="selectProvinceFromDialog(name)"
                    style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border:none;border-bottom:1px solid #f5f7fa;cursor:pointer;text-align:left;font-family:'Noto Sans Thai',sans-serif;transition:background .1s"
                    [style.background]="selectedProvinceId() === name ? '#e8f7f9' : '#fff'">
              <span style="font-size:14px;font-weight:600;"
                    [style.color]="selectedProvinceId() === name ? '#006874' : '#171c22'">{{ name }}</span>
              @if (selectedProvinceId() === name) {
                <svg viewBox="0 0 20 20" fill="#006874" style="width:16px;height:16px;flex-shrink:0">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              }
            </button>
          }
        }
      </div>

      <!-- Dialog footer -->
      <div class="px-5 py-3 flex justify-end gap-3" style="border-top:1px solid #f0f4fd">
        @if (selectedProvinceId()) {
          <button (click)="selectedProvinceId.set(''); closeProvinceDialog()"
                  style="padding:.5rem 1.25rem;border-radius:8px;border:1.5px solid #fde8e8;background:#fff5f5;font-size:13px;font-weight:600;color:#c0392b;cursor:pointer;font-family:'Noto Sans Thai',sans-serif">
            ล้างการเลือก
          </button>
        }
        <button (click)="closeProvinceDialog()"
                style="padding:.5rem 1.25rem;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;color:#6b7a8d;cursor:pointer;font-family:'Noto Sans Thai',sans-serif">
          ปิด
        </button>
      </div>

    </div>
  </div>
}

<!-- ── Brand picker dialog ────────────────────────────────────────────────── -->
@if (showBrandDialog()) {
  <div class="dlg-overlay" (click)="closeBrandDialog()">
    <div class="dlg-card" (click)="$event.stopPropagation()">

      <!-- Dialog header -->
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid #f0f4fd">
        <div>
          <div class="text-[15px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">เลือกยี่ห้อรถยนต์</div>
          <div class="text-[11px] mt-0.5" style="color:#9aa5b4">{{ makes().length }} ยี่ห้อในระบบ</div>
        </div>
        <button (click)="closeBrandDialog()"
                style="width:30px;height:30px;border-radius:8px;border:none;background:#f0f4fd;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7a8d;font-size:14px;font-weight:700">✕</button>
      </div>

      <!-- Search input -->
      <div class="px-5 py-3" style="border-bottom:1px solid #f7f9fc">
        <div style="position:relative">
          <svg viewBox="0 0 256 256" fill="#9aa5b4" style="width:15px;height:15px;position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none">
            <path d="M229.66,218.34l-50.07-50.06a88.21,88.21,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>
          </svg>
          <input class="dlg-search" type="text" placeholder="ค้นหายี่ห้อรถยนต์..."
                 [ngModel]="dialogSearch()" (ngModelChange)="dialogSearch.set($event)" #dlgInput/>
          @if (dialogSearch()) {
            <button (click)="dialogSearch.set('')"
                    style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9aa5b4;font-size:13px;font-weight:700;padding:0;line-height:1">✕</button>
          }
        </div>
      </div>

      <!-- Brand list -->
      <div style="overflow-y:auto;flex:1">
        @if (dialogResults().length === 0) {
          <div class="py-8 text-center text-[13px]" style="color:#b0b9c6">ไม่พบยี่ห้อที่ค้นหา</div>
        } @else {
          @for (m of dialogResults(); track m.id) {
            <button (click)="selectMakeFromDialog(m.id)"
                    style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border:none;border-bottom:1px solid #f5f7fa;cursor:pointer;text-align:left;font-family:'Noto Sans Thai',sans-serif;transition:background .1s"
                    [style.background]="selectedMakeId === m.id ? '#e8f7f9' : '#fff'">
              <span style="font-size:14px;font-weight:600;"
                    [style.color]="selectedMakeId === m.id ? '#006874' : '#171c22'">{{ m.name }}</span>
              @if (selectedMakeId === m.id) {
                <svg viewBox="0 0 20 20" fill="#006874" style="width:16px;height:16px;flex-shrink:0">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              }
            </button>
          }
        }
      </div>

      <!-- Dialog footer -->
      <div class="px-5 py-3 flex justify-end" style="border-top:1px solid #f0f4fd">
        <button (click)="closeBrandDialog()"
                style="padding:.5rem 1.25rem;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;color:#6b7a8d;cursor:pointer;font-family:'Noto Sans Thai',sans-serif">
          ปิด
        </button>
      </div>

    </div>
  </div>
}

<!-- ── Model picker dialog (step 2 "รุ่นอื่นๆ") ─────────────────────────── -->
@if (showModelDialog()) {
  <div class="dlg-overlay" (click)="closeModelDialog()">
    <div class="dlg-card" (click)="$event.stopPropagation()">

      <!-- Dialog header -->
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid #f0f4fd">
        <div>
          <div class="text-[15px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">เลือกรุ่นรถยนต์</div>
          <div class="text-[11px] mt-0.5" style="color:#9aa5b4">{{ modelGroups().length }} รุ่นในระบบ</div>
        </div>
        <button (click)="closeModelDialog()"
                style="width:30px;height:30px;border-radius:8px;border:none;background:#f0f4fd;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7a8d;font-size:14px;font-weight:700">✕</button>
      </div>

      <!-- Search input -->
      <div class="px-5 py-3" style="border-bottom:1px solid #f7f9fc">
        <div style="position:relative">
          <svg viewBox="0 0 256 256" fill="#9aa5b4" style="width:15px;height:15px;position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none">
            <path d="M229.66,218.34l-50.07-50.06a88.21,88.21,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>
          </svg>
          <input class="dlg-search" type="text" placeholder="ค้นหารุ่นรถ..."
                 [ngModel]="modelDialogSearch()" (ngModelChange)="modelDialogSearch.set($event)"/>
          @if (modelDialogSearch()) {
            <button (click)="modelDialogSearch.set('')"
                    style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9aa5b4;font-size:13px;font-weight:700;padding:0;line-height:1">✕</button>
          }
        </div>
      </div>

      <!-- Model list -->
      <div style="overflow-y:auto;flex:1">
        @if (modelDialogResults().length === 0) {
          <div class="py-8 text-center text-[13px]" style="color:#b0b9c6">ไม่พบรุ่นที่ค้นหา</div>
        } @else {
          @for (g of modelDialogResults(); track g.name) {
            <button (click)="selectModelFromDialog(g.name)"
                    style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border:none;border-bottom:1px solid #f5f7fa;cursor:pointer;text-align:left;font-family:'Noto Sans Thai',sans-serif;transition:background .1s"
                    [style.background]="selectedModelName() === g.name ? '#e8f7f9' : '#fff'">
              <span style="font-size:14px;font-weight:600;"
                    [style.color]="selectedModelName() === g.name ? '#006874' : '#171c22'">{{ g.name }}</span>
              @if (selectedModelName() === g.name) {
                <svg viewBox="0 0 20 20" fill="#006874" style="width:16px;height:16px;flex-shrink:0">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              }
            </button>
          }
        }
      </div>

      <!-- Dialog footer -->
      <div class="px-5 py-3 flex justify-end" style="border-top:1px solid #f0f4fd">
        <button (click)="closeModelDialog()"
                style="padding:.5rem 1.25rem;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;color:#6b7a8d;cursor:pointer;font-family:'Noto Sans Thai',sans-serif">
          ปิด
        </button>
      </div>

    </div>
  </div>
}
  `
})
export class SearchHomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly searchApi = inject(SearchApiService);
  private readonly prefs = inject(SearchPreferencesService);

  // ── Data signals ──────────────────────────────────────────────────────────
  makes = signal<VehicleMake[]>([]);
  models = signal<VehicleModel[]>([]);
  loadingModels = signal(false);
  recentVehicles = signal<RecentVehicle[]>([]);

  // ── Wizard state ──────────────────────────────────────────────────────────
  readonly currentStep = signal(1);
  readonly selectedPlanType = signal('');
  readonly selectedRepairType = signal('Garage');

  readonly steps = [
    { n: 1, label: 'เลือกยี่ห้อ' },
    { n: 2, label: 'รุ่นและปี' },
    { n: 3, label: 'ข้อมูลเพิ่มเติม' },
  ];

  readonly planTypeOptions = [
    { value: 'Type1',    label: 'ชั้น 1' },
    { value: 'Type2Plus', label: 'ชั้น 2+' },
    { value: 'Type2',    label: 'ชั้น 2' },
    { value: 'Type3Plus', label: 'ชั้น 3+' },
    { value: 'Type3',    label: 'ชั้น 3' },
  ];

  readonly repairTypeOptions = [
    { value: 'Garage', label: 'ซ่อมอู่' },
    { value: 'Dealer', label: 'ซ่อมศูนย์' },
  ];

  goToStep(n: number): void {
    if (this.canGoToStep(n)) this.currentStep.set(n);
  }

  canGoToStep(n: number): boolean {
    if (n === 1) return true;
    if (n === 2) return !!this.selectedMakeId;
    if (n === 3) return !!this.selectedMakeId && !!this.selectedModelId();
    return false;
  }

  selectMakeStep(makeId: string): void {
    this.selectMake(makeId);
    this.currentStep.set(2);
  }

  // ── Form state ────────────────────────────────────────────────────────────
  selectedMakeId = '';
  readonly selectedModelName = signal('');
  readonly selectedYear = signal(0);
  readonly selectedVariantId = signal('');
  readonly searchId = randomSearchId();

  // ── Brand search / dialog ─────────────────────────────────────────────────
  brandSearch = signal('');   // kept for any remaining references
  showBrandSearch = signal(false);
  showBrandDialog = signal(false);
  dialogSearch = signal('');

  // ── Province ──────────────────────────────────────────────────────────────
  readonly popularProvinces = POPULAR_PROVINCES;
  readonly selectedProvinceId = signal('');
  readonly showProvinceDialog = signal(false);
  readonly dialogProvinceSearch = signal('');

  readonly provinceDialogResults = computed(() => {
    const q = this.dialogProvinceSearch().toLowerCase().trim();
    if (!q) return ALL_PROVINCES;
    return ALL_PROVINCES.filter(p => p.toLowerCase().includes(q));
  });

  isOtherProvince(): boolean {
    const id = this.selectedProvinceId();
    return !!id && !POPULAR_PROVINCES.some(p => p.id === id);
  }

  selectProvince(id: string): void {
    this.selectedProvinceId.set(this.selectedProvinceId() === id ? '' : id);
  }

  openProvinceDialog(): void {
    this.dialogProvinceSearch.set('');
    this.showProvinceDialog.set(true);
  }

  closeProvinceDialog(): void {
    this.showProvinceDialog.set(false);
    this.dialogProvinceSearch.set('');
  }

  selectProvinceFromDialog(name: string): void {
    this.selectedProvinceId.set(name);
    this.closeProvinceDialog();
  }

  readonly popularMakes = computed(() => {
    const all = this.makes();
    return POPULAR_MAKE_NAMES
      .map(name => all.find(m => m.name.toLowerCase() === name.toLowerCase()))
      .filter((m): m is VehicleMake => m != null);
  });

  readonly brandSearchResults = computed(() => {
    const q = this.brandSearch().toLowerCase();
    if (!q) return this.makes();
    return this.makes().filter(m => m.name.toLowerCase().includes(q));
  });

  readonly dialogResults = computed(() => {
    const q = this.dialogSearch().toLowerCase().trim();
    if (!q) return this.makes();
    return this.makes().filter(m => m.name.toLowerCase().includes(q));
  });

  // ── Popular model tiles (step 2) ──────────────────────────────────────────
  /**
   * Returns up to 9 popular model tiles for the selected brand.
   * Matches entries from POPULAR_MODELS against the API model groups by name
   * (case-insensitive). Only includes models that exist in the database.
   *
   * To update popular models per brand, edit the POPULAR_MODELS constant above.
   */
  readonly popularModelTiles = computed(() => {
    const makeName = this.selectedMakeName().toLowerCase();
    const popularNames = POPULAR_MODELS[makeName] ?? [];
    const groups = this.modelGroups();
    return popularNames
      .map(popName => {
        const group = groups.find(g => g.name.toLowerCase() === popName.toLowerCase());
        return { name: popName, groupName: group?.name ?? null };
      })
      .filter((t): t is { name: string; groupName: string } => t.groupName !== null)
      .slice(0, 9);
  });

  // ── Model search dialog (step 2 "รุ่นอื่นๆ") ──────────────────────────────
  readonly showModelDialog = signal(false);
  readonly modelDialogSearch = signal('');
  readonly modelDialogResults = computed(() => {
    const q = this.modelDialogSearch().toLowerCase().trim();
    if (!q) return this.modelGroups();
    return this.modelGroups().filter(g => g.name.toLowerCase().includes(q));
  });

  isPopularModel(): boolean {
    const name = this.selectedModelName();
    return !!name && this.popularModelTiles().some(t => t.groupName === name);
  }

  openModelDialog(): void {
    this.modelDialogSearch.set('');
    this.showModelDialog.set(true);
  }

  closeModelDialog(): void {
    this.showModelDialog.set(false);
    this.modelDialogSearch.set('');
  }

  selectModelFromDialog(name: string): void {
    this.onModelChange(name);
    this.closeModelDialog();
  }

  // Expose module-level helpers to template
  readonly makeAbbr = makeAbbr;
  readonly makeLogo = (name: string) => MAKE_LOGO[name.toLowerCase()] ?? null;

  selectedMakeName(): string {
    return this.makes().find(m => m.id === this.selectedMakeId)?.name ?? '';
  }

  isPopularMake(): boolean {
    const name = this.selectedMakeName().toLowerCase();
    return POPULAR_MAKE_NAMES.some(n => n.toLowerCase() === name);
  }

  selectMake(makeId: string): void {
    this.selectedMakeId = makeId;
    this.showBrandSearch.set(false);
    this.brandSearch.set('');
    this.onMakeChange(makeId);
  }

  openBrandDialog(): void {
    this.dialogSearch.set('');
    this.showBrandDialog.set(true);
  }

  closeBrandDialog(): void {
    this.showBrandDialog.set(false);
    this.dialogSearch.set('');
  }

  selectMakeFromDialog(makeId: string): void {
    this.selectedMakeId = makeId;
    this.closeBrandDialog();
    this.onMakeChange(makeId);
    this.currentStep.set(2);
  }

  // ── Computed options ─────────────────────────────────────────────────────
  readonly modelGroups = computed(() => {
    const map = new Map<string, { name: string; umbrella?: VehicleModel; trims: VehicleModel[] }>();
    for (const m of this.models()) {
      const key = m.name.trim();
      if (!map.has(key)) map.set(key, { name: key, trims: [] });
      const g = map.get(key)!;
      if (!m.subModel) g.umbrella = m;
      else g.trims.push(m);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  private readonly selectedGroup = computed(() =>
    this.modelGroups().find(g => g.name === this.selectedModelName())
  );

  readonly yearOptions = computed<number[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const all = [...(g.umbrella ? [g.umbrella] : []), ...g.trims];
    const mins = all.map(m => m.minYear).filter((y): y is number => y != null);
    const maxs = all.map(m => m.maxYear).filter((y): y is number => y != null);
    if (mins.length === 0 || maxs.length === 0) return [];
    const lo = Math.min(...mins);   // smallest age → newest car
    const hi = Math.max(...maxs);   // largest age  → oldest car
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let age = lo; age <= hi; age++) years.push(currentYear - age);
    return years.sort((a, b) => b - a);
  });

  readonly variantOptions = computed(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const yr = this.selectedYear();
    const currentYear = new Date().getFullYear();

    const coversYear = (m: VehicleModel) => {
      if (!yr) return true;
      const newest = m.minYear != null ? currentYear - m.minYear : 9999;
      const oldest = m.maxYear != null ? currentYear - m.maxYear : 0;
      return yr <= newest && yr >= oldest;
    };

    let trims = g.trims.filter(coversYear);
    // Fallback: if year filter leaves nothing, show all trims
    if (yr && trims.length === 0) trims = g.trims;

    const opts: { id: string; label: string }[] = [];
    // Empty string = "All Variants" sentinel (maps to umbrella/first model in selectedModelId)
    opts.push({ id: '', label: 'All Variants' });
    for (const t of trims)
      opts.push({ id: t.id, label: [t.subModel, t.gearType].filter(Boolean).join(' · ') });
    return opts;
  });

  readonly selectedModelId = computed<string>(() => {
    const g = this.selectedGroup();
    if (!g) return '';
    // Specific trim selected
    if (this.selectedVariantId())
      return this.selectedVariantId();
    // "All Variants" (empty) → umbrella or first trim
    return g.umbrella?.id ?? g.trims[0]?.id ?? '';
  });

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchApi.getVehicleMakes().then(m => this.makes.set(m));
    this.recentVehicles.set(loadRecent());

    // Restore last selection
    const saved = this.prefs.load();
    if (saved?.makeId) {
      this.selectedMakeId = saved.makeId;
      this.loadModels(saved.makeId).then(() => {
        this.selectedModelName.set(saved.modelName ?? '');
        this.selectedYear.set(saved.vehicleYear ?? 0);
      });
    }
    if (saved?.province) {
      this.selectedProvinceId.set(saved.province);
    }
  }

  private async loadModels(makeId: string): Promise<void> {
    this.loadingModels.set(true);
    this.models.set([]);
    this.selectedModelName.set('');
    this.selectedYear.set(0);
    this.selectedVariantId.set('');
    try {
      this.models.set(await this.searchApi.getVehicleModels(makeId));
    } finally {
      this.loadingModels.set(false);
    }
  }

  onMakeChange(makeId: string): void {
    if (!makeId) { this.models.set([]); return; }
    this.loadModels(makeId);
  }

  onModelChange(name: string): void {
    this.selectedModelName.set(name);
    this.selectedYear.set(0);
    this.selectedVariantId.set('');
  }

  onSearch(): void {
    const modelId = this.selectedModelId();
    if (!modelId) return;

    const make = this.makes().find(m => m.id === this.selectedMakeId);
    const group = this.selectedGroup();
    const year = this.selectedYear() || undefined;
    const variantId = this.selectedVariantId();

    // Save to prefs
    this.prefs.save({
      makeId: this.selectedMakeId,
      makeName: make?.name ?? '',
      modelId,
      modelName: this.selectedModelName(),
      engineCC: undefined,
      gearType: undefined,
      allVariants: !variantId || undefined,   // true when "All Variants" selected
      vehicleYear: year,
      province: this.selectedProvinceId() || undefined,
      planType: this.selectedPlanType(),
      repairType: this.selectedRepairType(),
    });

    // Save to recently viewed
    saveRecent({
      makeId: this.selectedMakeId,
      makeName: make?.name ?? '',
      modelId,
      modelName: this.selectedModelName(),
      subModel: variantId
        ? group?.trims.find((m: VehicleModel) => m.id === variantId)?.subModel
        : undefined,
      year,
      gearType: undefined,
      savedAt: Date.now(),
    });

    this.router.navigate(['/search/results']);
  }

  loadRecent(v: RecentVehicle): void {
    this.prefs.save({
      makeId: v.makeId,
      makeName: v.makeName,
      modelId: v.modelId,
      modelName: v.modelName,
      vehicleYear: v.year,
      gearType: v.gearType,
      planType: '',
      repairType: 'Garage',
    });
    this.router.navigate(['/search/results']);
  }
}
