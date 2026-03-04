import rateLimit from "express-rate-limit";
import { pool } from "../db";

const RATE_LIMIT_RESPONSE = {
  message: "Çok fazla istek. Lütfen biraz bekleyin.",
  retryAfter: 60,
};

// ── Admin TTL Cache ──────────────────────────────────────────────────────────
// Avoid a DB lookup on every request by caching admin status per userId.
const adminStatusCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function checkIsAdmin(userId: string): Promise<boolean> {
  const cached = adminStatusCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.isAdmin;

  try {
    const r = await pool.query(
      "SELECT user_role FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    const isAdmin = r.rows[0]?.user_role === "admin";
    adminStatusCache.set(userId, { isAdmin, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
    return isAdmin;
  } catch {
    return false;
  }
}

// Extract userId from the request (works with both session patterns in this app)
function getUserId(req: Request): string | undefined {
  const r = req as any;
  return r.user?.claims?.sub ?? r.user?.id ?? r.session?.userId ?? undefined;
}

async function skipAdmin(req: Request): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) return false;
  return checkIsAdmin(userId);
}

// ── Limiter Definitions ──────────────────────────────────────────────────────

/** Auth endpoints (login, register) — strict brute-force protection */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: RATE_LIMIT_RESPONSE,
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API — balanced rate limit for authenticated use */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: RATE_LIMIT_RESPONSE,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipAdmin,
});

/** AI chat — costly endpoint, tightly limited */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: RATE_LIMIT_RESPONSE,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipAdmin,
});

/** File upload — prevent storage abuse */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: RATE_LIMIT_RESPONSE,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipAdmin,
});

/** Search & lookup — prevent enumeration / scraping */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: RATE_LIMIT_RESPONSE,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipAdmin,
});
