import { pool } from "./db";

export async function ensureFinalDaSchema() {
  console.log("[final-da] Ensuring final_disbursements schema...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS final_disbursements (
      id SERIAL PRIMARY KEY,
      proforma_id INTEGER REFERENCES proformas(id) ON DELETE SET NULL,
      port_call_id INTEGER REFERENCES voyage_port_calls(id) ON DELETE SET NULL,
      voyage_id INTEGER REFERENCES voyages(id) ON DELETE SET NULL,
      user_id VARCHAR NOT NULL REFERENCES users(id),
      organization_id INTEGER REFERENCES organizations(id),
      vessel_id INTEGER REFERENCES vessels(id) ON DELETE SET NULL,
      port_id INTEGER NOT NULL REFERENCES ports(id),
      reference_number TEXT NOT NULL,
      to_company TEXT,
      line_items JSONB NOT NULL DEFAULT '[]',
      total_proforma REAL,
      total_actual REAL NOT NULL DEFAULT 0,
      total_variance REAL,
      variance_percentage REAL,
      currency TEXT DEFAULT 'USD',
      exchange_rate REAL DEFAULT 1,
      bank_details JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      closed_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fda_user ON final_disbursements(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fda_proforma ON final_disbursements(proforma_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fda_voyage ON final_disbursements(voyage_id)`);

  console.log("[final-da] ✓ final_disbursements schema ready.");
}
