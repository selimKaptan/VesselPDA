export interface WorkflowStep {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  category: "navigation" | "clearance" | "berthing" | "operations" | "departure";
  requiresDateTime: boolean;
  applicableTo: ("loading" | "discharging" | "crew_change" | "bunkering" | "transit" | "all")[];
  hasDeadline: boolean;
  deadlineHoursAfterPrevious?: number;
  internalNote?: string;
}

export const PORT_CALL_STEPS: WorkflowStep[] = [
  {
    key: "eosp",
    label: "End of Sea Passage (EOSP)",
    shortLabel: "EOSP",
    description: "Vessel has completed sea passage and arrived at port limits.",
    icon: "navigation",
    category: "navigation",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: false,
  },
  {
    key: "nor_tendered",
    label: "NOR Tendered",
    shortLabel: "NOR",
    description: "Notice of Readiness tendered to charterers/receivers.",
    icon: "file-check",
    category: "navigation",
    requiresDateTime: true,
    applicableTo: ["loading", "discharging"],
    hasDeadline: true,
    deadlineHoursAfterPrevious: 6,
    internalNote: "NOR must be tendered within port limits. Laytime starts per charter party terms.",
  },
  {
    key: "arrival_declared",
    label: "Arrival Declared",
    shortLabel: "Arrival",
    description: "Vessel arrival officially declared to Port Authority.",
    icon: "flag",
    category: "clearance",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: false,
  },
  {
    key: "customs_cleared",
    label: "Customs & Free Pratique",
    shortLabel: "Customs",
    description: "Customs inward clearance and free pratique granted.",
    icon: "shield-check",
    category: "clearance",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: true,
    deadlineHoursAfterPrevious: 12,
    internalNote: "Contact customs agent immediately upon arrival. Weekend/holiday delays possible.",
  },
  {
    key: "berthing_clearance",
    label: "Berthing Clearance",
    shortLabel: "Berth OK",
    description: "Berthing ordino granted by Harbour Master. Valid for 24h.",
    icon: "anchor",
    category: "berthing",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: true,
    deadlineHoursAfterPrevious: 24,
    internalNote: "Berthing ordino valid for 24 hours. Must berth within this window or re-apply.",
  },
  {
    key: "vessel_berthed",
    label: "Vessel Berthed",
    shortLabel: "Berthed",
    description: "Vessel safely moored alongside. All fast.",
    icon: "ship",
    category: "berthing",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: false,
  },
  {
    key: "survey_controls",
    label: "Survey Controls",
    shortLabel: "Surveys",
    description: "Initial draft and bunker surveys completed.",
    icon: "clipboard-check",
    category: "operations",
    requiresDateTime: true,
    applicableTo: ["loading", "discharging"],
    hasDeadline: false,
  },
  {
    key: "cargo_commenced",
    label: "Cargo Operations Commenced",
    shortLabel: "Cargo Start",
    description: "Loading or discharging operations have started.",
    icon: "package",
    category: "operations",
    requiresDateTime: true,
    applicableTo: ["loading", "discharging"],
    hasDeadline: false,
  },
  {
    key: "cargo_completed",
    label: "Cargo Operations Completed",
    shortLabel: "Cargo Done",
    description: "All cargo operations finished. Final surveys pending.",
    icon: "package-check",
    category: "operations",
    requiresDateTime: true,
    applicableTo: ["loading", "discharging"],
    hasDeadline: false,
  },
  {
    key: "crew_ops",
    label: "Crew Operations",
    shortLabel: "Crew Ops",
    description: "Crew sign-on/sign-off operations completed.",
    icon: "users",
    category: "operations",
    requiresDateTime: true,
    applicableTo: ["crew_change"],
    hasDeadline: false,
  },
  {
    key: "bunkering_ops",
    label: "Bunkering Operations",
    shortLabel: "Bunkering",
    description: "Fuel bunkering operations completed.",
    icon: "fuel",
    category: "operations",
    requiresDateTime: true,
    applicableTo: ["bunkering"],
    hasDeadline: false,
  },
  {
    key: "documents_cleared",
    label: "Documents & Clearance",
    shortLabel: "Docs Clear",
    description: "All port documents signed and outward clearance obtained.",
    icon: "file-signature",
    category: "departure",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: false,
  },
  {
    key: "vessel_departed",
    label: "Vessel Departed (COSP)",
    shortLabel: "Departed",
    description: "Vessel unmoored and commenced sea passage.",
    icon: "navigation-2",
    category: "departure",
    requiresDateTime: true,
    applicableTo: ["all"],
    hasDeadline: false,
  },
];

export function getStepsForOperation(operationType: string): WorkflowStep[] {
  const type = operationType?.toLowerCase().replace(/[\s-]/g, "_") || "all";
  return PORT_CALL_STEPS.filter(step =>
    step.applicableTo.includes("all") || step.applicableTo.includes(type as any)
  );
}

export function calculateDeadline(step: WorkflowStep, previousStepTime?: Date | null): Date | null {
  if (!step.hasDeadline || !step.deadlineHoursAfterPrevious || !previousStepTime) return null;
  return new Date(previousStepTime.getTime() + step.deadlineHoursAfterPrevious * 3600000);
}

export function canSeeInternalNotes(role: string): boolean {
  return ["admin", "agency", "agent", "superintendent"].includes(role?.toLowerCase());
}

export function canEditWorkflow(role: string): boolean {
  return ["admin", "agency", "agent"].includes(role?.toLowerCase());
}
