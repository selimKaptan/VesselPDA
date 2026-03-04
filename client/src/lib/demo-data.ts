export type DemoRole = "ship_agent" | "shipowner" | "ship_broker" | "ship_provider";

export const DEMO_ORG = {
  id: "demo-org-1",
  name: "Demo Shipping Co.",
  slug: "demo-shipping",
  plan: "standard",
};

export const DEMO_USERS: Record<DemoRole, { name: string; title: string }> = {
  ship_agent:    { name: "Alex Morgan",    title: "Port Agent"           },
  shipowner:     { name: "Nikos Papadopoulos", title: "Fleet Manager"  },
  ship_broker:   { name: "Sandra Chen",   title: "Commercial Manager"   },
  ship_provider: { name: "Mehmet Yilmaz", title: "Marine Services Mgr" },
};

export const DEMO_VESSELS = [
  { id: "dv1", name: "MV BLUE HORIZON",    imoNumber: "9876543", mmsi: "271000001", type: "Bulk Carrier",           flag: "Turkey",  dwt: 28500, grt: 16800, nrt: 9500,  loa: 185.0, beam: 30.0, draft: 11.2, yearBuilt: 2016, status: "in_port"  },
  { id: "dv2", name: "MV AEGEAN STAR",     imoNumber: "9876544", mmsi: "215000001", type: "General Cargo",          flag: "Malta",   dwt: 12800, grt: 8200,  nrt: 4900,  loa: 142.0, beam: 22.0, draft: 8.5,  yearBuilt: 2013, status: "at_sea"   },
  { id: "dv3", name: "MT BOSPHORUS",       imoNumber: "9876545", mmsi: "352000001", type: "Oil/Chemical Tanker",    flag: "Panama",  dwt: 45000, grt: 28000, nrt: 16000, loa: 210.0, beam: 32.2, draft: 13.0, yearBuilt: 2018, status: "at_sea"   },
  { id: "dv4", name: "MV ANATOLIAN PRIDE", imoNumber: "9876546", mmsi: "271000002", type: "Container",             flag: "Turkey",  dwt: 18500, grt: 14200, nrt: 8400,  loa: 175.0, beam: 27.0, draft: 10.1, yearBuilt: 2015, status: "in_port"  },
  { id: "dv5", name: "TUG MARMARA",        imoNumber: "9876547", mmsi: "271000003", type: "Tug",                   flag: "Turkey",  dwt: 850,   grt: 620,   nrt: 186,   loa: 32.0,  beam: 10.5, draft: 4.2,  yearBuilt: 2019, status: "in_port"  },
];

export const DEMO_PORTS = [
  { id: "dp1", name: "Istanbul (Ambarlı)",  locode: "TRAMS", country: "Turkey",  lat: 40.9923, lng: 28.6614 },
  { id: "dp2", name: "Istanbul (Haydarpaşa)", locode: "TRHAY", country: "Turkey", lat: 40.9985, lng: 29.0200 },
  { id: "dp3", name: "Mersin",              locode: "TRMRS", country: "Turkey",  lat: 36.8042, lng: 34.6417 },
  { id: "dp4", name: "Izmir (Alsancak)",    locode: "TRIZM", country: "Turkey",  lat: 38.4189, lng: 27.1287 },
  { id: "dp5", name: "Iskenderun",          locode: "TRISK", country: "Turkey",  lat: 36.5883, lng: 36.1656 },
  { id: "dp6", name: "Gemlik",              locode: "TRGEM", country: "Turkey",  lat: 40.4336, lng: 29.1592 },
  { id: "dp7", name: "Piraeus",             locode: "GRPIR", country: "Greece",  lat: 37.9475, lng: 23.6382 },
];

