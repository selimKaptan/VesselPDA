import { Router } from "express";
import { pool } from "../db";
import { isAuthenticated, authStorage } from "../replit_integrations/auth";
import { storage } from "../storage";
import { authLimiter, fileUpload } from "./shared";

const router = Router();

router.post("/api/demo/login", authLimiter, async (req: any, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["agent", "shipowner", "broker", "provider", "master"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid demo role" });
    }
    const bcrypt = await import("bcryptjs");
    const demoEmail = `demo.${role}@vpda.demo`;
    const demoFirstName = role === "agent" ? "Demo Agent" : role === "shipowner" ? "Demo Owner" : role === "broker" ? "Demo Broker" : "Demo Provider";
    const demoLastName = "";
    let user = await authStorage.getUserByEmail(demoEmail);
    if (!user) {
      const passwordHash = await bcrypt.hash("demo123", 10);
      user = await authStorage.createUser({
        email: demoEmail,
        firstName: demoFirstName,
        lastName: demoLastName,
        passwordHash,
        userRole: role,
        roleConfirmed: true,
        verificationToken: "",
        verificationTokenExpiry: new Date(),
      });
      await authStorage.markEmailVerified(user.id);
      await pool.query(
        "UPDATE users SET subscription_plan = 'standard' WHERE id = $1",
        [user.id]
      );
      user = (await authStorage.getUserByEmail(demoEmail))!;
    }
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => req.session.save((err: any) => err ? reject(err) : resolve()));
    return res.json({ ok: true, role });
  } catch (err) {
    console.error("[demo] login error:", err);
    return res.status(500).json({ message: "Demo login failed" });
  }
});


router.post("/api/files/upload", isAuthenticated, fileUpload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const { uploadFile } = await import("../file-storage");
    const folder = (req.query.folder as string) || "documents";
    const allowedFolders = ["documents", "certificates", "crew"];
    const safeFolder = allowedFolders.includes(folder) ? folder : "documents";
    const url = uploadFile(req.file.buffer, req.file.originalname, safeFolder);
    res.json({
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (e: any) {
    res.status(500).json({ message: "Upload failed", error: e.message });
  }
});


router.patch("/api/user/role", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { role } = req.body;
    if (!["shipowner", "agent", "provider", "broker", "master"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Choose: shipowner, agent, provider, broker, or master" });
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


router.patch("/api/user/onboarding-complete", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { companyName } = req.body || {};
    const updated = await storage.updateUserOnboarding(userId, { onboardingCompleted: true, onboardingStep: 5 });
    if (companyName) {
      const existing = await storage.getCompanyProfileByUser(userId);
      if (!existing) {
        const user = await storage.getUser(userId);
        await storage.createCompanyProfile({
          userId,
          companyName,
          companyType: user?.userRole || "agent",
        });
      }
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to complete onboarding" });
  }
});

router.patch("/api/user/onboarding-step", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { step } = req.body;
    if (typeof step !== "number") return res.status(400).json({ message: "step must be a number" });
    await storage.updateUserOnboarding(userId, { onboardingStep: step });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update onboarding step" });
  }
});

router.patch("/api/user/onboarding-reset", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    await storage.updateUserOnboarding(userId, { onboardingCompleted: false, onboardingStep: 0 });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset onboarding" });
  }
});

export default router;
