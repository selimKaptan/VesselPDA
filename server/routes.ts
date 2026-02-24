import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { ProformaLineItem } from "@shared/schema";
import { calculateProforma, type CalculationInput } from "./proforma-calculator";

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

  app.get("/api/ports", async (req, res) => {
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
      const {
        vesselId, portId, berthStayDays = 5, cargoQuantity,
        anchorageDays = 0, isDangerousCargo = false,
        customsType = "import", flagCategory = "turkish",
        dtoCategory = "turkish", lighthouseCategory = "turkish",
        vtsCategory = "turkish", wharfageCategory = "foreign",
        usdTryRate = 43.86, eurTryRate = 51.73
      } = req.body;
      const userId = req.user.claims.sub;

      if (!vesselId || !portId) {
        return res.status(400).json({ message: "vesselId and portId are required" });
      }

      const vessel = await storage.getVessel(Number(vesselId), userId);
      if (!vessel) return res.status(404).json({ message: "Vessel not found" });

      const port = await storage.getPort(Number(portId));
      if (!port) return res.status(404).json({ message: "Port not found" });

      const usdRate = Number(usdTryRate) || 43.86;
      const eurRate = Number(eurTryRate) || 51.73;
      const eurUsdParity = eurRate / usdRate;

      const calcInput: CalculationInput = {
        nrt: vessel.nrt,
        grt: vessel.grt,
        cargoQuantity: cargoQuantity ? Number(cargoQuantity) : 0,
        berthStayDays: Number(berthStayDays) || 5,
        anchorageDays: Number(anchorageDays) || 0,
        isDangerousCargo: isDangerousCargo === true || isDangerousCargo === "true",
        customsType: customsType || "import",
        flagCategory: flagCategory || "turkish",
        dtoCategory: dtoCategory || "turkish",
        lighthouseCategory: lighthouseCategory || "turkish",
        vtsCategory: vtsCategory || "turkish",
        wharfageCategory: wharfageCategory || "foreign",
        usdTryRate: usdRate,
        eurTryRate: eurRate,
        eurUsdParity,
      };

      const result = calculateProforma(calcInput);
      res.json({
        lineItems: result.lineItems,
        totalUsd: result.totalUsd,
        totalEur: result.totalEur,
        eurUsdParity: Math.round(eurUsdParity * 1000000) / 1000000,
      });
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

  app.patch("/api/user/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      if (!["shipowner", "agent", "provider"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Choose: shipowner, agent, or provider" });
      }
      const user = await storage.getUser(userId);
      if (user && user.roleConfirmed) {
        return res.status(403).json({ message: "Role already confirmed. You cannot change your role." });
      }
      const updated = await storage.updateUserRole(userId, role);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.get("/api/company-profile/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      res.json(profile || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  app.post("/api/company-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !["agent", "provider"].includes(user.userRole)) {
        return res.status(403).json({ message: "Only agents and providers can create company profiles" });
      }
      const existing = await storage.getCompanyProfileByUser(userId);
      if (existing) {
        return res.status(400).json({ message: "Profile already exists. Use PATCH to update." });
      }
      const { companyName, companyType, description, phone, email, website, address, city, country, servedPorts, serviceTypes } = req.body;
      if (!companyName) return res.status(400).json({ message: "companyName is required" });
      const profile = await storage.createCompanyProfile({
        userId,
        companyName,
        companyType: companyType || "agent",
        description: description || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        city: city || null,
        country: country || "Turkey",
        servedPorts: servedPorts || [],
        serviceTypes: serviceTypes || [],
      });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to create company profile" });
    }
  });

  app.patch("/api/company-profile/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { companyName, companyType, description, phone, email, website, address, city, country, servedPorts, serviceTypes } = req.body;
      const safeData: Record<string, any> = {};
      if (companyName !== undefined) safeData.companyName = companyName;
      if (companyType !== undefined) safeData.companyType = companyType;
      if (description !== undefined) safeData.description = description;
      if (phone !== undefined) safeData.phone = phone;
      if (email !== undefined) safeData.email = email;
      if (website !== undefined) safeData.website = website;
      if (address !== undefined) safeData.address = address;
      if (city !== undefined) safeData.city = city;
      if (country !== undefined) safeData.country = country;
      if (servedPorts !== undefined) safeData.servedPorts = servedPorts;
      if (serviceTypes !== undefined) safeData.serviceTypes = serviceTypes;
      const updated = await storage.updateCompanyProfile(id, userId, safeData);
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update company profile" });
    }
  });

  app.get("/api/directory", async (req, res) => {
    try {
      const companyType = req.query.type as string | undefined;
      const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
      const profiles = await storage.getPublicCompanyProfiles({ companyType, portId });
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch directory" });
    }
  });

  app.get("/api/directory/featured", async (req, res) => {
    try {
      const profiles = await storage.getFeaturedCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured profiles" });
    }
  });

  app.get("/api/directory/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getCompanyProfile(id);
      if (!profile || !profile.isActive) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  return httpServer;
}
