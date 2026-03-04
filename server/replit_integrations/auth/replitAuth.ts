import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { config } from "../../config";
import { pool } from "../../db";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: config.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: config.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).user = { claims: { sub: userId } };
  next();
};

export function requireRole(...roles: string[]): RequestHandler {
  return async (req: any, res, next) => {
    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { rows } = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
      const userRole = rows[0]?.user_role;
      if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      (req as any).user = { claims: { sub: userId }, userRole };
      next();
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}