export const DEMO_VOYAGES = [
  {
    id: "dvoy1",
    voyageNumber: "VY-DEMO-001",
    vesselId: "dv1",
    vesselName: "MV BLUE HORIZON",
    status: "in_progress",
    cargoType: "Wheat",
    cargoQuantity: 25000,
    cargoUnit: "MT",
    charterer: "Aegean Grain Trading SA",
    startDate: "2024-03-08",
    endDate: "2024-04-15",
    portCalls: [
      { id: "dpc1", portName: "Istanbul (Ambarlı)", locode: "TRAMS", status: "completed",  eta: "2024-03-10", etd: "2024-03-12", purpose: "Loading"       },
      { id: "dpc2", portName: "Mersin",             locode: "TRMRS", status: "berthed",    eta: "2024-03-18", etd: "2024-03-22", purpose: "Discharging"   },
      { id: "dpc3", portName: "Piraeus",            locode: "GRPIR", status: "planned",    eta: "2024-03-28", etd: "2024-03-31", purpose: "Transhipment"  },
    ],
    expenses: { budget: 16000, actual: 15800 },
  },
  {
    id: "dvoy2",
    voyageNumber: "VY-DEMO-002",
    vesselId: "dv3",
    vesselName: "MT BOSPHORUS",
    status: "in_progress",
    cargoType: "Fuel Oil",
    cargoQuantity: 40000,
    cargoUnit: "MT",
    charterer: "MedOil Trading Ltd",
    startDate: "2024-03-14",
    endDate: "2024-03-25",
    portCalls: [
      { id: "dpc4", portName: "Izmir (Alsancak)", locode: "TRIZM", status: "completed",  eta: "2024-03-14", etd: "2024-03-16", purpose: "Loading"     },
      { id: "dpc5", portName: "Iskenderun",       locode: "TRISK", status: "approaching", eta: "2024-03-20", etd: "2024-03-24", purpose: "Discharging" },
    ],
    expenses: { budget: 9500, actual: 0 },
  },
  {
    id: "dvoy3",
    voyageNumber: "VY-DEMO-003",
    vesselId: "dv2",
    vesselName: "MV AEGEAN STAR",
    status: "completed",
    cargoType: "Steel Coils",
    cargoQuantity: 8000,
    cargoUnit: "MT",
    charterer: "North Africa Steel",
    startDate: "2024-02-15",
    endDate: "2024-03-05",
    portCalls: [
      { id: "dpc6", portName: "Gemlik",            locode: "TRGEM", status: "completed", eta: "2024-02-15", etd: "2024-02-18", purpose: "Loading"     },
      { id: "dpc7", portName: "Istanbul (Ambarlı)", locode: "TRAMS", status: "completed", eta: "2024-02-26", etd: "2024-03-01", purpose: "Discharging" },
    ],
    expenses: { budget: 11200, actual: 10950 },
  },
];

export const DEMO_PROFORMAS = [
  { id: "prf1", referenceNumber: "PRF-DEMO-001", vesselName: "MV BLUE HORIZON",    portName: "Istanbul (Ambarlı)", purpose: "Loading",     totalAmount: 18500, currency: "USD", status: "approved", createdAt: "2024-03-08", days: 4 },
  { id: "prf2", referenceNumber: "PRF-DEMO-002", vesselName: "MV BLUE HORIZON",    portName: "Mersin",             purpose: "Discharging", totalAmount: 14200, currency: "USD", status: "sent",     createdAt: "2024-03-12", days: 3 },
  { id: "prf3", referenceNumber: "PRF-DEMO-003", vesselName: "MT BOSPHORUS",       portName: "Iskenderun",         purpose: "Discharging", totalAmount: 22800, currency: "USD", status: "draft",    createdAt: "2024-03-14", days: 5 },
  { id: "prf4", referenceNumber: "PRF-DEMO-004", vesselName: "MV AEGEAN STAR",     portName: "Istanbul (Ambarlı)", purpose: "Discharging", totalAmount: 16100, currency: "USD", status: "approved", createdAt: "2024-02-26", days: 3 },
  { id: "prf5", referenceNumber: "PRF-DEMO-005", vesselName: "MV ANATOLIAN PRIDE", portName: "Izmir (Alsancak)",   purpose: "Loading",     totalAmount: 19500, currency: "USD", status: "sent",     createdAt: "2024-03-16", days: 4 },
];

