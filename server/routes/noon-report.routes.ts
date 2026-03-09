import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { eq, and, or, desc } from "drizzle-orm";
import { voyages, noonReports, bunkerRobs, vesselPositions, vessels } from "@shared/schema";

const router = Router();

router.get("/vessels/:vesselId/noon-reports", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const { voyageId, from, to } = req.query;
    const reports = await storage.getNoonReports(vesselId, {
      voyageId: voyageId ? parseInt(voyageId as string) : undefined,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch noon reports" });
  }
});

router.post("/vessels/:vesselId/noon-reports", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const userId = req.user.claims.sub;
    const report = await storage.createNoonReport({
      ...req.body,
      vesselId,
      userId,
      reportDate: new Date(req.body.reportDate),
      eta: req.body.eta ? new Date(req.body.eta) : null,
    });
    res.status(201).json(report);

    // Fire-and-forget: tüm senkronizasyon işlemleri arka planda
    (async () => {
      // 1. Voyage otomatik bağla
      if (!report.voyageId && report.vesselId) {
        try {
          const [activeVoyage] = await db.select().from(voyages)
            .where(and(
              eq(voyages.vesselId, report.vesselId),
              or(eq(voyages.status, "in_progress"), eq(voyages.status, "active"))
            ))
            .orderBy(desc(voyages.createdAt))
            .limit(1);
          if (activeVoyage) {
            await db.update(noonReports)
              .set({ voyageId: activeVoyage.id })
              .where(eq(noonReports.id, report.id));
            report.voyageId = activeVoyage.id;
            console.log(`[noon-report] Linked to voyage #${activeVoyage.id}`);
          }
        } catch (err) {
          console.error("[noon-report] Voyage link failed:", err);
        }
      }

      // 2. Bunker ROB kaydı oluştur
      if (report.hfoConsumed || report.mgoConsumed || report.lsfoConsumed) {
        try {
          await db.insert(bunkerRobs).values({
            vesselId: report.vesselId,
            voyageId: report.voyageId ?? null,
            reportDate: report.reportDate || new Date(),
            hfoRob: report.hfoRob ?? 0,
            mgoRob: report.mgoRob ?? 0,
            lsfoRob: report.lsfoRob ?? 0,
            hfoConsumed: report.hfoConsumed ?? 0,
            mgoConsumed: report.mgoConsumed ?? 0,
            lsfoConsumed: report.lsfoConsumed ?? 0,
            reportedBy: userId,
          });
          console.log(`[noon-report] Bunker ROB synced for vessel ${report.vesselId}`);
        } catch (err) {
          console.error("[noon-report] Bunker ROB sync failed:", err);
        }
      }

      // 3. Vessel position kaydet (MMSI zorunlu)
      if (report.latitude && report.longitude) {
        try {
          const [vessel] = await db.select({ mmsi: vessels.mmsi, name: vessels.name })
            .from(vessels)
            .where(eq(vessels.id, report.vesselId));
          if (vessel?.mmsi) {
            await db.insert(vesselPositions).values({
              mmsi: vessel.mmsi,
              vesselName: vessel.name,
              latitude: report.latitude,
              longitude: report.longitude,
              speed: report.speedOverGround ?? null,
            } as any);
            console.log(`[noon-report] Position synced for ${vessel.name}`);
          }
        } catch (err) {
          console.error("[noon-report] Position sync failed:", err);
        }
      }
    })();
  } catch (error) {
    res.status(500).json({ message: "Failed to create noon report" });
  }
});

router.patch("/noon-reports/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const report = await storage.updateNoonReport(id, {
      ...req.body,
      reportDate: req.body.reportDate ? new Date(req.body.reportDate) : undefined,
      eta: req.body.eta ? new Date(req.body.eta) : null,
    });
    if (!report) return res.status(404).json({ message: "Noon report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Failed to update noon report" });
  }
});

router.delete("/noon-reports/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteNoonReport(id);
    if (!deleted) return res.status(404).json({ message: "Noon report not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete noon report" });
  }
});

router.get("/vessels/:vesselId/performance-stats", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const stats = await storage.getVesselPerformanceStats(vesselId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch performance stats" });
  }
});

export default router;
