/**
 * Strip HTML tags and escape dangerous characters to prevent XSS.
 * Use on any user-supplied text that will be rendered or stored.
 */
export function sanitizeInput(text: unknown): string {
  if (typeof text !== "string") return text == null ? "" : String(text);
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/**
 * Sanitize a filename:
 * - Strips path traversal sequences (../, ..\)
 * - Replaces characters not in [a-zA-Z0-9._-] with underscores
 * - Collapses multiple consecutive underscores
 * - Trims to 200 characters (leaves room for ext + unique suffix)
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== "string") return "file";
  return name
    .replace(/\.\.[/\\]/g, "")
    .replace(/[^a-zA-Z0-9._\-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 200) || "file";
}

/**
 * Recursively sanitize all string fields in a plain object.
 * Safe to use on req.body before persisting user-generated content.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string") {
      result[key] = sanitizeInput(val);
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      result[key] = sanitizeObject(val as Record<string, unknown>);
    }
  }
  return result as T;
}
