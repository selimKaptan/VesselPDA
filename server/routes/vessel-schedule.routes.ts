import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { eq, and, or, gte, lte, sql, desc } from "drizzle-orm";
import { voyages, vessels, ports, noticeOfReadiness, statementOfFacts, fdaAccounts, proformas } from "@shared/schema";

const router = Router();

const VESSEL_COLORS = [
  "#38BDF8",
  "#22C55E",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#14B8A6",
  "#F97316",
];

function normalizeStatus(status: string): string {
  if (status === "active") return "in_progress";
  if (status === "draft") return "planned";
  return status;
}

function statusColor(status: string): string {
  const norm = normalizeStatus(status);
  if (norm === "planned") return "#38BDF8";
  if (norm === "in_progress") return "#F59E0B";
  if (norm === "completed") return "#22C55E";
  if (norm === "cancelled") return "#94A3B8";
  return "#38BDF8";
}

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { vesselId, from, to } = req.query;

    const now = new Date();
    const fromDate = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const toDate = to ? new Date(to as string) : new Date(now.getFullYear(), now.getMonth() + 4, 0);

    const whereConditions = [
      or(eq(voyages.userId, userId), eq(voyages.agentUserId, userId)),
      or(
        and(gte(voyages.eta, fromDate), lte(voyages.eta, toDate)),
        and(gte(voyages.etd, fromDate), lte(voyages.etd, toDate))
      ),
    ];

    if (vesselId) {
      whereConditions.push(eq(voyages.vesselId, parseInt(vesselId as string)));
    }

    const rows = await db
      .select({
        id: voyages.id,
        userId: voyages.userId,
        agentUserId: voyages.agentUserId,
        vesselId: voyages.vesselId,
        vesselNameDenorm: voyages.vesselName,
        portId: voyages.portId,
        status: voyages.status,
        eta: voyages.eta,
        etd: voyages.etd,
        purposeOfCall: voyages.purposeOfCall,
        notes: voyages.notes,
        vesselName: vessels.name,
        vesselFlag: vessels.flag,
        portName: ports.name,
        portCode: ports.code,
      })
      .from(voyages)
      .leftJoin(vessels, eq(voyages.vesselId, vessels.id))
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(and(...whereConditions))
      .orderBy(desc(voyages.eta));

    const voyageIds = rows.map((r) => r.id);

    let norVoyageIds = new Set<number>();
    let sofVoyageIds = new Set<number>();
    let fdaVoyageIds = new Set<number>();

    if (voyageIds.length > 0) {
      const norRows = await db
        .select({ voyageId: noticeOfReadiness.voyageId })
        .from(noticeOfReadiness)
        .where(sql`${noticeOfReadiness.voyageId} = ANY(ARRAY[${sql.join(voyageIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
      norRows.forEach((r) => { if (r.voyageId) norVoyageIds.add(r.voyageId); });

      const sofRows = await db
        .select({ voyageId: statementOfFacts.voyageId })
        .from(statementOfFacts)
        .where(sql`${statementOfFacts.voyageId} = ANY(ARRAY[${sql.join(voyageIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
      sofRows.forEach((r) => { if (r.voyageId) sofVoyageIds.add(r.voyageId); });

      const fdaRows = await db
        .select({ voyageId: fdaAccounts.voyageId })
        .from(fdaAccounts)
        .where(sql`${fdaAccounts.voyageId} = ANY(ARRAY[${sql.join(voyageIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
      fdaRows.forEach((r) => { if (r.voyageId) fdaVoyageIds.add(r.voyageId); });
    }

    const vesselColorMap = new Map<number | null, string>();
    let colorIdx = 0;
    rows.forEach((r) => {
      const vid = r.vesselId;
      if (vid !== null && vid !== undefined && !vesselColorMap.has(vid)) {
        vesselColorMap.set(vid, VESSEL_COLORS[colorIdx % VESSEL_COLORS.length]);
        colorIdx++;
      }
    });

    const pdaCheckRows = rows.length > 0 ? await db
      .select({ vesselId: proformas.vesselId, portId: proformas.portId })
      .from(proformas)
      .where(
        sql`(${proformas.vesselId}, ${proformas.portId}) IN (${sql.join(
          rows.filter(r => r.vesselId && r.portId).map(r => sql`(${r.vesselId}, ${r.portId})`),
          sql`, `
        )}) AND ${proformas.approvalStatus} NOT IN ('rejected', 'draft')`
      ) : [];

    const pdaSet = new Set(pdaCheckRows.map((r) => `${r.vesselId}-${r.portId}`));

    const events = rows.map((r) => {
      const normStatus = normalizeStatus(r.status);
      const eta = r.eta ? new Date(r.eta) : null;
      const etd = r.etd ? new Date(r.etd) : null;
      const durationDays = eta && etd ? Math.max(1, Math.ceil((etd.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24))) : 1;
      const displayVesselName = r.vesselName || r.vesselNameDenorm || "Unknown Vessel";
      const vesselColor = r.vesselId ? (vesselColorMap.get(r.vesselId) || VESSEL_COLORS[0]) : VESSEL_COLORS[0];

      return {
        id: r.id,
        vesselId: r.vesselId,
        vesselName: displayVesselName,
        vesselFlag: r.vesselFlag || "",
        portName: r.portName || "Unknown Port",
        portCode: r.portCode || "",
        operation: r.purposeOfCall || "Loading",
        status: normStatus,
        eta: r.eta ? r.eta.toISOString() : null,
        etd: r.etd ? r.etd.toISOString() : null,
        durationDays,
        color: vesselColor,
        hasNor: norVoyageIds.has(r.id),
        hasSof: sofVoyageIds.has(r.id),
        hasPda: pdaSet.has(`${r.vesselId}-${r.portId}`),
        hasFda: fdaVoyageIds.has(r.id),
      };
    });

    const seenVesselIds = new Set<number>();
    const vesselList: { id: number; name: string; flag: string; color: string }[] = [];
    colorIdx = 0;
    rows.forEach((r) => {
      if (r.vesselId && !seenVesselIds.has(r.vesselId)) {
        seenVesselIds.add(r.vesselId);
        vesselList.push({
          id: r.vesselId,
          name: r.vesselName || r.vesselNameDenorm || "Unknown Vessel",
          flag: r.vesselFlag || "",
          color: VESSEL_COLORS[colorIdx % VESSEL_COLORS.length],
        });
        colorIdx++;
      }
    });

    res.json({ events, vessels: vesselList });
  } catch (error) {
    console.error("vessel-schedule error:", error);
    res.status(500).json({ message: "Failed to fetch vessel schedule" });
  }
});

router.get("/upcoming", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const days = parseInt((req.query.days as string) || "7");
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: voyages.id,
        vesselNameDenorm: voyages.vesselName,
        vesselName: vessels.name,
        portName: ports.name,
        portCode: ports.code,
        status: voyages.status,
        purposeOfCall: voyages.purposeOfCall,
        eta: voyages.eta,
        etd: voyages.etd,
      })
      .from(voyages)
      .leftJoin(vessels, eq(voyages.vesselId, vessels.id))
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(
        and(
          or(eq(voyages.userId, userId), eq(voyages.agentUserId, userId)),
          gte(voyages.eta, now),
          lte(voyages.eta, future)
        )
      )
      .orderBy(voyages.eta);

    const result = rows.map((r) => {
      const eta = r.eta ? new Date(r.eta) : null;
      const etd = r.etd ? new Date(r.etd) : null;
      const durationDays = eta && etd ? Math.max(1, Math.ceil((etd.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24))) : 1;
      return {
        id: r.id,
        vesselName: r.vesselName || r.vesselNameDenorm || "Unknown Vessel",
        portName: r.portName || "Unknown Port",
        portCode: r.portCode || "",
        eta: r.eta ? r.eta.toISOString() : null,
        etd: r.etd ? r.etd.toISOString() : null,
        status: normalizeStatus(r.status),
        operation: r.purposeOfCall || "Loading",
        durationDays,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("vessel-schedule/upcoming error:", error);
    res.status(500).json({ message: "Failed to fetch upcoming port calls" });
  }
});

export default router;
