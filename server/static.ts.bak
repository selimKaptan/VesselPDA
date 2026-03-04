import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const possiblePaths = [
    path.resolve(__dirname, "client"),
    path.resolve(__dirname, "..", "client"),
    path.resolve(__dirname, "..", "dist", "client"),
    path.resolve(process.cwd(), "dist", "client"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "dist"),
  ];

  let distPath: string | null = null;

  for (const p of possiblePaths) {
    const hasIndex = fs.existsSync(path.join(p, "index.html"));
    console.log("[static] checking:", p, "→ has index.html:", hasIndex);
    if (hasIndex) {
      distPath = p;
      break;
    }
  }

  if (!distPath) {
    console.error("[static] NO index.html found anywhere!");
    app.use((_req, res, next) => {
      if (_req.originalUrl.startsWith("/api")) return next();
      res.status(200).send("<!DOCTYPE html><html><head><title>VesselPDA</title></head><body><h1>VesselPDA is running</h1></body></html>");
    });
    return;
  }

  console.log("[static] Serving from:", distPath);

  app.use(express.static(distPath, { index: false, maxAge: "1d" }));

  app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/api")) return next();
    res.sendFile(path.join(distPath!, "index.html"));
  });
}
