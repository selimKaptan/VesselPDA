import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import path from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// esbuild plugin: replace server/vite.ts with a no-op stub in production.
// server/vite.ts imports vite.config.ts which uses import.meta.dirname —
// that becomes undefined in the CJS bundle and crashes. Since setupVite()
// is only called in development, we stub the entire module out.
const stubVitePlugin = {
  name: "stub-server-vite",
  setup(build: any) {
    const serverVitePath = path.resolve("server/vite.ts");
    build.onResolve({ filter: /\/vite$/ }, (args: any) => {
      const resolved = path.resolve(args.resolveDir, args.path + ".ts");
      if (resolved === serverVitePath) {
        return { path: resolved, namespace: "stub-vite" };
      }
    });
    build.onLoad({ filter: /.*/, namespace: "stub-vite" }, () => ({
      contents: "export async function setupVite() {}",
      loader: "js",
    }));
  },
};

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    plugins: [stubVitePlugin],
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
