// ============================================================================
// PROFORMA HESAPLAMA MOTORU - TypeScript Tipleri
// ============================================================================

// --- GİRDİ ---

export interface ProformaInput {
  // Terminal
  terminalCode: string;          // 'TUPRAS_ALIAGA', 'CEYPORT_TEKIRDAG' vb.
  
  // Gemi Bilgileri
  vesselName: string;            // 'M/T ALSU'
  nrt: number;                   // Net Registered Tonnage
  grt: number;                   // Gross Registered Tonnage
  flagCategory: FlagCategory;    // 'TURK' | 'YABANCI' | 'KABOTAJ'
  flagCode?: string;             // 'TR', 'MT', 'PA' vb.
  
  // Yük Bilgileri
  cargoTypeCode: string;         // 'SFS_OIL'
  cargoQuantity: number;         // 3001
  isDangerousCargo: boolean;     // true
  callPurpose: CallPurpose;      // 'DISCHARGING'
  
  // Süre
  estBerthStay: number;          // 4 (gün)
  estAnchorageDays: number;      // 0
  
  // Fener & VTS bayrak bilgisi (bazı gemiler için farklı olabilir)
  lightDuesFlagCategory?: FlagCategory;
  vtsFlagCategory?: FlagCategory;
  dtoFlagCategory?: FlagCategory;   // 'TURK' veya başlangıçtaki değer
  
  // Barınma bayrak bilgisi
  wharfageFlagCategory?: FlagCategory;
  
  // Alıcı
  addressedTo?: string;          // 'CHEMTANKERS SHIPPING SA'
  
  // Döviz (opsiyonel - belirtilmezse güncel kur alınır)
  exchangeRates?: ExchangeRates;
}

export type FlagCategory = 'TURK' | 'YABANCI' | 'KABOTAJ';
export type CallPurpose = 'DISCHARGING' | 'LOADING' | 'LOADING_DISCHARGING' | 'TRANSIT' | 'BUNKERING' | 'STS' | 'REPAIR' | 'SHELTER';

export interface ExchangeRates {
  usdTry: number;    // 43.92
  eurTry: number;    // 51.4158
  eurUsd: number;    // 1.177285
}

// --- HESAPLAMA YÖNTEMLERİ ---

export type CalcMethod = 
  | 'TIERED_GRT'      // GRT bazlı kademe (kılavuzluk, römorkör, palamar)
  | 'TIERED_NRT'      // NRT bazlı kademe (fener, VTS, DTO, acente)
  | 'TIERED_CARGO'    // Yük bazlı kademe (gümrük, DTO hasılat)
  | 'NRT_FACTOR'      // NRT × katsayı (sağlık resmi)
  | 'GRT_DAILY'       // GRT × gün (barınma)
  | 'CARGO_FACTOR'    // Yük × katsayı (süpervizyon)
  | 'FIXED_USD'       // Sabit USD
  | 'FIXED_EUR'       // Sabit EUR
  | 'FIXED_TL'        // Sabit TL
  | 'GRT_PERCENT'     // GRT × yüzde (oto servis)
  | 'FORMULA';        // Özel formül (LÇB, demirleme)

// --- TARİFE KADEME ---

export interface RateTier {
  minValue: number;
  maxValue: number | null;
  baseRate?: number;
  perUnitRate?: number;
  unitSize?: number;            // Varsayılan 1000
  rateTurk?: number;
  rateYabanci?: number;
  rateKabotaj?: number;
  rateImport?: number;
  rateExport?: number;
}

// --- TERMİNAL KONFİG ---

export interface TerminalConfig {
  name: string;
  port: string;
  displayTitle: string;
  items: TerminalItemConfig[];
  fixedExpenses: Record<string, { amount: number; currency: string }>;
  specialRules: Record<string, string>;
}

export interface TerminalItemConfig {
  category: TariffCategoryCode;
  enabled: boolean;
  sort: number;
  rule?: string;
  note?: string;
  overrideFixedUsd?: number;
}

export type TariffCategoryCode = 
  | 'PILOTAGE' | 'TUGBOAT' | 'MOORING' | 'PELIKAN_PASSAGE'
  | 'WHARFAGE' | 'GARBAGE' | 'OTO_SERVICE' | 'HARBOUR_MASTER'
  | 'SANITARY' | 'LIGHT_DUES' | 'VTS' | 'CUSTOMS' | 'ANCHORAGE'
  | 'DTO_FEE' | 'DTO_FREIGHT' | 'VDA_FEE'
  | 'MOTORBOAT' | 'FACILITIES' | 'TRANSPORTATION'
  | 'FISCAL_NOTARY' | 'COMMUNICATION'
  | 'SUPERVISION' | 'AGENCY_FEE';

// --- ÇIKTI ---

export interface ProformaResult {
  // Meta
  refNo: string;
  proformaDate: string;
  terminalCode: string;
  terminalName: string;
  portName: string;
  displayTitle: string;
  
  // Gemi
  vesselName: string;
  nrt: number;
  grt: number;
  flagCategory: FlagCategory;
  
  // Yük
  cargoType: string;
  cargoQuantity: number;
  callPurpose: string;
  estBerthStay: number;
  
  // Alıcı
  addressedTo: string;
  
  // Döviz
  exchangeRates: ExchangeRates;
  
  // Kalemler
  items: ProformaItemResult[];
  
  // Toplamlar
  totalUsd: number;
  totalEur: number;
}

export interface ProformaItemResult {
  category: TariffCategoryCode;
  displayName: string;
  displayNote?: string;
  amountUsd: number;
  amountEur: number;
  sortOrder: number;
  calcDetails: CalcDetails;
}

export interface CalcDetails {
  method: CalcMethod;
  basis?: string;                // 'GRT', 'NRT', 'CARGO_QTY'
  basisValue?: number;           // 2298, 1004, 3001
  currency: string;              // 'USD', 'EUR', 'TRY'
  rawAmountInCurrency: number;   // Orijinal döviz cinsinden hesap
  conversionRate?: number;       // USD'ye çevirme kuru
  tiersUsed?: number;
  multiplier?: number;
  dangerousSurcharge?: number;
  flagCategory?: FlagCategory;
  description: string;           // İnsan okunabilir açıklama
}

// --- HESAPLAMA FONKSİYON TİPLERİ ---

export interface CalcContext {
  input: ProformaInput;
  rates: ExchangeRates;
  terminalConfig: TerminalConfig;
}

export type CalculatorFn = (ctx: CalcContext) => ProformaItemResult | null;

// Hesaplama fonksiyonları registry
export type CalculatorRegistry = Record<TariffCategoryCode, CalculatorFn>;
