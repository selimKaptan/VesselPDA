import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStaticFiles, serveSpaFallback } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { startCronJobs } from "./cron-jobs";
import { initSocket } from "./socket";

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

const corsOptions: cors.CorsOptions = {
  origin: process.env.NODE_ENV === "production"
    ? ["https://vesselpda.com", "https://www.vesselpda.com", /\.replit\.dev$/, /\.repl\.co$/]
    : true,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:", "https://*.basemaps.cartocdn.com", "https://tiles.openseamap.org"],
      connectSrc: ["'self'", "ws:", "wss:", "https://api.anthropic.com", "https://nominatim.openstreetmap.org", "https://stream.aisstream.io", "https://tiles.stadiamaps.com", "https://*.tile.openstreetmap.org", "https://api.mapbox.com", "https://events.mapbox.com", "https://*.mapbox.com", "https://*.basemaps.cartocdn.com", "https://tiles.openseamap.org", "https://api.datalastic.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:", "https://api.mapbox.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== "production",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { message: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== "production",
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

if (process.env.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.hostname.startsWith("www.")) {
      const nonWwwHost = req.hostname.slice(4);
      return res.redirect(301, `https://${nonWwwHost}${req.originalUrl}`);
    }
    next();
  });
}

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (certificates, crew docs, bid PDFs, voyage documents)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

// In production, register express.static HERE (synchronously, before routes)
// so the "/" health check immediately gets 200 (index.html) from the very
// first request. The SPA catch-all is registered later (after API routes)
// to avoid swallowing /api/* paths.
if (process.env.NODE_ENV === "production") {
  serveStaticFiles(app);
}

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
  console.log("Server listening on port " + port);
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

  if (process.env.NODE_ENV === "production") {
    serveSpaFallback(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  setTimeout(() => {
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
    import("./ensure-bunker-tables").then(({ ensureBunkerTables }) => {
      ensureBunkerTables().catch((err: Error) => console.error("Bunker tables error:", err));
    });
    import("./startup-checks").then(({ runStartupChecks }) => {
      runStartupChecks().catch((err: Error) => console.error("Startup checks error:", err));
    });
    import("./cleanup-ports").then(({ cleanupInvalidPorts }) => {
      cleanupInvalidPorts().catch((err: Error) => console.error("Cleanup error:", err));
    });
  }, 10000);

  setTimeout(() => { startCronJobs(); }, 45000);

  setTimeout(() => {
    import("./sanctions").then(({ loadSanctionsList }) => {
      loadSanctionsList().catch((err: Error) => console.error("Sanctions load error:", err));
    });
  }, 90000);

  setTimeout(() => {
    import("./geocode-ports").then(({ geocodeMissingPorts }) => {
      geocodeMissingPorts().catch((err: Error) => console.error("Geocode error:", err));
    });
  }, 120000);
})();