export const DEMO_FINAL_DA = {
  id: "fda1",
  referenceNumber: "FDA-DEMO-001",
  voyageId: "dvoy3",
  vesselName: "MV AEGEAN STAR",
  portName: "Istanbul (Ambarlı)",
  proformaAmount: 16100,
  actualAmount: 15850,
  variance: -250,
  variancePct: -1.6,
  status: "reconciled",
  items: [
    { description: "Pilotage",    proforma: 2800, actual: 2650, variance: -150 },
    { description: "Tugboat",     proforma: 3200, actual: 3400, variance:  200 },
    { description: "Agency Fee",  proforma: 4500, actual: 4200, variance: -300 },
    { description: "Port Dues",   proforma: 3100, actual: 3100, variance:    0 },
    { description: "Mooring",     proforma: 2500, actual: 2500, variance:    0 },
  ],
};

export const DEMO_TENDERS = [
  { id: "tnd1", title: "MV BLUE HORIZON — Mersin Loading", portName: "Mersin",             vesselName: "MV BLUE HORIZON", eta: "2024-03-18", status: "open",    bidsCount: 2, budget: 18000, purpose: "Loading"    },
  { id: "tnd2", title: "MT BOSPHORUS — Iskenderun Disch.",  portName: "Iskenderun",         vesselName: "MT BOSPHORUS",    eta: "2024-03-20", status: "open",    bidsCount: 0, budget: 25000, purpose: "Discharging"},
  { id: "tnd3", title: "MV AEGEAN STAR — Istanbul Agency",  portName: "Istanbul (Ambarlı)", vesselName: "MV AEGEAN STAR",  eta: "2024-02-26", status: "awarded", bidsCount: 4, budget: 20000, purpose: "Discharging"},
];

export const DEMO_SOF_EVENTS = [
  { id: "sof1",  portCallId: "dpc1", eventTime: "2024-03-10T06:00:00", eventType: "VESSEL_ARRIVED",      description: "Vessel arrived at Istanbul Ambarlı pilot station",        isKeyEvent: true },
  { id: "sof2",  portCallId: "dpc1", eventTime: "2024-03-10T06:30:00", eventType: "NOR_TENDERED",        description: "Notice of Readiness tendered",                            isKeyEvent: true },
  { id: "sof3",  portCallId: "dpc1", eventTime: "2024-03-10T07:00:00", eventType: "NOR_ACCEPTED",        description: "Notice of Readiness accepted by charterer",               isKeyEvent: true },
  { id: "sof4",  portCallId: "dpc1", eventTime: "2024-03-10T08:00:00", eventType: "FREE_PRATIQUE",       description: "Free pratique granted by health authorities",             isKeyEvent: false },
  { id: "sof5",  portCallId: "dpc1", eventTime: "2024-03-10T10:00:00", eventType: "BERTHED",             description: "Vessel all fast at berth 3A, Ambarlı Terminal",           isKeyEvent: true },
  { id: "sof6",  portCallId: "dpc1", eventTime: "2024-03-10T10:30:00", eventType: "HATCH_OPEN",          description: "All hatches opened for loading inspection",               isKeyEvent: false },
  { id: "sof7",  portCallId: "dpc1", eventTime: "2024-03-10T11:00:00", eventType: "LOADING_COMMENCED",   description: "Loading operations commenced — 25,000 MT wheat",          isKeyEvent: true },
  { id: "sof8",  portCallId: "dpc1", eventTime: "2024-03-10T14:00:00", eventType: "RAIN_STARTED",        description: "Loading suspended due to rain — weather interruption",    isKeyEvent: false },
  { id: "sof9",  portCallId: "dpc1", eventTime: "2024-03-10T15:30:00", eventType: "RAIN_STOPPED",        description: "Rain stopped, loading resumed",                           isKeyEvent: false },
  { id: "sof10", portCallId: "dpc1", eventTime: "2024-03-11T18:00:00", eventType: "LOADING_COMPLETED",   description: "Loading completed — 25,000 MT wheat on board",            isKeyEvent: true },
  { id: "sof11", portCallId: "dpc1", eventTime: "2024-03-11T18:30:00", eventType: "HATCH_CLOSED",        description: "All hatches closed and secured",                          isKeyEvent: false },
  { id: "sof12", portCallId: "dpc1", eventTime: "2024-03-11T20:00:00", eventType: "DOCS_ON_BOARD",       description: "All original documents on board",                         isKeyEvent: false },
  { id: "sof13", portCallId: "dpc1", eventTime: "2024-03-11T21:00:00", eventType: "UNBERTHED",           description: "Vessel unberthed from berth 3A",                          isKeyEvent: true },
  { id: "sof14", portCallId: "dpc1", eventTime: "2024-03-11T22:00:00", eventType: "VESSEL_SAILED",       description: "Vessel sailed from Istanbul Ambarlı — bound for Mersin",  isKeyEvent: true },
];

