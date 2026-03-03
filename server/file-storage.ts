import fs from "fs";
import path from "path";

const BASE_UPLOAD_DIR = path.join(process.cwd(), "uploads");

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
