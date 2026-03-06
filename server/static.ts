import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function getDistPath() {
  return path.resolve(__dirname, "public");
}

export function serveStaticFiles(app: Express) {
  const distPath = getDistPath();
  if (!fs.existsSync(distPath)) {
    console.warn(`[static] dist/public not found at ${distPath} — static files not served yet`);
    return;
  }
  app.use(express.static(distPath));
}

export function serveSpaFallback(app: Express) {
  const distPath = getDistPath();
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export function serveStatic(app: Express) {
  serveStaticFiles(app);
  serveSpaFallback(app);
}