export const DEMO_FIXTURES = [
  { id: "fix1", referenceNumber: "FIX-DEMO-001", vesselName: "MV BLUE HORIZON", charterType: "Voyage Charter", route: "Istanbul – Mersin – Piraeus", cargo: "Wheat 25,000 MT", freightRate: "$18/MT", status: "fixed",       charterer: "Aegean Grain Trading SA" },
  { id: "fix2", referenceNumber: "FIX-DEMO-002", vesselName: "MT BOSPHORUS",   charterType: "Voyage Charter", route: "Izmir – Iskenderun",           cargo: "Fuel Oil 40,000 MT", freightRate: "$12/MT", status: "negotiating", charterer: "MedOil Trading Ltd"      },
];

export const DEMO_CARGO_POSITIONS = [
  { id: "cp1", cargoType: "Wheat",      quantity: "30,000 MT", route: "Black Sea → East Med",  laycan: "+15 days",  status: "open", contact: "trader@aegeangrain.com"  },
  { id: "cp2", cargoType: "Steel Coils", quantity: "8,000 MT", route: "Marmara → North Africa", laycan: "+20 days", status: "open", contact: "cargo@northafricasteel.com" },
];

export const DEMO_BUNKER = {
  rob: { VLSFO: 120, IFO380: 450, MGO: 35 },
  lastBunkering: { port: "Istanbul (Ambarlı)", quantity: 200, fuelType: "VLSFO", pricePerMt: 620, totalCost: 124000, date: "2024-03-10" },
  consumption: { seagoing: 28, inPort: 3 },
  records: [
    { id: "bk1", vesselName: "MV BLUE HORIZON", port: "Istanbul (Ambarlı)", fuelType: "VLSFO",  quantity: 200, pricePerMt: 620, totalCost: 124000, date: "2024-03-10" },
    { id: "bk2", vesselName: "MV BLUE HORIZON", port: "Mersin",             fuelType: "IFO380", quantity: 180, pricePerMt: 480, totalCost: 86400,  date: "2024-02-20" },
    { id: "bk3", vesselName: "MT BOSPHORUS",    port: "Izmir (Alsancak)",   fuelType: "VLSFO",  quantity: 350, pricePerMt: 615, totalCost: 215250, date: "2024-03-14" },
  ],
};

