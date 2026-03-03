import { pool } from "./db";

export async function ensurePortCallsSchema() {
  console.log("[port-calls] Ensuring voyage_port_calls schema...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS voyage_port_calls (
      id            SERIAL PRIMARY KEY,
      voyage_id     INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
      port_id       INTEGER NOT NULL REFERENCES ports(id),
      port_call_order INTEGER NOT NULL DEFAULT 1,
      port_call_type  TEXT NOT NULL DEFAULT 'discharging',
      status        TEXT NOT NULL DEFAULT 'planned',
      eta           TIMESTAMP,
      etd           TIMESTAMP,
      ata           TIMESTAMP,
      atd           TIMESTAMP,
      berth_name    TEXT,
      terminal_name TEXT,
      cargo_type    TEXT,
      cargo_quantity REAL,
      cargo_unit    TEXT DEFAULT 'MT',
      agent_user_id  VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      agent_company_id INTEGER,
      proforma_id   INTEGER REFERENCES proformas(id) ON DELETE SET NULL,
      notes         TEXT,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS vpc_voyage_id_idx ON voyage_port_calls(voyage_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS vpc_port_id_idx ON voyage_port_calls(port_id)`);

  await pool.query(`ALTER TABLE voyages ALTER COLUMN port_id DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE voyages ADD COLUMN IF NOT EXISTS voyage_number TEXT`);
  await pool.query(`ALTER TABLE voyages ADD COLUMN IF NOT EXISTS load_port TEXT`);
  await pool.query(`ALTER TABLE voyages ADD COLUMN IF NOT EXISTS voyage_type TEXT DEFAULT 'single'`);
  await pool.query(`ALTER TABLE voyages ADD COLUMN IF NOT EXISTS current_port_call_id INTEGER`);

  const { rows: noPortCall } = await pool.query(`
    SELECT v.id, v.port_id FROM voyages v
    WHERE v.port_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM voyage_port_calls vpc WHERE vpc.voyage_id = v.id)
    LIMIT 500
  `);

  if (noPortCall.length > 0) {
    console.log(`[port-calls] Migrating ${noPortCall.length} existing voyages to port_calls...`);
    for (const row of noPortCall) {
      await pool.query(
        `INSERT INTO voyage_port_calls (voyage_id, port_id, port_call_order, port_call_type, status)
         VALUES ($1, $2, 1, 'discharging', 'planned')
         ON CONFLICT DO NOTHING`,
        [row.id, row.port_id]
      );
    }
  }

  console.log("[port-calls] ✓ voyage_port_calls schema ready.");
}
