import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, uploadLogo, companyProfileBodySchema } from "./shared";
import { insertCompanyProfileSchema } from "@shared/schema";
import { emitToUser } from "../socket";
import { logAction, getClientIp } from "../audit";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/me", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const profile = await storage.getCompanyProfileByUser(userId);
    res.json(profile || null);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch company profile" });
  }
});


router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const companyParsed = companyProfileBodySchema.safeParse(req.body);
    if (!companyParsed.success) return res.status(400).json({ error: "Invalid input", details: companyParsed.error.errors });
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


router.patch("/:id", isAuthenticated, async (req: any, res) => {
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


router.post("/logo", isAuthenticated, uploadLogo.single("logo"), async (req: any, res) => {
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


router.delete("/logo", isAuthenticated, async (req: any, res) => {
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


router.post("/request-verification", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const profile = await storage.getCompanyProfileByUser(userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    const { taxNumber, mtoRegistrationNumber, pandiClubName } = req.body;
    if (!taxNumber) return res.status(400).json({ message: "Tax number is required" });
    const updated = await storage.requestVerification(profile.id, userId, { taxNumber, mtoRegistrationNumber, pandiClubName });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to request verification" });
  }
});


export default router;
