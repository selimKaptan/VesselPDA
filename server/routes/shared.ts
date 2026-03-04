import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertVesselSchema, insertForumTopicSchema, insertForumReplySchema, insertCompanyProfileSchema
} from "@shared/schema";

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

export const uploadLogo = multer({
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

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const calculateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many calculations, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const vesselBodySchema = insertVesselSchema.partial().extend({
  name: z.string().trim().max(200).optional(),
});

export const forumTopicBodySchema = insertForumTopicSchema.partial().extend({
  title: z.string().trim().max(200),
  content: z.string().trim().max(5000),
});

export const forumReplyBodySchema = insertForumReplySchema.partial().extend({
  content: z.string().trim().max(5000),
});

export const companyProfileBodySchema = insertCompanyProfileSchema.partial().extend({
  companyName: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  email: z.string().email().optional().nullable(),
});

export async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
