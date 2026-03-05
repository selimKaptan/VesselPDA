import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { vessels } from "@shared/schema";
import { getResendCredentials } from "../email";
import { Resend } from "resend";

const router = Router();

async function getVesselForUser(vesselId: number, userId: string, isAdminUser: boolean) {
  const [vessel] = await db.select().from(vessels).where(eq(vessels.id, vesselId));
  if (!vessel) return null;
  if (!isAdminUser && vessel.userId !== userId) return null;
  return vessel;
}

// GET /api/vessels/:vesselId/q88
router.get("/vessels/:vesselId/q88", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const vesselId = parseInt(req.params.vesselId);
    if (isNaN(vesselId)) return res.status(400).json({ message: "Invalid vessel ID" });

    const user = await storage.getUser(userId);
    const isAdminUser = user?.userRole === "admin";

    const vessel = await getVesselForUser(vesselId, userId, isAdminUser);
    if (!vessel) return res.status(404).json({ message: "Vessel not found" });

    const q88 = await storage.getVesselQ88(vesselId);
    if (!q88) return res.status(404).json({ message: "Q88 not found" });

    res.json(q88);
  } catch (err) {
    console.error("[q88:GET]", err);
    res.status(500).json({ message: "Failed to fetch Q88" });
  }
});

// POST /api/vessels/:vesselId/q88 — create Q88 (auto-fill from vessel)
router.post("/vessels/:vesselId/q88", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const vesselId = parseInt(req.params.vesselId);
    if (isNaN(vesselId)) return res.status(400).json({ message: "Invalid vessel ID" });

    const user = await storage.getUser(userId);
    const isAdminUser = user?.userRole === "admin";

    const vessel = await getVesselForUser(vesselId, userId, isAdminUser);
    if (!vessel) return res.status(404).json({ message: "Vessel not found" });

    // Check if Q88 already exists
    const existing = await storage.getVesselQ88(vesselId);
    if (existing) return res.status(409).json({ message: "Q88 already exists", q88: existing });

    // Auto-fill from vessel data
    const q88Data = {
      vesselId,
      userId,
      vesselName: vessel.name,
      flag: vessel.flag,
      imoNumber: vessel.imoNumber ?? undefined,
      callSign: vessel.callSign ?? undefined,
      vesselType: vessel.vesselType,
      grt: vessel.grt,
      nrt: vessel.nrt,
      dwt: vessel.dwt ?? undefined,
      loa: vessel.loa ?? undefined,
      beam: vessel.beam ?? undefined,
      status: "draft" as const,
      ...req.body,
    };

    const q88 = await storage.createVesselQ88(q88Data);
    res.status(201).json(q88);
  } catch (err) {
    console.error("[q88:POST]", err);
    res.status(500).json({ message: "Failed to create Q88" });
  }
});

// PATCH /api/vessels/:vesselId/q88
router.patch("/vessels/:vesselId/q88", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const vesselId = parseInt(req.params.vesselId);
    if (isNaN(vesselId)) return res.status(400).json({ message: "Invalid vessel ID" });

    const user = await storage.getUser(userId);
    const isAdminUser = user?.userRole === "admin";

    const vessel = await getVesselForUser(vesselId, userId, isAdminUser);
    if (!vessel) return res.status(404).json({ message: "Vessel not found" });

    const q88 = await storage.getVesselQ88(vesselId);
    if (!q88) return res.status(404).json({ message: "Q88 not found" });

    const updated = await storage.updateVesselQ88(vesselId, req.body);
    res.json(updated);
  } catch (err) {
    console.error("[q88:PATCH]", err);
    res.status(500).json({ message: "Failed to update Q88" });
  }
});

// GET /api/q88/public/:vesselId — no auth required
router.get("/q88/public/:vesselId", async (req: any, res: any) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    if (isNaN(vesselId)) return res.status(400).json({ message: "Invalid vessel ID" });

    const q88 = await storage.getPublicVesselQ88(vesselId);
    if (!q88) return res.status(404).json({ message: "Public Q88 not found" });

    res.json(q88);
  } catch (err) {
    console.error("[q88:public]", err);
    res.status(500).json({ message: "Failed to fetch public Q88" });
  }
});

