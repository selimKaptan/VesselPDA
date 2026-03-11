import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { insertHusbandryOrderSchema, insertCrewChangeSchema, vesselCrew, voyageCrewLogistics } from "@shared/schema";
import { db } from "../db";
import { eq, and, ilike } from "drizzle-orm";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const orders = await storage.getHusbandryOrders(userId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch husbandry orders" });
  }
});

router.get("/vessels/:vesselId", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const orders = await storage.getVesselHusbandryOrders(vesselId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vessel husbandry orders" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const data = insertHusbandryOrderSchema.parse({
      ...req.body,
      userId
    });
    const order = await storage.createHusbandryOrder(data);
    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create husbandry order" });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await storage.updateHusbandryOrder(id, req.body);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to update husbandry order" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteHusbandryOrder(id);
    if (!success) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete husbandry order" });
  }
});

router.get("/:id/crew-changes", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const changes = await storage.getCrewChanges(id);
    res.json(changes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch crew changes" });
  }
});

router.post("/:id/crew-changes", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = insertCrewChangeSchema.parse({
      ...req.body,
      husbandryOrderId: id
    });
    const change = await storage.createCrewChange(data);
    res.status(201).json(change);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create crew change" });
  }
});

router.patch("/crew-changes/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const change = await storage.updateCrewChange(id, req.body);
    if (!change) return res.status(404).json({ message: "Crew change not found" });
    res.json(change);

    // Crew change "completed" olduğunda vessel crew listesini güncelle
    if (req.body.status === "completed" && change) {
      try {
        const userId = req.user?.claims?.sub || req.user?.id;
        if (change.changeType === "sign_on") {
          const nameParts = change.seafarerName.split(" ");
          const firstName = nameParts[0] || change.seafarerName;
          const lastName = nameParts.slice(1).join(" ") || "";
          await db.insert(vesselCrew).values({
            vesselId: change.vesselId,
            userId,
            firstName,
            lastName,
            rank: change.rank ?? null,
            nationality: change.nationality ?? null,
            passportNumber: change.passportNumber ?? null,
            passportExpiry: change.passportExpiry ?? null,
            seamanBookNumber: change.seamanBookNumber ?? null,
            seamanBookExpiry: change.seamanBookExpiry ?? null,
            contractStartDate: change.arrivalDate ?? new Date(),
            status: "on_board",
          } as any);
          console.log(`[crew-change] Sign-on: ${change.seafarerName} added to vessel crew`);
        } else if (change.changeType === "sign_off") {
          const firstName = change.seafarerName.split(" ")[0];
          const onBoardMembers = await db.select().from(vesselCrew)
            .where(and(
              eq(vesselCrew.vesselId, change.vesselId),
              ilike(vesselCrew.firstName, `%${firstName}%`),
              eq(vesselCrew.status, "on_board"),
            ));
          if (onBoardMembers.length > 0) {
            await db.update(vesselCrew)
              .set({
                status: "off_board",
                contractEndDate: change.departureDate ?? new Date(),
              } as any)
              .where(eq(vesselCrew.id, onBoardMembers[0].id));
            console.log(`[crew-change] Sign-off: ${change.seafarerName} marked as off_board`);
          }
        }
      } catch (syncErr) {
        console.error("[crew-change] Vessel crew sync failed (non-blocking):", syncErr);
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update crew change" });
  }
});

router.post("/:voyageId/crew/bulk", async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.voyageId);
    const { crewMembers, signerType } = req.body;

    if (!Array.isArray(crewMembers) || crewMembers.length === 0) {
      return res.status(400).json({ error: "No crew members" });
    }

    const sideMap: Record<string, string> = {
      on_signer: "on", off_signer: "off",
      sign_on: "on", sign_off: "off",
      on: "on", off: "off",
    };

    const added = [];
    for (const [i, m] of crewMembers.entries()) {
      const side = sideMap[m.signerType || signerType] || "on";
      try {
        const insertData: any = {
          voyageId,
          sortOrder: i,
          name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown",
          rank: m.rank || "Unknown",
          side,
          nationality: m.nationality || "",
          passportNo: m.passportNo || "",
          dob: m.dob || "",
          seamanBookNo: m.seamansBookNo || m.seamanBookNo || "",
          birthPlace: m.birthPlace || "",
          employeeNo: m.employeeNo || "",
          flight: m.flights?.[0]?.flightNo || "",
          flightDetails: m.flights?.length > 0 ? m.flights : [],
        };

        const [row] = await db.insert(voyageCrewLogistics).values(insertData).returning();
        added.push(row);
      } catch (err: any) {
        console.error(`[crew-bulk] Failed ${m.lastName}:`, err.message);
      }
    }
    res.status(201).json({ added: added.length, crew: added });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
