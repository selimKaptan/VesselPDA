export interface VoyageFeatures {
  hasCargoOps: boolean;
  hasNOR: boolean;
  hasSOF: boolean;
  hasLaytime: boolean;
  hasCrewLogistics: boolean;
  hasBunkering: boolean;
  stepperLabel4: string;
  primaryTab: "operations" | "financials" | "docs_comms" | "team";
}

const CREW_PURPOSES = ["Crew Change", "Husbandry", "crew_change", "husbandry"];

const NOR_SOF_PURPOSES = [
  "Loading", "Discharging", "Bunkering", "loading", "discharging", "bunkering",
];

const CARGO_PURPOSES = [
  "Loading", "Discharging", "Transit", "Bunkering", "Repair", "Inspection",
  "loading", "discharging", "transit", "bunkering", "repair", "inspection",
  "General Cargo", "general_cargo", "other", "Other",
];

export function getVoyageFeatures(purposeOfCall?: string | null): VoyageFeatures {
  const p = (purposeOfCall || "").trim();

  const isCrew = CREW_PURPOSES.some(c => c.toLowerCase() === p.toLowerCase());
  const hasCargo = !isCrew && CARGO_PURPOSES.some(c => c.toLowerCase() === p.toLowerCase());
  const hasNorSof = !isCrew && NOR_SOF_PURPOSES.some(c => c.toLowerCase() === p.toLowerCase());

  if (isCrew) {
    return {
      hasCargoOps: false,
      hasNOR: false,
      hasSOF: false,
      hasLaytime: false,
      hasCrewLogistics: true,
      hasBunkering: false,
      stepperLabel4: p.toLowerCase().includes("crew") ? "Crew Ops" : "Operations",
      primaryTab: "operations",
    };
  }

  return {
    hasCargoOps: hasCargo,
    hasNOR: hasNorSof,
    hasSOF: hasNorSof,
    hasLaytime: hasNorSof,
    hasCrewLogistics: false,
    hasBunkering: p.toLowerCase().includes("bunker"),
    stepperLabel4: hasCargo ? "Cargo Ops" : "Operations",
    primaryTab: "operations",
  };
}
