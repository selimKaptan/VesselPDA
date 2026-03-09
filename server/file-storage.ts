import fs from "fs";
import path from "path";
import crypto from "crypto";

const BASE_UPLOAD_DIR = path.join(process.cwd(), "uploads");

const CATEGORY_DIRS = {
  documents: "documents",
  certificates: "certificates",
  crew: "crew",
  proformas: "proformas",
  logos: "logos",
  bids: "bids",
} as const;

export type UploadCategory = keyof typeof CATEGORY_DIRS;

export function ensureDir(folder: string): string {
  const dir = path.join(BASE_UPLOAD_DIR, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function uploadFile(
  buffer: Buffer,
  originalName: string,
  folder: string = "documents"
): string {
  const dir = ensureDir(folder);
  const ext = path.extname(originalName).toLowerCase();
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${folder}/${safeName}`;
}

export function saveBase64File(
  base64Data: string,
  category: UploadCategory,
  _originalName?: string
): string {
  const dir = ensureDir(CATEGORY_DIRS[category]);

  // Parse "data:<mime>;base64,<data>" or plain base64
  let mimeType = "";
  let rawData = base64Data;
  const markerIdx = base64Data.indexOf(";base64,");
  if (markerIdx !== -1 && base64Data.startsWith("data:")) {
    mimeType = base64Data.slice(5, markerIdx);
    rawData = base64Data.slice(markerIdx + 8);
  }

  const extMap: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  const ext = extMap[mimeType] || (mimeType.split("/")[1] || "bin").split(";")[0];
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, Buffer.from(rawData, "base64"));
  return `/uploads/${CATEGORY_DIRS[category]}/${fileName}`;
}

export function saveBase64ToFile(
  base64Data: string,
  subDir: string,
  originalFileName?: string
): { fileUrl: string; fileName: string; fileSize: number } {
  const dir = ensureDir(subDir);

  let mimeType = "";
  let rawData = base64Data;
  const markerIdx = base64Data.indexOf(";base64,");
  if (markerIdx !== -1 && base64Data.startsWith("data:")) {
    mimeType = base64Data.slice(5, markerIdx);
    rawData = base64Data.slice(markerIdx + 8);
  }

  const extMap: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  const resolvedExt = originalFileName ? path.extname(originalFileName) : (extMap[mimeType] || ".bin");
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${resolvedExt}`;
  const filePath = path.join(dir, fileName);
  const buffer = Buffer.from(rawData, "base64");
  fs.writeFileSync(filePath, buffer);

  return {
    fileUrl: `/uploads/${subDir}/${fileName}`,
    fileName: originalFileName || fileName,
    fileSize: buffer.length,
  };
}

export function getFileAsBase64(filePath: string): string | null {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return null;
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const mime = mimeTypes[ext] || "application/octet-stream";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export function deleteFile(fileUrl: string): void {
  try {
    if (!fileUrl || !fileUrl.startsWith("/uploads/")) return;
    const filePath = path.join(process.cwd(), fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
  }
}

export function getFileSize(buffer: Buffer): number {
  return buffer.length;
}
