export type DemoRole = "agent" | "shipowner" | "admin";

export const DEMO_ORG = {
  id: "demo-org-1",
  name: "Demo Shipping Co.",
  slug: "demo-shipping",
  plan: "standard",
};

export const DEMO_VESSELS = [
  { id: "dv1", name: "MV BLUE HORIZON", imoNumber: "9234567", type: "bulk_carrier", flag: "Marshall Islands", grt: 28500, nrt: 16200, dwt: 52000, loa: 189.9, beam: 32.2, draft: 12.1, yearBuilt: 2015, status: "at_sea" },
  { id: "dv2", name: "MV AEGEAN STAR", imoNumber: "9345678", type: "container", flag: "Panama", grt: 35200, nrt: 19400, dwt: 42000, loa: 220.0, beam: 32.2, draft: 11.5, yearBuilt: 2018, status: "in_port" },
  { id: "dv3", name: "MT BOSPHORUS", imoNumber: "9456789", type: "tanker", flag: "Malta", grt: 62100, nrt: 36800, dwt: 115000, loa: 243.0, beam: 42.0, draft: 14.8, yearBuilt: 2012, status: "at_anchor" },
  { id: "dv4", name: "MV ANATOLIAN PRIDE", imoNumber: "9567890", type: "general_cargo", flag: "Turkey", grt: 8400, nrt: 4900, dwt: 12500, loa: 127.5, beam: 19.4, draft: 7.8, yearBuilt: 2009, status: "in_port" },
  { id: "dv5", name: "TUG MARMARA", imoNumber: "9678901", type: "tug", flag: "Turkey", grt: 520, nrt: 156, dwt: 450, loa: 32.0, beam: 10.5, draft: 4.2, yearBuilt: 2019, status: "in_port" },
];

export const DEMO_PORTS = [
  { id: "dp1", name: "Istanbul (Ambarlı)", locode: "TRAMS", country: "Turkey", lat: 40.9923, lng: 28.6614, timezone: "Europe/Istanbul" },
  { id: "dp2", name: "Mersin", locode: "TRMRS", country: "Turkey", lat: 36.8042, lng: 34.6417, timezone: "Europe/Istanbul" },
  { id: "dp3", name: "Izmir", locode: "TRIZM", country: "Turkey", lat: 38.4189, lng: 27.1287, timezone: "Europe/Istanbul" },
];

export const DEMO_VOYAGES = [
  {
    id: "dvoy1",
    voyageNumber: "VOY-2026-001",
    vesselId: "dv1",
    vesselName: "MV BLUE HORIZON",
    status: "in_progress",
    cargoType: "Wheat",
    cargoQuantity: 42000,
    cargoUnit: "MT",
    charterer: "Aegean Grain Trading",
    startDate: "2026-02-10",
    endDate: "2026-03-15",
    portCalls: [
      { id: "dpc1", portName: "Istanbul (Ambarlı)", locode: "TRAMS", status: "completed", eta: "2026-02-12", etd: "2026-02-16", purpose: "Loading" },
      { id: "dpc2", portName: "Mersin", locode: "TRMRS", status: "berthed", eta: "2026-02-20", etd: "2026-02-25", purpose: "Discharging" },
      { id: "dpc3", portName: "Izmir", locode: "TRIZM", status: "planned", eta: "2026-03-01", etd: "2026-03-05", purpose: "Bunkering" },
    ],
    totalExpenses: 284500,
    budgetExpenses: 310000,
  },
  {
    id: "dvoy2",
    voyageNumber: "VOY-2026-002",
    vesselId: "dv2",
    vesselName: "MV AEGEAN STAR",
    status: "planned",
    cargoType: "General Cargo",
    cargoQuantity: 28000,
    cargoUnit: "MT",
    charterer: "Marmara Logistics",
    startDate: "2026-03-01",
    endDate: "2026-04-10",
    portCalls: [
      { id: "dpc4", portName: "Izmir", locode: "TRIZM", status: "planned", eta: "2026-03-05", etd: "2026-03-09", purpose: "Loading" },
      { id: "dpc5", portName: "Mersin", locode: "TRMRS", status: "planned", eta: "2026-03-14", etd: "2026-03-18", purpose: "Discharging" },
    ],
    totalExpenses: 0,
    budgetExpenses: 195000,
  },
];

