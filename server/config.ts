import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — provision a PostgreSQL database"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required — set a random secret string"),

  // Replit AI integration (auto-injected by Replit integration system)
  AI_INTEGRATIONS_ANTHROPIC_API_KEY: z.string().optional(),
  AI_INTEGRATIONS_ANTHROPIC_BASE_URL: z.string().optional(),

  // External API keys (optional — features degrade gracefully when absent)
  AIS_STREAM_API_KEY: z.string().optional(),
  VESSEL_API_KEY: z.string().optional(),
  TRADING_ECONOMICS_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Replit connector tokens (auto-injected in Replit hosted environments)
  REPLIT_CONNECTORS_HOSTNAME: z.string().optional(),
  REPL_IDENTITY: z.string().optional(),
  WEB_REPL_RENEWAL: z.string().optional(),

  // Server settings
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Missing or invalid environment variables:");
  for (const issue of result.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = result.data;