export const DEMO_COMPLIANCE = {
  id: "dc1",
  vesselId: "dv1",
  vesselName: "MV BLUE HORIZON",
  standardCode: "ISM",
  standardName: "ISM Code",
  totalItems: 40,
  completedItems: 30,
  compliancePct: 75,
  status: "in_progress",
  lastAuditDate: "2023-09-15",
  nextAuditDate: "2024-09-15",
  auditorName: "Capt. James Reid (DNV GL)",
  openFindings: [
    { id: "f1", section: "Section 9", finding: "Emergency drill records incomplete", type: "observation",      dueDate: "2024-04-30" },
    { id: "f2", section: "Section 10", finding: "Maintenance log update needed",      type: "non_conformity", dueDate: "2024-03-31" },
  ],
};

export const DEMO_VOYAGE_EXPENSES = [
  { id: "ve1", voyageId: "dvoy1", category: "Port Charges",  description: "Port dues & fees",    budget: 5000, actual: 4800 },
  { id: "ve2", voyageId: "dvoy1", category: "Agency Fee",    description: "Port agent services", budget: 4500, actual: 4500 },
  { id: "ve3", voyageId: "dvoy1", category: "Pilotage",      description: "Pilot fees",          budget: 3000, actual: 2800 },
  { id: "ve4", voyageId: "dvoy1", category: "Tugboat",       description: "Towage services",     budget: 3500, actual: 3700 },
];

export const DEMO_MESSAGES = [
  { id: "msg1", parties: ["demo-agent", "demo-owner"],    subject: "MV BLUE HORIZON — Mersin ETA Update",    lastMessage: "ETA confirmed: 18 March 06:00 LT. Berth available.",    time: "10:24", unread: 2 },
  { id: "msg2", parties: ["demo-broker", "demo-agent"],   subject: "Iskenderun proforma request — MT BOSPHORUS", lastMessage: "Please share proforma draft for 5 days stay.",         time: "09:15", unread: 1 },
  { id: "msg3", parties: ["demo-owner", "demo-provider"], subject: "Mersin — crane rental inquiry",             lastMessage: "We can provide 2 cranes at 80T SWL. Available from 18th.", time: "Yst",   unread: 0 },
];

export const DEMO_REMINDERS = [
  { id: "rem1", title: "MT BOSPHORUS — Iskenderun ETA 6 hours",  priority: "urgent", type: "eta",        dueIn: "6 hours"  },
  { id: "rem2", title: "PRF-DEMO-003 pending approval",           priority: "normal", type: "proforma",   dueIn: "2 days"   },
  { id: "rem3", title: "ISM compliance 75% — incomplete sections", priority: "high",   type: "compliance", dueIn: "10 days"  },
];

export const DEMO_STATS = {
  totalVessels:  DEMO_VESSELS.length,
  activeVoyages: DEMO_VOYAGES.filter(v => v.status === "in_progress").length,
  openTenders:   DEMO_TENDERS.filter(t => t.status === "open").length,
  totalProformas: DEMO_PROFORMAS.length,
  fleetDwt:      DEMO_VESSELS.reduce((s, v) => s + v.dwt, 0),
};

