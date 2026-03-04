import path from "path";
import fsNode from "fs";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { startCronJobs } from "./cron-jobs";
import { initSocket } from "./socket";
import { config } from "./config";

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (_req, res) => { const p = require("path").resolve(__dirname, "client", "index.html"); if (require("fs").existsSync(p)) return res.sendFile(p); res.status(200).send("<html><body><h1>VesselPDA</h1></body></html>"); });
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "https://tiles.openseamap.org"],
      connectSrc: [
        "'self'",
        "ws://localhost:5000",
        "wss://localhost:5000",
        "wss://stream.aisstream.io",
        "https://stream.aisstream.io",
        "https://evds2.tcmb.gov.tr",
        "https://api.zylalabs.com",
        "https://api.resend.com",
        "https://api.mapbox.com",
        "https://events.mapbox.com",
        "https://*.tiles.mapbox.com",
        "https://marine-api.open-meteo.com",
        "https://api.open-meteo.com",
        "https://tiles.openseamap.org",
        "https://nominatim.openstreetmap.org",
        "https://ofac.treasury.gov",
        "https://query1.finance.yahoo.com",
        "https://query2.finance.yahoo.com",
      ],
      workerSrc: ["'self'", "blob:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

if (config.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.hostname.startsWith("www.")) {
      const nonWwwHost = req.hostname.slice(4);
      return res.redirect(301, `https://${nonWwwHost}${req.originalUrl}`);
    }
    next();
  });
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

async function seedTestAdmin() {
  const TEST_ADMIN_EMAIL = "test_admin@vpda.test";
  try {
    const existing = await db.execute(
      sql`SELECT id FROM users WHERE email = ${TEST_ADMIN_EMAIL} LIMIT 1`
    );
    const rows: any[] = (existing as any).rows ?? (existing as any);
    if (rows.length > 0) {
      console.log("[seed] Test admin account already exists, skipping.");
      return;
    }
    const passwordHash = await bcrypt.hash("TestPass123!", 12);
    await db.execute(sql`
      INSERT INTO users (id, email, password_hash, first_name, last_name, user_role, active_role, email_verified, role_confirmed, is_suspended)
      VALUES (
        gen_random_uuid(),
        ${TEST_ADMIN_EMAIL},
        ${passwordHash},
        'Test',
        'Admin',
        'admin',
        'admin',
        true,
        true,
        false
      )
    `);
    console.log(`[seed] Test admin account ready: ${TEST_ADMIN_EMAIL}`);
  } catch (err) {
    console.error("[seed] Test admin seed error:", err);
  }
}

async function seedBunkerPrices() {
  const existing = await storage.getBunkerPrices();
  if (existing.length > 0) return;
  const BUNKER_SEED = [
    { portName: "İstanbul", portCode: "TRIST", region: "TR", ifo380: 410, vlsfo: 545, mgo: 715 },
    { portName: "Mersin",   portCode: "TRMER", region: "TR", ifo380: 405, vlsfo: 540, mgo: 710 },
    { portName: "İzmir",    portCode: "TRIZM", region: "TR", ifo380: 408, vlsfo: 543, mgo: 712 },
    { portName: "Rotterdam",portCode: "NLRTM", region: "EU", ifo380: 395, vlsfo: 520, mgo: 700 },
    { portName: "Singapore",portCode: "SGSIN", region: "ASIA", ifo380: 400, vlsfo: 530, mgo: 695 },
    { portName: "Fujairah", portCode: "AEFUJ", region: "ME",   ifo380: 415, vlsfo: 550, mgo: 720 },
    { portName: "Houston",  portCode: "USHOU", region: "US",   ifo380: 420, vlsfo: 555, mgo: 725 },
  ];
  for (const row of BUNKER_SEED) {
    await storage.upsertBunkerPrice(row);
  }
  console.log("Bunker prices seeded.");
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

const port = config.PORT;
httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => { console.log("Server is ready and listening on port " + port); });
(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (config.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

})();
