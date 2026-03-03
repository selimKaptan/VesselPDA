import { pool } from "./db";

export async function migrateEmailInbound() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inbound_emails (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        to_email TEXT NOT NULL,
        subject TEXT,
        body_text TEXT,
        body_html TEXT,
        received_at TIMESTAMP DEFAULT NOW(),
        is_processed BOOLEAN DEFAULT FALSE,
        processed_action TEXT,
        processed_entity_id INTEGER,
        attachments JSONB DEFAULT '[]',
        ai_classification TEXT,
        ai_extracted_data JSONB,
        ai_suggestion TEXT,
        linked_voyage_id INTEGER REFERENCES voyages(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_forwarding_rules (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        forwarding_email TEXT UNIQUE NOT NULL,
        rule_type TEXT NOT NULL DEFAULT 'general',
        linked_voyage_id INTEGER REFERENCES voyages(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inbound_emails_user_id ON inbound_emails(user_id);
      CREATE INDEX IF NOT EXISTS idx_inbound_emails_org_id ON inbound_emails(organization_id);
      CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_processed ON inbound_emails(is_processed);
      CREATE INDEX IF NOT EXISTS idx_inbound_emails_to_email ON inbound_emails(to_email);
      CREATE INDEX IF NOT EXISTS idx_email_forwarding_rules_user_id ON email_forwarding_rules(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_forwarding_rules_forwarding_email ON email_forwarding_rules(forwarding_email);
    `);
    console.log("[migrate-email-inbound] Tables created/verified");
  } catch (err) {
    console.error("[migrate-email-inbound] Error:", err);
  }
}