// POST /api/vessels/:vesselId/q88/share
router.post("/vessels/:vesselId/q88/share", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const vesselId = parseInt(req.params.vesselId);
    if (isNaN(vesselId)) return res.status(400).json({ message: "Invalid vessel ID" });

    const { email, message } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await storage.getUser(userId);
    const isAdminUser = user?.userRole === "admin";

    const vessel = await getVesselForUser(vesselId, userId, isAdminUser);
    if (!vessel) return res.status(404).json({ message: "Vessel not found" });

    const q88 = await storage.getVesselQ88(vesselId);
    if (!q88) return res.status(404).json({ message: "Q88 not found" });

    const creds = await getResendCredentials();
    if (!creds) {
      console.warn("[q88:share] No Resend credentials");
      return res.status(200).json({ message: "Q88 share noted (email unavailable)" });
    }

    const resend = new Resend(creds.apiKey);

    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
  .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: #0f172a; color: white; padding: 24px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; color: #94a3b8; font-size: 13px; }
  .content { padding: 24px; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  td:first-child { color: #64748b; width: 45%; }
  td:last-child { font-weight: 500; }
  .msg-box { background: #f1f5f9; border-left: 3px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px; font-size: 13px; color: #475569; }
  .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>VESSEL PARTICULARS QUESTIONNAIRE (Q88)</h1>
    <p>Shared via VesselPDA</p>
  </div>
  <div class="content">
    ${message ? `<div class="msg-box">${message}</div>` : ""}
    <div class="section">
      <h2>1. General Information</h2>
      <table>
        <tr><td>Vessel Name</td><td>${q88.vesselName ?? "—"}</td></tr>
        <tr><td>Ex-Name</td><td>${q88.exName ?? "—"}</td></tr>
        <tr><td>Flag</td><td>${q88.flag ?? "—"}</td></tr>
        <tr><td>Port of Registry</td><td>${q88.portOfRegistry ?? "—"}</td></tr>
        <tr><td>IMO Number</td><td>${q88.imoNumber ?? "—"}</td></tr>
        <tr><td>Call Sign</td><td>${q88.callSign ?? "—"}</td></tr>
        <tr><td>MMSI</td><td>${q88.mmsiNumber ?? "—"}</td></tr>
        <tr><td>Vessel Type</td><td>${q88.vesselType ?? "—"}</td></tr>
        <tr><td>Year Built</td><td>${q88.yearBuilt ?? "—"}</td></tr>
        <tr><td>Builder</td><td>${q88.builder ?? "—"}</td></tr>
        <tr><td>Classification</td><td>${q88.classificationSociety ?? "—"}</td></tr>
        <tr><td>Class Notation</td><td>${q88.classNotation ?? "—"}</td></tr>
        <tr><td>P&I Club</td><td>${q88.piClub ?? "—"}</td></tr>
        <tr><td>Hull Material</td><td>${q88.hullMaterial ?? "—"}</td></tr>
      </table>
    </div>
    <div class="section">
      <h2>2. Dimensions &amp; Tonnage</h2>
      <table>
        <tr><td>GRT / NRT / DWT</td><td>${q88.grt ?? "—"} / ${q88.nrt ?? "—"} / ${q88.dwt ?? "—"} MT</td></tr>
        <tr><td>LOA / LBP</td><td>${q88.loa ?? "—"} / ${q88.lbp ?? "—"} m</td></tr>
        <tr><td>Beam / Depth</td><td>${q88.beam ?? "—"} / ${q88.depth ?? "—"} m</td></tr>
        <tr><td>Max Draft / Summer Draft</td><td>${q88.maxDraft ?? "—"} / ${q88.summerDraft ?? "—"} m</td></tr>
        <tr><td>TPC</td><td>${q88.tpc ?? "—"}</td></tr>
        <tr><td>Grain / Bale Capacity</td><td>${q88.grainCapacity ?? "—"} / ${q88.baleCapacity ?? "—"} cbm</td></tr>
      </table>
    </div>
    <div class="section">
      <h2>3. Engine &amp; Speed</h2>
      <table>
        <tr><td>Main Engine</td><td>${q88.mainEngine ?? "—"}</td></tr>
        <tr><td>Engine Power</td><td>${q88.enginePower ?? "—"}</td></tr>
        <tr><td>Service Speed / Max Speed</td><td>${q88.serviceSpeed ?? "—"} / ${q88.maxSpeed ?? "—"} knots</td></tr>
        <tr><td>Fuel Type</td><td>${q88.fuelType ?? "—"}</td></tr>
        <tr><td>Fuel Consumption</td><td>${q88.fuelConsumption ?? "—"}</td></tr>
      </table>
    </div>
  </div>
  <div class="footer">
    Generated by VesselPDA &bull; ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
    &bull; Q88 v${q88.version ?? 1}
  </div>
</div>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: creds.fromEmail,
      to: email,
      subject: `Q88 Vessel Particulars — ${q88.vesselName ?? vessel.name}`,
      html,
    });

    if (error) {
      console.error("[q88:share] Resend error:", error);
      return res.status(500).json({ message: "Failed to send email" });
    }

    await storage.updateVesselQ88(vesselId, { status: "shared" });
    res.json({ message: "Q88 shared successfully" });
  } catch (err) {
    console.error("[q88:share]", err);
    res.status(500).json({ message: "Failed to share Q88" });
  }
});

// POST /api/vessels/:vesselId/q88/duplicate
router.post("/vessels/:vesselId/q88/duplicate", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const sourceVesselId = parseInt(req.params.vesselId);
    const { targetVesselId } = req.body;

    if (isNaN(sourceVesselId) || !targetVesselId) {
      return res.status(400).json({ message: "Invalid vessel IDs" });
    }

    const user = await storage.getUser(userId);
    const isAdminUser = user?.userRole === "admin";

    const sourceVessel = await getVesselForUser(sourceVesselId, userId, isAdminUser);
    if (!sourceVessel) return res.status(404).json({ message: "Source vessel not found" });

    const targetVessel = await getVesselForUser(parseInt(targetVesselId), userId, isAdminUser);
    if (!targetVessel) return res.status(404).json({ message: "Target vessel not found" });

    const q88 = await storage.duplicateVesselQ88(sourceVesselId, parseInt(targetVesselId), userId);
    res.status(201).json(q88);
  } catch (err) {
    console.error("[q88:duplicate]", err);
    res.status(500).json({ message: "Failed to duplicate Q88" });
  }
});

export default router;
