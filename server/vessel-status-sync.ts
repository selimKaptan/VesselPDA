import { pool } from "./db";

const VALID_FLEET_STATUSES = new Set([
  "idle", "ballast_to_load", "laden_to_discharge",
  "anchored", "anchor_spot", "loading", "discharging", "moored", "underway",
]);

function deriveFleetStatus(
  portCallStatus: string | null,
  voyageStatus: string | null,
  purposeOfCall: string | null
): string | null {
  const p = (purposeOfCall || "").toLowerCase();
  const isLoading = p.includes("load") && !p.includes("unload");
  const isDischarging = p.includes("discharg") || p.includes("unload");

  if (portCallStatus) {
    switch (portCallStatus) {
      case "expected":
        return isLoading ? "ballast_to_load" : isDischarging ? "laden_to_discharge" : "ballast_to_load";
      case "arrived":
        return "anchored";
      case "in_port":
        return "moored";
      case "operations":
        return isLoading ? "loading" : isDischarging ? "discharging" : "moored";
      default:
        break;
    }
  }

  if (voyageStatus === "in_progress" || voyageStatus === "active") {
    return isLoading ? "loading" : isDischarging ? "discharging" : "moored";
  }

  if (voyageStatus === "planned") {
    return isLoading ? "ballast_to_load" : isDischarging ? "laden_to_discharge" : "ballast_to_load";
  }

  return null;
}

export async function syncVesselStatuses(vesselIds?: number[]): Promise<{ updated: number }> {
  try {
    const hasFilter = vesselIds && vesselIds.length > 0;
    const params: any[] = hasFilter ? [vesselIds] : [];
    const whereClause = hasFilter ? "WHERE v.id = ANY($1)" : "";

    const result = await pool.query(
      `
      WITH best_voyage AS (
        SELECT DISTINCT ON (vessel_id)
          id, vessel_id, purpose_of_call, status AS voyage_status
        FROM voyages
        WHERE status IN ('active', 'in_progress', 'planned') AND vessel_id IS NOT NULL
        ORDER BY vessel_id,
          CASE status
            WHEN 'in_progress' THEN 3
            WHEN 'active' THEN 2
            WHEN 'planned' THEN 1
            ELSE 0
          END DESC,
          created_at DESC
      ),
      latest_pc AS (
        SELECT DISTINCT ON (pc.vessel_id)
          pc.vessel_id, pc.status AS pc_status
        FROM port_calls pc
        JOIN best_voyage bv ON bv.id = pc.voyage_id
        ORDER BY pc.vessel_id, pc.created_at DESC
      )
      SELECT
        v.id,
        v.fleet_status,
        bv.purpose_of_call,
        bv.voyage_status,
        lpc.pc_status
      FROM vessels v
      LEFT JOIN best_voyage bv ON bv.vessel_id = v.id
      LEFT JOIN latest_pc lpc ON lpc.vessel_id = v.id
      ${whereClause}
      `,
      params
    );

    let updated = 0;
    for (const row of result.rows) {
      const derived = deriveFleetStatus(row.pc_status, row.voyage_status, row.purpose_of_call);
      const current = row.fleet_status as string | null;

      if (derived && derived !== current) {
        await pool.query("UPDATE vessels SET fleet_status = $1 WHERE id = $2", [derived, row.id]);
        updated++;
      } else if (!derived && current && !VALID_FLEET_STATUSES.has(current)) {
        await pool.query("UPDATE vessels SET fleet_status = 'idle' WHERE id = $1", [row.id]);
        updated++;
      }
    }
    return { updated };
  } catch (err: any) {
    console.error("[vessel-status-sync] error:", err?.message);
    return { updated: 0 };
  }
}
