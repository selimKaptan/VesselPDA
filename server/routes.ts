import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { ProformaLineItem } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vessels = await storage.getVesselsByUser(userId);
      res.json(vessels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vessels" });
    }
  });

  app.post("/api/vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, flag, vesselType, grt, nrt } = req.body;
      if (!name || !flag || !vesselType || !grt || !nrt) {
        return res.status(400).json({ message: "name, flag, vesselType, grt, and nrt are required" });
      }
      const vessel = await storage.createVessel({
        ...req.body,
        userId,
        grt: Number(grt),
        nrt: Number(nrt),
        dwt: req.body.dwt ? Number(req.body.dwt) : null,
        loa: req.body.loa ? Number(req.body.loa) : null,
        beam: req.body.beam ? Number(req.body.beam) : null,
      });
      res.json(vessel);
    } catch (error) {
      res.status(500).json({ message: "Failed to create vessel" });
    }
  });

  app.patch("/api/vessels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const vessel = await storage.updateVessel(id, userId, req.body);
      if (!vessel) return res.status(404).json({ message: "Vessel not found" });
      res.json(vessel);
    } catch (error) {
      res.status(500).json({ message: "Failed to update vessel" });
    }
  });

  app.delete("/api/vessels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteVessel(id, userId);
      if (!deleted) return res.status(404).json({ message: "Vessel not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete vessel" });
    }
  });

  app.get("/api/ports", isAuthenticated, async (req, res) => {
    try {
      const ports = await storage.getPorts();
      res.json(ports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ports" });
    }
  });

  app.get("/api/proformas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const proformas = await storage.getProformasByUser(userId);
      res.json(proformas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proformas" });
    }
  });

  app.get("/api/proformas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const proforma = await storage.getProforma(id, userId);
      if (!proforma) return res.status(404).json({ message: "Proforma not found" });
      res.json(proforma);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proforma" });
    }
  });

  app.post("/api/proformas/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const { vesselId, portId, berthStayDays = 5, cargoQuantity, purposeOfCall = "Loading", exchangeRate: reqExchangeRate } = req.body;
      const userId = req.user.claims.sub;

      if (!vesselId || !portId) {
        return res.status(400).json({ message: "vesselId and portId are required" });
      }

      const vessel = await storage.getVessel(Number(vesselId), userId);
      if (!vessel) return res.status(404).json({ message: "Vessel not found" });

      const port = await storage.getPort(Number(portId));
      if (!port) return res.status(404).json({ message: "Port not found" });

      const categories = await storage.getTariffCategories(port.id);
      const lineItems: ProformaLineItem[] = [];
      let totalUsd = 0;
      const exchangeRate = Number(reqExchangeRate) || 1.1593;
      const days = Number(berthStayDays) || 5;
      const cargo = cargoQuantity ? Number(cargoQuantity) : 0;

      for (const cat of categories) {
        let amount = 0;
        const rates = await storage.getTariffRates(cat.id);

        if (cat.calculationType === "grt_based") {
          const rate = rates.find(r => vessel.grt >= r.minGrt && (r.maxGrt === null || vessel.grt <= r.maxGrt));
          if (rate) {
            amount = rate.rate;
            if (cat.baseUnit === "per_1000_grt") {
              amount = rate.rate * Math.ceil(vessel.grt / 1000);
            }
          }
        } else if (cat.calculationType === "nrt_based") {
          const rate = rates.find(r => vessel.nrt >= r.minGrt && (r.maxGrt === null || vessel.nrt <= r.maxGrt));
          if (rate) {
            amount = rate.rate;
            if (cat.name.includes("Agency Fee") && days > 5) {
              const extraPeriods = Math.ceil((days - 5) / 3);
              amount = amount * (1 + 0.25 * extraPeriods);
            }
          }
        } else if (cat.calculationType === "per_day") {
          const rate = rates[0];
          if (rate) {
            amount = rate.rate * days;
          }
        } else if (cat.calculationType === "cargo_based") {
          const rate = rates.find(r => cargo >= r.minGrt && (r.maxGrt === null || cargo <= r.maxGrt));
          if (rate) {
            amount = rate.rate;
          }
        } else {
          const rate = rates[0];
          if (rate) {
            amount = rate.rate;
          }
        }

        if (amount > 0) {
          let notes = cat.description || undefined;
          if (cat.overtimeRate && cat.overtimeRate > 0) {
            notes = `${Math.round(cat.overtimeRate * 100)}% overtime will applicable on National/Religious holidays & Sundays`;
          }

          const roundedAmount = Math.round(amount);
          const amountEur = Math.round(roundedAmount / exchangeRate);
          lineItems.push({
            description: cat.name,
            amountUsd: roundedAmount,
            amountEur,
            notes,
          });
          totalUsd += roundedAmount;
        }
      }

      res.json({ lineItems, totalUsd, totalEur: Math.round(totalUsd / exchangeRate) });
    } catch (error) {
      console.error("Calculate error:", error);
      res.status(500).json({ message: "Failed to calculate expenses" });
    }
  });

  app.post("/api/proformas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const user = await storage.getUser(userId);
      if (user) {
        const limit = user.proformaLimit ?? 1;
        const count = user.proformaCount ?? 0;
        if (user.subscriptionPlan !== "unlimited" && count >= limit) {
          return res.status(403).json({
            message: "Proforma limit reached. Please upgrade your plan to generate more proformas.",
            code: "LIMIT_REACHED",
            currentPlan: user.subscriptionPlan,
            proformaCount: count,
            proformaLimit: limit,
          });
        }
      }

      const { vesselId, portId, lineItems, totalUsd } = req.body;
      if (!vesselId || !portId || !lineItems || totalUsd === undefined) {
        return res.status(400).json({ message: "vesselId, portId, lineItems, and totalUsd are required" });
      }
      const refNum = `PDA-${Date.now().toString(36).toUpperCase()}`;
      const exchangeRate = req.body.exchangeRate ? Number(req.body.exchangeRate) : 1.1593;
      const proforma = await storage.createProforma({
        userId,
        vesselId: Number(vesselId),
        portId: Number(portId),
        referenceNumber: req.body.referenceNumber || refNum,
        toCompany: req.body.toCompany || null,
        toCountry: req.body.toCountry || null,
        purposeOfCall: req.body.purposeOfCall || "Loading",
        cargoType: req.body.cargoType || null,
        cargoQuantity: req.body.cargoQuantity ? Number(req.body.cargoQuantity) : null,
        cargoUnit: req.body.cargoUnit || "MT",
        berthStayDays: Number(req.body.berthStayDays) || 5,
        exchangeRate,
        lineItems: lineItems as any,
        totalUsd: Number(totalUsd),
        totalEur: req.body.totalEur ? Number(req.body.totalEur) : Math.round(Number(totalUsd) / exchangeRate),
        notes: req.body.notes || null,
        status: req.body.status || "draft",
      });

      await storage.incrementProformaCount(userId);

      res.json(proforma);
    } catch (error) {
      console.error("Create proforma error:", error);
      res.status(500).json({ message: "Failed to create proforma" });
    }
  });

  app.post("/api/subscription/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { plan } = req.body;

      const planLimits: Record<string, number> = {
        free: 1,
        standard: 10,
        unlimited: 999999,
      };

      if (!plan || !planLimits[plan]) {
        return res.status(400).json({ message: "Invalid plan. Choose: free, standard, or unlimited" });
      }

      const updated = await storage.updateSubscription(userId, plan, planLimits[plan]);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to upgrade subscription" });
    }
  });

  app.delete("/api/proformas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProforma(id, userId);
      if (!deleted) return res.status(404).json({ message: "Proforma not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete proforma" });
    }
  });

  return httpServer;
}
