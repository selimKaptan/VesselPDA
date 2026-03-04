import path from "path";
import multer from "multer";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads", "logos");
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }

const logoStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, uploadsDir),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = \`logo_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\${ext}\`;
    cb(null, uniqueName);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) { cb(null, true); } else { cb(new Error("Only PNG, JPG, WEBP, SVG allowed")); }
  },
});
import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

router.patch("/user/role", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { role } = req.body;
    const VALID_ROLES = ["ship_agent", "shipowner", "ship_broker", "ship_provider", "admin"];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role. Choose: ship_agent, shipowner, ship_broker, or ship_provider" });
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

router.post("/admin/bootstrap", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const APPROVED_ADMINS = ["selim@barbarosshipping.com"];
    if (!user || !APPROVED_ADMINS.includes(user.email || "")) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const updated = await storage.updateUserRole(userId, "admin");
    await storage.updateActiveRole(userId, "admin");
    res.json({ success: true, userRole: updated?.userRole });
  } catch (error) {
    res.status(500).json({ message: "Bootstrap failed" });
  }
});

router.patch("/admin/active-role", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    if (!(await isAdmin(req))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { activeRole } = req.body;
    if (!["shipowner", "ship_agent", "ship_broker", "ship_provider", "admin"].includes(activeRole)) {
      return res.status(400).json({ message: "Invalid role. Choose: shipowner, ship_agent, ship_broker, ship_provider, or admin" });
    }
    const updated = await storage.updateActiveRole(userId, activeRole);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update active role" });
  }
});

router.get("/company-profile/me", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const profile = await storage.getCompanyProfileByUser(userId);
    res.json(profile || null);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch company profile" });
  }
});

router.post("/company-profile", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || !["ship_agent", "ship_provider", "admin", "agent", "provider"].includes(user.userRole)) {
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
      isApproved: false,
    });
    // Notify admin about pending company profile
    const admins = (await storage.getAllUsers()).filter((u: any) => u.userRole === "admin");
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        type: "system",
        title: "New Company Profile Pending Approval",
        message: `${companyName} has submitted a company profile and is awaiting approval.`,
        link: "/admin",
      });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to create company profile" });
  }
});

router.patch("/company-profile/:id", isAuthenticated, async (req: any, res) => {
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

router.post("/company-profile/logo", isAuthenticated, uploadLogo.single("logo"), async (req: any, res) => {
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

router.delete("/company-profile/logo", isAuthenticated, async (req: any, res) => {
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


export default router;
