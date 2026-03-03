import { pool } from "./db";

export async function ensureBunkerSchema() {
  console.log("[bunker] Ensuring schema...");
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bunker_records (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
        voyage_id INTEGER REFERENCES voyages(id) ON DELETE SET NULL,
        port_call_id INTEGER REFERENCES voyage_port_calls(id) ON DELETE SET NULL,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        record_type TEXT NOT NULL,
        record_date TIMESTAMP NOT NULL,
        fuel_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'MT',
        price_per_ton REAL,
        total_cost REAL,
        currency TEXT NOT NULL DEFAULT 'USD',
        supplier TEXT,
        delivery_note TEXT,
        rob_before REAL,
        rob_after REAL,
        port_name TEXT,
        notes TEXT,
        file_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bunker_surveys (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
        survey_date TIMESTAMP NOT NULL,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        ifo380_rob REAL NOT NULL DEFAULT 0,
        vlsfo_rob REAL NOT NULL DEFAULT 0,
        mgo_rob REAL NOT NULL DEFAULT 0,
        lsmgo_rob REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS bunker_records_vessel_id_idx ON bunker_records(vessel_id);
      CREATE INDEX IF NOT EXISTS bunker_records_voyage_id_idx ON bunker_records(voyage_id);
      CREATE INDEX IF NOT EXISTS bunker_records_record_date_idx ON bunker_records(record_date DESC);
      CREATE INDEX IF NOT EXISTS bunker_surveys_vessel_id_idx ON bunker_surveys(vessel_id);
    `);
    console.log("[bunker] ✓ Schema ready.");
  } finally {
    client.release();
  }
}
