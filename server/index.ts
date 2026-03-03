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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.PORT;
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      import("./seed").then(({ seedDatabase, seedForumCategories, seedPortCoordinates }) => {
        seedDatabase().catch((err: Error) => console.error("Seed error:", err));
        seedForumCategories().catch((err: Error) => console.error("Forum seed error:", err));
        seedPortCoordinates().catch((err: Error) => console.error("Port coords seed error:", err));
      });

      seedBunkerPrices().catch((err: Error) => console.error("Bunker seed error:", err));

      seedTestAdmin().catch((err: Error) => console.error("Test admin seed error:", err));

      import("./seed-templates").then(({ seedDocumentTemplates }) => {
        seedDocumentTemplates().catch((err: Error) => console.error("Template seed error:", err));
      });

      import("./seed-tariffs").then(({ seedTariffData, ensureNewTariffTables }) => {
        ensureNewTariffTables()
          .then(() => seedTariffData())
          .catch((err: Error) => console.error("Tariff setup error:", err));
      });

      import("./migrate-port-calls").then(({ ensurePortCallsSchema }) => {
        ensurePortCallsSchema().catch((err: Error) => console.error("Port-calls migration error:", err));
      });

      import("./migrate-sof").then(({ ensureSofSchema }) => {
        ensureSofSchema().catch((err: Error) => console.error("SOF migration error:", err));
      });

      import("./migrate-final-da").then(({ ensureFinalDaSchema }) => {
        ensureFinalDaSchema().catch((err: Error) => console.error("Final DA migration error:", err));
      });

      import("./migrate-voyage-expenses").then(({ ensureVoyageExpensesSchema }) => {
        ensureVoyageExpensesSchema().catch((err: Error) => console.error("Voyage expenses migration error:", err));
      });

      import("./startup-checks").then(({ runStartupChecks }) => {
        setTimeout(() => {
          runStartupChecks().catch((err: Error) => console.error("Startup checks error:", err));
        }, 10000);
      });

      import("./cleanup-ports").then(({ cleanupInvalidPorts }) => {
        cleanupInvalidPorts().catch((err: Error) => console.error("Cleanup error:", err));
      });

      import("./sanctions").then(({ loadSanctionsList }) => {
        setTimeout(() => {
          loadSanctionsList().catch((err: Error) => console.error("Sanctions load error:", err));
        }, 5000);
      });

      import("./geocode-ports").then(({ geocodeMissingPorts }) => {
        setTimeout(() => {
          geocodeMissingPorts().catch((err: Error) => console.error("Geocode error:", err));
        }, 15000);
      });

      startCronJobs();
    },
  );
})();
