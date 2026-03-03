export interface DeductionEntry {
  reason: string;
  hours: number;
}

export interface LaytimeInput {
  allowedLaytimeHours: number;
  norStartedAt?: string | null;
  berthingAt?: string | null;
  loadingStartedAt?: string | null;
  loadingCompletedAt?: string | null;
  departedAt?: string | null;
  demurrageRate: number;
  despatchRate: number;
  deductions?: DeductionEntry[];
}

export interface LaytimeResult {
  timeUsedHours: number;
  totalDeductionHours: number;
  effectiveHours: number;
  differenceHours: number;
  demurrageAmount: number;
  despatchAmount: number;
  status: "on_demurrage" | "on_despatch" | "within_laytime";
}

function hoursBetween(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  if (diff <= 0) return 0;
  return diff / 1000 / 3600;
}

export function calculateLaytime(input: LaytimeInput): LaytimeResult {
  const {
    allowedLaytimeHours,
    norStartedAt,
    berthingAt,
    loadingStartedAt,
    loadingCompletedAt,
    departedAt,
    demurrageRate,
    despatchRate,
    deductions = [],
  } = input;

  const start = norStartedAt || berthingAt || loadingStartedAt;
  const end = departedAt || loadingCompletedAt;

  const timeUsedHours = hoursBetween(start, end);

  const totalDeductionHours = deductions.reduce((sum, d) => sum + (d.hours || 0), 0);

  const effectiveHours = Math.max(0, timeUsedHours - totalDeductionHours);

  const differenceHours = effectiveHours - allowedLaytimeHours;

  let demurrageAmount = 0;
  let despatchAmount = 0;
  let status: LaytimeResult["status"] = "within_laytime";

  if (differenceHours > 0) {
    demurrageAmount = differenceHours * (demurrageRate / 24);
    status = "on_demurrage";
  } else if (differenceHours < 0) {
    despatchAmount = Math.abs(differenceHours) * (despatchRate / 24);
    status = "on_despatch";
  }

  return {
    timeUsedHours,
    totalDeductionHours,
    effectiveHours,
    differenceHours,
    demurrageAmount,
    despatchAmount,
    status,
  };
}