export const DEMO_PROFORMAS = [
  { id: "dp1", referenceNumber: "PF-2026-0031", vesselName: "MV BLUE HORIZON", portName: "Istanbul (Ambarlı)", purpose: "Discharging", totalAmount: 48250, currency: "USD", status: "approved", createdAt: "2026-02-10", days: 4 },
  { id: "dp2", referenceNumber: "PF-2026-0032", vesselName: "MT BOSPHORUS", portName: "Mersin", purpose: "Loading", totalAmount: 92400, currency: "USD", status: "sent", createdAt: "2026-02-14", days: 6 },
  { id: "dp3", referenceNumber: "PF-2026-0033", vesselName: "MV AEGEAN STAR", portName: "Izmir", purpose: "Bunkering", totalAmount: 22100, currency: "USD", status: "draft", createdAt: "2026-02-18", days: 2 },
  { id: "dp4", referenceNumber: "PF-2026-0034", vesselName: "MV ANATOLIAN PRIDE", portName: "Istanbul (Ambarlı)", purpose: "Discharging", totalAmount: 31850, currency: "USD", status: "approved", createdAt: "2026-02-20", days: 3 },
  { id: "dp5", referenceNumber: "PF-2026-0035", vesselName: "MV BLUE HORIZON", portName: "Mersin", purpose: "Loading", totalAmount: 54300, currency: "USD", status: "sent", createdAt: "2026-02-22", days: 5 },
];

export const DEMO_FINAL_DA = {
  id: "dfd1",
  voyageId: "dvoy1",
  vesselName: "MV BLUE HORIZON",
  portName: "Istanbul (Ambarlı)",
  proformaAmount: 48250,
  actualAmount: 46890,
  variance: -1360,
  variancePct: -2.8,
  status: "reconciled",
  items: [
    { description: "Port Dues", proforma: 8200, actual: 7950, variance: -250 },
    { description: "Pilotage", proforma: 4800, actual: 4800, variance: 0 },
    { description: "Towage", proforma: 6500, actual: 6200, variance: -300 },
    { description: "Agency Fee", proforma: 3500, actual: 3500, variance: 0 },
    { description: "Mooring/Unmooring", proforma: 2100, actual: 2100, variance: 0 },
    { description: "Cargo Operations", proforma: 18400, actual: 17590, variance: -810 },
    { description: "Miscellaneous", proforma: 4750, actual: 4750, variance: 0 },
  ],
};

export const DEMO_TENDERS = [
  { id: "dt1", title: "Port Agency Services — MV BLUE HORIZON @ Istanbul", portName: "Istanbul (Ambarlı)", vesselName: "MV BLUE HORIZON", eta: "2026-03-15", status: "open", bidsCount: 4, budget: 55000, createdAt: "2026-02-25" },
  { id: "dt2", title: "Port Agency Services — MT BOSPHORUS @ Mersin", portName: "Mersin", vesselName: "MT BOSPHORUS", eta: "2026-02-28", status: "awarded", bidsCount: 7, budget: 95000, createdAt: "2026-02-10" },
  { id: "dt3", title: "Port Agency — MV AEGEAN STAR @ Izmir", portName: "Izmir", vesselName: "MV AEGEAN STAR", eta: "2026-03-05", status: "closed", bidsCount: 3, budget: 40000, createdAt: "2026-02-20" },
];

