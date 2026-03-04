import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  console.log(`[static] serving from: ${distPath}`);

  if (!fs.existsSync(distPath)) {
    const cwd = process.cwd();
    const alt = path.resolve(cwd, "dist", "public");
    console.error(`[static] primary path not found: ${distPath}, trying: ${alt}`);
    if (!fs.existsSync(alt)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
    return setupStatic(app, alt);
  }

  setupStatic(app, distPath);
}

function setupStatic(app: Express, distPath: string) {
  const indexHtml = path.resolve(distPath, "index.html");
  console.log(`[static] index.html exists: ${fs.existsSync(indexHtml)}`);

  app.get("/", (_req, res) => {
    res.sendFile(indexHtml);
  });

  app.use(express.static(distPath, { index: "index.html" }));

  app.use("/*path", (_req, res) => {
    res.sendFile(indexHtml);
  });
}