export const ROLE_FEATURES: Record<DemoRole, { title: string; subtitle: string; description: string; color: string; features: string[] }> = {
  ship_agent: {
    title: "Ship Agent",
    subtitle: "Liman acentesi olarak deneyin",
    description: "Liman operasyonlarını yönetin, proforma DA hazırlayın ve seferleri koordine edin.",
    color: "blue",
    features: [
      "Sefer yönetimi ve SOF kaydı",
      "Proforma DA hesaplama",
      "Doküman oluşturma (B/L, Manifest)",
      "Tender'lara teklif verme",
      "Final DA & mutabakat",
    ],
  },
  shipowner: {
    title: "Shipowner",
    subtitle: "Armatör olarak deneyin",
    description: "Filonuzu takip edin, bunker yönetin ve seferlerinizi izleyin.",
    color: "green",
    features: [
      "Filo takibi ve harita",
      "Bunker yönetimi",
      "Fixture ve kiralama",
      "Compliance (ISM/ISPS)",
      "Sefer masrafları",
    ],
  },
  ship_broker: {
    title: "Ship Broker",
    subtitle: "Broker olarak deneyin",
    description: "Çarterler yönetin, kargo pozisyonlarını takip edin ve piyasa verilerini izleyin.",
    color: "orange",
    features: [
      "Fixture ve cargo pozisyon",
      "Filo ve gemi yönetimi",
      "Piyasa verileri (BDI/BDTI)",
      "Tender ve nomination",
      "Müşteri portföy yönetimi",
    ],
  },
  ship_provider: {
    title: "Ship Provider",
    subtitle: "Servis sağlayıcı olarak deneyin",
    description: "Hizmet taleplerine teklif verin, faturalarınızı takip edin ve portföyünüzü yönetin.",
    color: "purple",
    features: [
      "Gelen hizmet talepleri",
      "Teklif verme ve müzakere",
      "Faturalama ve takip",
      "Liman hizmetleri yönetimi",
      "Performans istatistikleri",
    ],
  },
};

export const TOUR_STEPS: Record<DemoRole, { title: string; desc: string; highlight: string }[]> = {
  ship_agent: [
    { title: "Dashboard", desc: "Aktif seferleriniz ve bekleyen işleriniz burada — tek bakışta tüm operasyonlarınız.", highlight: "stats" },
    { title: "Voyages — SOF Kaydı", desc: "Seferleri buradan yönetin. VY-DEMO-001'de tam SOF kaydı örneği var.", highlight: "voyages" },
    { title: "Quick Proforma", desc: "Liman masrafını anında hesaplayın — 2026 resmi Türk tarifeleri otomatik uygulanır.", highlight: "proformas" },
    { title: "Tenders", desc: "Armatörlerden gelen proforma taleplerini buradan görün ve teklif verin.", highlight: "tenders" },
  ],
  shipowner: [
    { title: "Dashboard", desc: "Filonuzun durumu ve harita burada — anlık konumlar ve alarm durumları.", highlight: "stats" },
    { title: "Fleet — Gemi Takibi", desc: "Gemilerinizi takip edin. MT BOSPHORUS Iskenderun'a yaklaşıyor — 6 saat sonra ETA.", highlight: "vessels" },
    { title: "Fixtures & Bunker", desc: "Charter party'lerinizi ve bunker tüketiminizi buradan yönetin.", highlight: "fixtures" },
    { title: "Tenders — Proforma İsteyin", desc: "Acentelerden proforma isteyin, karşılaştırın ve en uygun teklifi seçin.", highlight: "tenders" },
  ],
  ship_broker: [
    { title: "Dashboard", desc: "Yönettiğiniz filonun durumu — aktif seferler ve açık pozisyonlar.", highlight: "stats" },
    { title: "Fixtures & Cargo", desc: "Charter party ve cargo pozisyonları — FIX-DEMO-001 aktif örnek.", highlight: "fixtures" },
    { title: "Fleet — Gemi Konumu", desc: "Gemilerin konumu ve bunker durumu — anlık takip.", highlight: "vessels" },
    { title: "Piyasa Verileri", desc: "Freight indeksleri ve bunker fiyatları — karar desteği için gerçek zamanlı veri.", highlight: "market" },
  ],
  ship_provider: [
    { title: "Dashboard", desc: "Gelen talepler ve performansınız — bekleyen teklifler ve kazanılan işler.", highlight: "stats" },
    { title: "Service Requests", desc: "Talepleri görün ve teklif verin — TND-DEMO-002 aktif tender bekliyor.", highlight: "tenders" },
    { title: "Invoices", desc: "Faturalarınızı oluşturun ve ödeme takibini yapın.", highlight: "proformas" },
    { title: "Service Ports", desc: "Hizmet verdiğiniz limanları ve kapsam bölgelerinizi yönetin.", highlight: "ports" },
  ],
};