export const DEMO_SOF_EVENTS = [
  { id: "ds1", voyageId: "dvoy1", eventTime: "2026-02-12T06:00:00", eventType: "Arrival at Pilot Station", description: "Vessel arrived at Istanbul pilot station", isKeyEvent: true },
  { id: "ds2", voyageId: "dvoy1", eventTime: "2026-02-12T07:30:00", eventType: "Pilot on Board", description: "Pilot boarded", isKeyEvent: true },
  { id: "ds3", voyageId: "dvoy1", eventTime: "2026-02-12T09:15:00", eventType: "All Fast", description: "Vessel all fast at berth 4A", isKeyEvent: true },
  { id: "ds4", voyageId: "dvoy1", eventTime: "2026-02-12T10:00:00", eventType: "Notice of Readiness Tendered", description: "NOR tendered and accepted", isKeyEvent: true },
  { id: "ds5", voyageId: "dvoy1", eventTime: "2026-02-12T12:00:00", eventType: "Loading Commenced", description: "Loading operations commenced", isKeyEvent: true },
  { id: "ds6", voyageId: "dvoy1", eventTime: "2026-02-14T16:30:00", eventType: "Loading Completed", description: "42,000 MT wheat loaded", isKeyEvent: true },
  { id: "ds7", voyageId: "dvoy1", eventTime: "2026-02-14T18:00:00", eventType: "Hatch Closing Completed", description: "All hatches closed and secured", isKeyEvent: false },
  { id: "ds8", voyageId: "dvoy1", eventTime: "2026-02-14T20:00:00", eventType: "Pilot on Board", description: "Departure pilot boarded", isKeyEvent: false },
  { id: "ds9", voyageId: "dvoy1", eventTime: "2026-02-14T21:30:00", eventType: "Vessel Departed", description: "Vessel departed Istanbul", isKeyEvent: true },
  { id: "ds10", voyageId: "dvoy1", eventTime: "2026-02-20T08:00:00", eventType: "Arrival at Pilot Station", description: "Vessel arrived at Mersin pilot station", isKeyEvent: true },
];

export const DEMO_COMPLIANCE = {
  id: "dc1",
  vesselId: "dv1",
  vesselName: "MV BLUE HORIZON",
  standard: "ISM",
  totalItems: 40,
  completedItems: 31,
  compliancePct: 77.5,
  status: "in_progress",
  lastAuditDate: "2025-09-15",
  nextAuditDate: "2026-09-15",
  auditorName: "Capt. James Reid (DNV GL)",
  findings: 3,
};

export const DEMO_BUNKER_RECORDS = [
  { id: "db1", vesselId: "dv1", port: "Istanbul (Ambarlı)", fuelType: "VLSFO", quantity: 450, pricePerMt: 565, totalCost: 254250, bunkeredAt: "2026-02-12", supplier: "PetroTurk AS" },
  { id: "db2", vesselId: "dv3", port: "Mersin", fuelType: "MGO", quantity: 80, pricePerMt: 720, totalCost: 57600, bunkeredAt: "2026-02-15", supplier: "Medstar Marine" },
];

export const DEMO_MESSAGES = [
  { id: "dm1", sender: "demo-admin", senderName: "Admin User", content: "Welcome to VesselPDA Demo! Feel free to explore the platform.", createdAt: "2026-02-26T09:00:00", isDemo: true },
  { id: "dm2", sender: "demo-agent", senderName: "Demo Agent", content: "Proforma for MV BLUE HORIZON @ Istanbul has been approved.", createdAt: "2026-02-26T10:15:00", isDemo: true },
  { id: "dm3", sender: "demo-shipowner", senderName: "Demo Shipowner", content: "Please proceed with the port call arrangements for Mersin.", createdAt: "2026-02-26T11:30:00", isDemo: true },
];

export const DEMO_STATS = {
  totalVessels: DEMO_VESSELS.length,
  activeVoyages: DEMO_VOYAGES.filter(v => v.status === "in_progress").length,
  openTenders: DEMO_TENDERS.filter(t => t.status === "open").length,
  totalProformas: DEMO_PROFORMAS.length,
  fleetDwt: DEMO_VESSELS.reduce((s, v) => s + v.dwt, 0),
};

export const ROLE_FEATURES: Record<DemoRole, { title: string; description: string; features: string[] }> = {
  agent: {
    title: "Ship Agent",
    description: "Manage port calls, generate proformas, and handle DA accounting.",
    features: [
      "Instant Proforma DA generation",
      "Port call & voyage management",
      "Statement of Facts (SOF)",
      "Tender bidding & nominations",
      "Final DA & reconciliation",
      "Document management",
    ],
  },
  shipowner: {
    title: "Shipowner / Broker",
    description: "Monitor your fleet, track voyages, and manage costs.",
    features: [
      "Fleet overview dashboard",
      "Multi-port voyage tracking",
      "Expense budget vs actual",
      "Bunker management",
      "Vessel certificate tracking",
      "ISM / ISPS compliance",
    ],
  },
  admin: {
    title: "Admin",
    description: "Full platform control — users, organizations, and analytics.",
    features: [
      "Platform KPI dashboard",
      "User & role management",
      "Organization management",
      "Tariff management",
      "Audit log viewer",
      "System-wide reports",
    ],
  },
};
