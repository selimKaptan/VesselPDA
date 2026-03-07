import { db } from "./db";
import { sql } from "drizzle-orm";

export async function ensureBunkerTables() {
  console.log("Ensuring bunker management tables exist...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bunker_orders (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
        voyage_id INTEGER REFERENCES voyages(id) ON DELETE SET NULL,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        port VARCHAR(200),
        order_date TIMESTAMP,
        delivery_date TIMESTAMP,
        fuel_type VARCHAR(50) NOT NULL,
        quantity_ordered REAL NOT NULL,
        quantity_delivered REAL,
        price_per_mt REAL,
        currency VARCHAR(10) DEFAULT 'USD',
        total_cost REAL,
        supplier VARCHAR(200),
        bdn_number VARCHAR(100),
        sulphur_content REAL,
        status VARCHAR(30) DEFAULT 'ordered',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bunker_robs (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
        voyage_id INTEGER REFERENCES voyages(id) ON DELETE SET NULL,
        report_date TIMESTAMP NOT NULL,
        hfo_rob REAL DEFAULT 0,
        mgo_rob REAL DEFAULT 0,
        lsfo_rob REAL DEFAULT 0,
        vlsfo_rob REAL DEFAULT 0,
        hfo_consumed REAL DEFAULT 0,
        mgo_consumed REAL DEFAULT 0,
        lsfo_consumed REAL DEFAULT 0,
        vlsfo_consumed REAL DEFAULT 0,
        reported_by VARCHAR NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Bunker management tables verified.");
  } catch (error) {
    console.error("Error creating bunker tables:", error);
  }
}
