import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import type { ProformaLineItem } from "@shared/schema";
import { calculateProforma, type CalculationInput } from "./proforma-calculator";

const uploadsDir = path.join(process.cwd(), "uploads", "logos");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPG, WEBP, SVG files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  async function isAdmin(req: any): Promise<boolean> {
    const userId = req.user?.claims?.sub;
    if (!userId) return false;
    const user = await storage.getUser(userId);
    return user?.userRole === "admin";
  }

  app.get("/api/vessels", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (await isAdmin(req)) {
        const vessels = await storage.getAllVessels();
        return res.json(vessels);
      }
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
      if (await isAdmin(req)) {
        const allProformas = await storage.getAllProformas();
        return res.json(allProformas);
      }
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
      if (await isAdmin(req)) {
        const proforma = await storage.getProformaById(id);
        if (!proforma) return res.status(404).json({ message: "Proforma not found" });
        return res.json(proforma);
      }
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
        if (user.userRole !== "admin" && user.subscriptionPlan !== "unlimited" && count >= limit) {
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
      if (!["shipowner", "agent", "provider", "admin"].includes(role)) {
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

  app.post("/api/admin/bootstrap", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const APPROVED_ADMINS = ["selim@barbarosshipping.com"];
      if (!user || !APPROVED_ADMINS.includes(user.email || "")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.updateUserRole(userId, "admin");
      await storage.updateActiveRole(userId, "agent");
      res.json({ success: true, userRole: updated?.userRole });
    } catch (error) {
      res.status(500).json({ message: "Bootstrap failed" });
    }
  });

  app.patch("/api/admin/active-role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!(await isAdmin(req))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { activeRole } = req.body;
      if (!["shipowner", "agent", "provider"].includes(activeRole)) {
        return res.status(400).json({ message: "Invalid role. Choose: shipowner, agent, or provider" });
      }
      const updated = await storage.updateActiveRole(userId, activeRole);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update active role" });
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
      if (!user || !["agent", "provider", "admin"].includes(user.userRole)) {
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

  app.post("/api/company-profile/logo", isAuthenticated, uploadLogo.single("logo"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      if (!profile) return res.status(404).json({ message: "Create a company profile first" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const fileBuffer = fs.readFileSync(req.file.path);
      const base64 = fileBuffer.toString("base64");
      const mimeType = req.file.mimetype || "image/png";
      const logoUrl = `data:${mimeType};base64,${base64}`;

      fs.unlinkSync(req.file.path);

      const updated = await storage.updateCompanyProfile(profile.id, userId, { logoUrl });
      res.json({ logoUrl, profile: updated });
    } catch (error: any) {
      if (error.message?.includes("Only PNG")) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.delete("/api/company-profile/logo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getCompanyProfileByUser(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const updated = await storage.updateCompanyProfile(profile.id, userId, { logoUrl: null });
      res.json({ success: true, profile: updated });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove logo" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/company-profiles", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const profiles = await storage.getAllCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
      const allUsers = await storage.getAllUsers();
      const allVessels = await storage.getAllVessels();
      const allProformas = await storage.getAllProformas();
      const allProfiles = await storage.getAllCompanyProfiles();
      res.json({
        totalUsers: allUsers.length,
        totalVessels: allVessels.length,
        totalProformas: allProformas.length,
        totalCompanyProfiles: allProfiles.length,
        usersByRole: {
          shipowner: allUsers.filter(u => u.userRole === "shipowner").length,
          agent: allUsers.filter(u => u.userRole === "agent").length,
          provider: allUsers.filter(u => u.userRole === "provider").length,
          admin: allUsers.filter(u => u.userRole === "admin").length,
        },
        usersByPlan: {
          free: allUsers.filter(u => u.subscriptionPlan === "free").length,
          standard: allUsers.filter(u => u.subscriptionPlan === "standard").length,
          unlimited: allUsers.filter(u => u.subscriptionPlan === "unlimited").length,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/service-ports", async (req, res) => {
    try {
      const profiles = await storage.getPublicCompanyProfiles();
      const allPorts = await storage.getPorts();
      const portMap = new Map(allPorts.map(p => [p.id, p]));

      const portCompanyMap: Record<number, { port: any; companies: any[] }> = {};
      for (const profile of profiles) {
        const served = (profile.servedPorts as number[]) || [];
        for (const portId of served) {
          if (!portCompanyMap[portId]) {
            const port = portMap.get(portId);
            if (!port) continue;
            portCompanyMap[portId] = { port, companies: [] };
          }
          portCompanyMap[portId].companies.push({
            id: profile.id,
            companyName: profile.companyName,
            companyType: profile.companyType,
            serviceTypes: profile.serviceTypes,
            city: profile.city,
            country: profile.country,
            isFeatured: profile.isFeatured,
            phone: profile.phone,
            email: profile.email,
            website: profile.website,
            logoUrl: profile.logoUrl,
          });
        }
      }

      const result = Object.values(portCompanyMap)
        .filter(entry => entry.companies.length > 0)
        .sort((a, b) => b.companies.length - a.companies.length);

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service ports" });
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

  app.get("/api/reviews/:companyProfileId", async (req, res) => {
    try {
      const companyProfileId = parseInt(req.params.companyProfileId);
      const reviews = await storage.getReviewsByCompany(companyProfileId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
      if (effectiveRole !== "shipowner") {
        return res.status(403).json({ message: "Only shipowners and brokers can leave reviews" });
      }

      const { companyProfileId, tenderId, rating, comment } = req.body;
      if (!companyProfileId) return res.status(400).json({ message: "companyProfileId is required" });
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be between 1 and 5" });

      const profile = await storage.getCompanyProfile(companyProfileId);
      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      let vesselName: string | undefined;
      let portName: string | undefined;

      if (tenderId) {
        const existing = await storage.getMyReviewForTender(userId, tenderId);
        if (existing) return res.status(400).json({ message: "You have already reviewed this job" });

        const tender = await storage.getPortTenderById(tenderId);
        if (tender) {
          if (tender.nominatedAgentId !== profile.userId) {
            return res.status(403).json({ message: "This agent was not nominated for that tender" });
          }
          if (tender.userId !== userId) {
            return res.status(403).json({ message: "This is not your tender" });
          }
          vesselName = tender.vesselName;
          portName = tender.portName;
        }
      }

      const review = await storage.createReview({
        companyProfileId,
        reviewerUserId: userId,
        tenderId: tenderId || null,
        rating,
        comment: comment || null,
        vesselName: vesselName || null,
        portName: portName || null,
      });

      res.json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/activity-feed", async (_req, res) => {
    try {
      const activities: { type: string; message: string; timestamp: string; icon: string }[] = [];

      const allVessels = await storage.getAllVessels();
      const vesselMap = new Map(allVessels.map(v => [v.id, v]));
      const allPorts = await storage.getPorts();
      const portMap = new Map(allPorts.map(p => [p.id, p]));

      const allProformas = await storage.getAllProformas();
      for (const p of allProformas.slice(0, 8)) {
        const vessel = p.vesselId ? vesselMap.get(p.vesselId) : null;
        const port = p.portId ? portMap.get(p.portId) : null;
        const vesselName = vessel?.name || "a vessel";
        const portName = port?.name || "port";
        activities.push({
          type: "proforma",
          message: `Proforma generated for ${vesselName} at ${portName}`,
          timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          icon: "filetext",
        });
      }

      const sortedVessels = allVessels
        .filter(v => v.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      for (const v of sortedVessels.slice(0, 6)) {
        activities.push({
          type: "vessel",
          message: `${v.name} (${v.flag}) registered to the fleet`,
          timestamp: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
          icon: "ship",
        });
      }

      const allProfiles = await storage.getAllCompanyProfiles();
      const sortedProfiles = allProfiles
        .filter(p => p.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      for (const p of sortedProfiles.slice(0, 6)) {
        const typeLabel = p.companyType === "agent" ? "Ship Agent" : "Service Provider";
        activities.push({
          type: "company",
          message: `${p.companyName} joined as ${typeLabel}`,
          timestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          icon: "building",
        });
      }

      const allUsers = await storage.getAllUsers();
      const sortedUsers = allUsers
        .filter(u => u.createdAt && u.userRole !== "admin")
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      for (const u of sortedUsers.slice(0, 4)) {
        const roleLabel = u.userRole === "agent" ? "Ship Agent" : u.userRole === "provider" ? "Service Provider" : "Shipowner";
        const name = u.firstName || "A maritime professional";
        activities.push({
          type: "user",
          message: `${name} joined VesselPDA as ${roleLabel}`,
          timestamp: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
          icon: "user",
        });
      }

      const recentTopics = await storage.getForumTopics({ sort: "latest", limit: 6 });
      for (const t of recentTopics) {
        activities.push({
          type: "forum",
          message: `"${t.title}" konusu forum'da açıldı`,
          timestamp: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
          icon: "message-square",
        });
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(activities.slice(0, 20));
    } catch (error) {
      console.error("Activity feed error:", error);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  app.get("/api/forum/categories", async (_req, res) => {
    try {
      const categories = await storage.getForumCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch forum categories" });
    }
  });

  app.get("/api/forum/topics", async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const sort = (req.query.sort as string) || "latest";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const topics = await storage.getForumTopics({ categoryId, sort, limit, offset });

      const topicsWithParticipants = await Promise.all(
        topics.map(async (t: any) => {
          const participants = await storage.getTopicParticipants(t.id, 5);
          return { ...t, participants };
        })
      );

      res.json(topicsWithParticipants);
    } catch (error) {
      console.error("Forum topics error:", error);
      res.status(500).json({ message: "Failed to fetch forum topics" });
    }
  });

  app.get("/api/forum/topics/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const topic = await storage.getForumTopic(id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });

      const replies = await storage.getForumReplies(id);
      const participants = await storage.getTopicParticipants(id, 10);

      res.json({ ...topic, replies, participants });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch topic" });
    }
  });

  app.post("/api/forum/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, content, categoryId, isAnonymous } = req.body;

      if (!title || !content || !categoryId) {
        return res.status(400).json({ message: "title, content, and categoryId are required" });
      }

      if (title.trim().length < 3) {
        return res.status(400).json({ message: "Title must be at least 3 characters" });
      }

      if (content.trim().length < 10) {
        return res.status(400).json({ message: "Content must be at least 10 characters" });
      }

      const topic = await storage.createForumTopic({
        userId,
        title: title.trim(),
        content: content.trim(),
        categoryId: Number(categoryId),
        isAnonymous: isAnonymous === true,
      });

      res.json(topic);
    } catch (error) {
      console.error("Create topic error:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.delete("/api/forum/topics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      const topic = await storage.getForumTopic(topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const user = await storage.getUser(userId);
      const isAdmin = user?.userRole === "admin";
      if (topic.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this topic" });
      }
      await storage.deleteForumTopic(topicId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete topic error:", error);
      res.status(500).json({ message: "Failed to delete topic" });
    }
  });

  app.post("/api/forum/topics/:id/replies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || content.trim().length < 1) {
        return res.status(400).json({ message: "Content is required" });
      }

      const topic = await storage.getForumTopic(topicId);
      if (!topic) return res.status(404).json({ message: "Topic not found" });

      if (topic.isLocked) {
        return res.status(403).json({ message: "This topic is locked" });
      }

      const reply = await storage.createForumReply({
        topicId,
        userId,
        content: content.trim(),
      });

      res.json(reply);
    } catch (error) {
      console.error("Create reply error:", error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  // ─── TENDER ROUTES ──────────────────────────────────────────────────────────

  app.get("/api/tenders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;

      if (effectiveRole === "agent") {
        const profile = await storage.getCompanyProfileByUser(userId);
        const servedPorts = (profile?.servedPorts as number[]) || [];
        const tenders = await Promise.all(
          servedPorts.map(portId => storage.getPortTenders({ portId, status: "open" }))
        );
        const flat = tenders.flat();
        const unique = flat.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
        return res.json({ role: "agent", tenders: unique });
      }

      const myTenders = await storage.getPortTenders({ userId });
      return res.json({ role: "shipowner", tenders: myTenders });
    } catch (error) {
      console.error("Get tenders error:", error);
      res.status(500).json({ message: "Failed to get tenders" });
    }
  });

  app.post("/api/tenders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;
      if (effectiveRole !== "shipowner") {
        return res.status(403).json({ message: "Only shipowners and brokers can create tenders" });
      }

      const { portId, vesselName, description, cargoInfo, expiryHours, grt, nrt, flag, cargoType, cargoQuantity, previousPort, q88Base64 } = req.body;
      if (!portId) return res.status(400).json({ message: "Port is required" });
      if (!vesselName) return res.status(400).json({ message: "Vessel name is required" });
      if (!flag) return res.status(400).json({ message: "Flag is required" });
      if (!grt) return res.status(400).json({ message: "GRT is required" });
      if (!nrt) return res.status(400).json({ message: "NRT is required" });
      if (!cargoType) return res.status(400).json({ message: "Cargo type is required" });
      if (!cargoQuantity) return res.status(400).json({ message: "Cargo quantity is required" });
      if (!previousPort) return res.status(400).json({ message: "Previous port is required" });
      if (![24, 48].includes(Number(expiryHours))) {
        return res.status(400).json({ message: "Expiry must be 24 or 48 hours" });
      }

      const tender = await storage.createPortTender({
        userId,
        portId: Number(portId),
        vesselName: vesselName || null,
        description: description || null,
        cargoInfo: cargoInfo || null,
        grt: grt ? Number(grt) : null,
        nrt: nrt ? Number(nrt) : null,
        flag: flag || null,
        cargoType: cargoType || null,
        cargoQuantity: cargoQuantity || null,
        previousPort: previousPort || null,
        q88Base64: q88Base64 || null,
        expiryHours: Number(expiryHours),
      });

      const agents = await storage.getAgentsByPort(Number(portId));
      res.json({ tender, agentCount: agents.length });
    } catch (error) {
      console.error("Create tender error:", error);
      res.status(500).json({ message: "Failed to create tender" });
    }
  });

  app.get("/api/tenders/my-bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bids = await storage.getTenderBidsByAgent(userId);
      res.json(bids);
    } catch (error) {
      console.error("Get my bids error:", error);
      res.status(500).json({ message: "Failed to get bids" });
    }
  });

  app.get("/api/tenders/badge-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.json({ count: 0 });

      const effectiveRole = user.userRole === "admin" ? (user.activeRole || "shipowner") : user.userRole;

      if (effectiveRole === "agent") {
        const profile = await storage.getCompanyProfileByUser(userId);
        const portIds = (profile?.servedPorts as number[]) || [];
        const count = await storage.getTenderCountForAgent(userId, portIds);
        return res.json({ count });
      }

      const myTenders = await storage.getPortTenders({ userId, status: "open" });
      const withBids = myTenders.filter(t => (t.bidCount || 0) > 0);
      return res.json({ count: withBids.length });
    } catch (error) {
      res.json({ count: 0 });
    }
  });

  app.get("/api/tenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const tenderId = parseInt(req.params.id);
      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Tender not found" });

      const isAdminUser = user.userRole === "admin";
      const effectiveRole = isAdminUser ? (user.activeRole || "shipowner") : user.userRole;

      if (!isAdminUser) {
        if (effectiveRole === "provider") {
          return res.status(403).json({ message: "Access denied" });
        }
        if (effectiveRole === "shipowner" && tender.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (effectiveRole === "agent") {
          const profile = await storage.getCompanyProfileByUser(userId);
          const servedPorts = (profile?.servedPorts as number[]) || [];
          if (!servedPorts.includes(tender.portId)) {
            return res.status(403).json({ message: "This tender is not in your served ports" });
          }
          const bids = await storage.getTenderBids(tenderId);
          const myBid = bids.find(b => b.agentUserId === userId) || null;
          return res.json({ tender, bids: myBid ? [myBid] : [], myBid, isOwner: false });
        }
      }

      const bids = await storage.getTenderBids(tenderId);
      const bidsNoPdf = bids.map(({ proformaPdfBase64: _pdf, ...b }) => b);
      res.json({ tender, bids: bidsNoPdf, myBid: null, isOwner: tender.userId === userId || isAdminUser });
    } catch (error) {
      console.error("Get tender error:", error);
      res.status(500).json({ message: "Failed to get tender" });
    }
  });

  app.delete("/api/tenders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });
      if (tender.userId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (tender.status !== "open") {
        return res.status(400).json({ message: "Can only cancel open tenders" });
      }
      await storage.updatePortTenderStatus(tenderId, "cancelled");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel tender" });
    }
  });

  app.post("/api/tenders/:id/bids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const tenderId = parseInt(req.params.id);
      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Tender not found" });
      if (tender.status !== "open") return res.status(400).json({ message: "Tender is no longer open" });

      const expiresAt = new Date(tender.createdAt).getTime() + tender.expiryHours * 3600000;
      if (Date.now() > expiresAt) return res.status(400).json({ message: "Tender has expired" });

      const existingBids = await storage.getTenderBids(tenderId);
      if (existingBids.some(b => b.agentUserId === userId)) {
        return res.status(400).json({ message: "You have already submitted a bid for this tender" });
      }

      const profile = await storage.getCompanyProfileByUser(userId);
      const { notes, totalAmount, currency, proformaPdfBase64 } = req.body;

      if (proformaPdfBase64 && proformaPdfBase64.length > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "PDF file is too large (max 5MB)" });
      }

      const bid = await storage.createTenderBid({
        tenderId,
        agentUserId: userId,
        agentCompanyId: profile?.id || null,
        proformaPdfBase64: proformaPdfBase64 || null,
        notes: notes || null,
        totalAmount: totalAmount || null,
        currency: currency || "USD",
      });

      res.json(bid);
    } catch (error) {
      console.error("Create bid error:", error);
      res.status(500).json({ message: "Failed to submit bid" });
    }
  });

  app.post("/api/tenders/:id/bids/:bidId/select", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const bidId = parseInt(req.params.bidId);

      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });
      if (tender.userId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const bids = await storage.getTenderBids(tenderId);
      for (const bid of bids) {
        await storage.updateTenderBidStatus(bid.id, bid.id === bidId ? "selected" : "rejected");
      }
      await storage.updatePortTenderStatus(tenderId, "closed");

      const selectedBid = bids.find(b => b.id === bidId);
      res.json({ success: true, selectedBid });
    } catch (error) {
      console.error("Select bid error:", error);
      res.status(500).json({ message: "Failed to select bid" });
    }
  });

  app.post("/api/tenders/:id/nominate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);

      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });
      if (tender.userId !== userId && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const bids = await storage.getTenderBids(tenderId);
      const selectedBid = bids.find(b => b.status === "selected");
      if (!selectedBid) return res.status(400).json({ message: "No bid selected yet" });

      await storage.updatePortTenderStatus(tenderId, "nominated", selectedBid.agentUserId);

      res.json({
        success: true,
        nominatedAgent: {
          companyName: selectedBid.companyName,
          email: selectedBid.agentEmail,
          agentFirstName: selectedBid.agentFirstName,
          agentLastName: selectedBid.agentLastName,
        },
      });
    } catch (error) {
      console.error("Nominate error:", error);
      res.status(500).json({ message: "Failed to process nomination" });
    }
  });

  app.get("/api/tenders/:id/bids/:bidId/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tenderId = parseInt(req.params.id);
      const bidId = parseInt(req.params.bidId);

      const tender = await storage.getPortTenderById(tenderId);
      if (!tender) return res.status(404).json({ message: "Not found" });

      const bids = await storage.getTenderBids(tenderId);
      const bid = bids.find(b => b.id === bidId);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      const isOwner = tender.userId === userId;
      const isThisAgent = bid.agentUserId === userId;
      if (!isOwner && !isThisAgent && !(await isAdmin(req))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allBids = await storage.getTenderBids(tenderId);
      const fullBid = allBids.find(b => b.id === bidId);
      res.json({ proformaPdfBase64: fullBid?.proformaPdfBase64 || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get PDF" });
    }
  });

  return httpServer;
}
