import { pool } from "./db";

export async function ensureRemindersSchema() {
  console.log("[reminders] Ensuring schema...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        type TEXT NOT NULL DEFAULT 'manual',
        category TEXT NOT NULL DEFAULT 'custom',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        priority TEXT NOT NULL DEFAULT 'normal',
        due_date TIMESTAMPTZ,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        is_snoozed BOOLEAN NOT NULL DEFAULT FALSE,
        snoozed_until TIMESTAMPTZ,
        sent_via_email BOOLEAN NOT NULL DEFAULT FALSE,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminder_rules (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
        rule_type TEXT NOT NULL,
        trigger_condition TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (COALESCE(organization_id, 0), COALESCE(user_id, ''), rule_type)
      )
    `);

    const { rows: existing } = await pool.query(`SELECT id FROM reminder_rules LIMIT 1`);
    if (existing.length === 0) {
      await seedDefaultRules();
    }

    console.log("[reminders] ✓ Schema ready.");
  } catch (err) {
    console.error("[reminders] Schema error:", err);
  }
}

async function seedDefaultRules() {
  const rules = [
    { rule_type: "tender_response",    trigger_condition: "no_response_hours:48",  email_enabled: true },
    { rule_type: "document_missing",   trigger_condition: "departure_hours:24",     email_enabled: false },
    { rule_type: "certificate_expiry", trigger_condition: "expiry_days:30",         email_enabled: true },
    { rule_type: "invoice_overdue",    trigger_condition: "overdue_days:3",         email_enabled: true },
    { rule_type: "da_pending",         trigger_condition: "departure_days:3",       email_enabled: false },
    { rule_type: "nomination_pending", trigger_condition: "no_response_hours:48",   email_enabled: false },
    { rule_type: "sof_incomplete",     trigger_condition: "departure_hours:24",     email_enabled: false },
    { rule_type: "proforma_followup",  trigger_condition: "no_response_days:5",     email_enabled: false },
  ];

  for (const r of rules) {
    await pool.query(
      `INSERT INTO reminder_rules (rule_type, trigger_condition, is_active, email_enabled)
       VALUES ($1, $2, TRUE, $3) ON CONFLICT DO NOTHING`,
      [r.rule_type, r.trigger_condition, r.email_enabled]
    );
  }
  console.log("[reminders] Seeded 8 default reminder rules.");
}
