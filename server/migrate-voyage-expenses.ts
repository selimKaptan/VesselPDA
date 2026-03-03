import { pool } from "./db";

export async function ensureVoyageExpensesSchema() {
  console.log("[voyage-expenses] Ensuring schema...");
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS voyage_expenses (
        id SERIAL PRIMARY KEY,
        voyage_id INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
        port_call_id INTEGER REFERENCES voyage_port_calls(id) ON DELETE SET NULL,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        budget_amount REAL,
        actual_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        exchange_rate REAL NOT NULL DEFAULT 1,
        amount_usd REAL,
        vendor TEXT,
        invoice_number TEXT,
        invoice_date TIMESTAMP,
        receipt_file_url TEXT,
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS voyage_budgets (
        id SERIAL PRIMARY KEY,
        voyage_id INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        budget_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(voyage_id, category)
      );

      CREATE INDEX IF NOT EXISTS voyage_expenses_voyage_id_idx ON voyage_expenses(voyage_id);
      CREATE INDEX IF NOT EXISTS voyage_expenses_category_idx ON voyage_expenses(category);
      CREATE INDEX IF NOT EXISTS voyage_budgets_voyage_id_idx ON voyage_budgets(voyage_id);
    `);
    console.log("[voyage-expenses] ✓ Schema ready.");
  } finally {
    client.release();
  }
}
