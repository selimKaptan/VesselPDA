import { pool } from "./db";

// Helper: create a reminder, avoiding duplicates
async function upsertReminder(opts: {
  userId: string;
  organizationId?: number | null;
  category: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  priority?: string;
  dueDate?: Date | null;
}) {
  // Avoid duplicate auto-reminders for same entity + category within 24h
  const { rows: existing } = await pool.query(
    `SELECT id FROM reminders
     WHERE user_id = $1 AND category = $2 AND entity_type = $3 AND entity_id = $4
       AND type = 'auto' AND is_completed = FALSE AND is_snoozed = FALSE
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [opts.userId, opts.category, opts.entityType ?? null, opts.entityId ?? null]
  );
  if (existing.length > 0) return null;

  const { rows } = await pool.query(
    `INSERT INTO reminders (user_id, organization_id, type, category, title, message, entity_type, entity_id, priority, due_date)
     VALUES ($1, $2, 'auto', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      opts.userId,
      opts.organizationId ?? null,
      opts.category,
      opts.title,
      opts.message,
      opts.entityType ?? null,
      opts.entityId ?? null,
      opts.priority ?? "normal",
      opts.dueDate ?? null,
    ]
  );

  // Also create an in-app notification
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [
      opts.userId,
      "reminder",
      opts.title,
      opts.message,
      opts.entityType === "voyage" ? `/voyages/${opts.entityId}` :
      opts.entityType === "tender" ? `/tenders/${opts.entityId}` :
      opts.entityType === "invoice" ? `/invoices` : `/reminders`,
    ]
  );

  return rows[0]?.id;
}

// ── a) Tender Response — 48h without bid ────────────────────────────────────
async function checkTenderResponse() {
  const { rows } = await pool.query(`
    SELECT t.id, t.user_id, t.title, t.created_at
    FROM port_tenders t
    WHERE t.status = 'open'
      AND t.created_at < NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM tender_bids tb WHERE tb.tender_id = t.id
      )
  `);
  for (const t of rows) {
    await upsertReminder({
      userId: t.user_id,
      category: "tender_response",
      title: "No Bids on Tender",
      message: `Your tender "${t.title}" has been open for 48+ hours with no bids. Consider reviewing or promoting it.`,
      entityType: "tender",
      entityId: t.id,
      priority: "high",
    });
  }
}

// ── b) Certificate Expiry — 30d, 14d, 7d ───────────────────────────────────
async function checkCertificateExpiry() {
  const { rows } = await pool.query(`
    SELECT vc.id, vc.user_id, vc.name, vc.cert_type, vc.expires_at, v.name AS vessel_name
    FROM vessel_certificates vc
    JOIN vessels v ON v.id = vc.vessel_id
    WHERE vc.expires_at IS NOT NULL
      AND vc.status = 'valid'
      AND vc.expires_at > NOW()
      AND vc.expires_at <= NOW() + INTERVAL '30 days'
  `);
  for (const cert of rows) {
    const daysLeft = Math.ceil((new Date(cert.expires_at).getTime() - Date.now()) / 86400000);
    const priority = daysLeft <= 7 ? "urgent" : daysLeft <= 14 ? "high" : "normal";
    await upsertReminder({
      userId: cert.user_id,
      category: "certificate_expiry",
      title: `Certificate Expiring: ${cert.name}`,
      message: `${cert.name} for vessel "${cert.vessel_name}" expires in ${daysLeft} day(s). Renew before expiry to avoid port state control issues.`,
      entityType: "certificate",
      entityId: cert.id,
      priority,
      dueDate: new Date(cert.expires_at),
    });
  }
}

// ── c) Invoice Overdue — 3d, 7d, 14d ───────────────────────────────────────
async function checkInvoiceOverdue() {
  const { rows } = await pool.query(`
    SELECT i.id, i.user_id, i.invoice_number, i.total_amount, i.currency, i.due_date
    FROM invoices i
    WHERE i.status = 'sent'
      AND i.due_date IS NOT NULL
      AND i.due_date < NOW()
      AND i.due_date > NOW() - INTERVAL '30 days'
  `).catch(() => ({ rows: [] }));
  for (const inv of rows) {
    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
    const priority = daysOverdue >= 14 ? "urgent" : daysOverdue >= 7 ? "high" : "normal";
    await upsertReminder({
      userId: inv.user_id,
      category: "invoice_overdue",
      title: `Invoice Overdue: ${inv.invoice_number}`,
      message: `Invoice ${inv.invoice_number} for ${inv.total_amount} ${inv.currency} is ${daysOverdue} day(s) overdue. Follow up with the client.`,
      entityType: "invoice",
      entityId: inv.id,
      priority,
    });
  }
}

// ── d) DA Pending — voyage completed, no FDA after 3 days ──────────────────
async function checkDaPending() {
  const { rows } = await pool.query(`
    SELECT v.id, v.user_id, v.agent_user_id, v.vessel_name,
           COALESCE(v.agent_user_id, v.user_id) AS notify_user_id
    FROM voyages v
    WHERE v.status = 'completed'
      AND v.updated_at < NOW() - INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM final_disbursements fd WHERE fd.voyage_id = v.id
      )
  `).catch(() => ({ rows: [] }));
  for (const v of rows) {
    await upsertReminder({
      userId: v.notify_user_id,
      category: "da_pending",
      title: `Final DA Pending: ${v.vessel_name}`,
      message: `Voyage for "${v.vessel_name}" was completed 3+ days ago but no Final Disbursement Account has been created yet.`,
      entityType: "voyage",
      entityId: v.id,
      priority: "high",
    });
  }
}

// ── e) Nomination Pending — 48h without response ────────────────────────────
async function checkNominationPending() {
  const { rows } = await pool.query(`
    SELECT dn.id, dn.nominator_user_id AS user_id, dn.vessel_name, dn.created_at
    FROM direct_nominations dn
    WHERE dn.status = 'pending'
      AND dn.created_at < NOW() - INTERVAL '48 hours'
  `).catch(() => ({ rows: [] }));
  for (const n of rows) {
    await upsertReminder({
      userId: n.user_id,
      category: "nomination_pending",
      title: `Nomination Awaiting Response`,
      message: `Nomination for "${n.vessel_name}" has been pending for 48+ hours. Check if the agent has seen your nomination.`,
      entityType: "nomination",
      entityId: n.id,
      priority: "high",
    });
  }
}

// ── f) SOF Incomplete — voyage departed, SOF missing key events ─────────────
async function checkSofIncomplete() {
  const { rows } = await pool.query(`
    SELECT vpc.id AS port_call_id, vpc.voyage_id, v.user_id, v.agent_user_id,
           vpc.port_name, v.vessel_name,
           COALESCE(v.agent_user_id, v.user_id) AS notify_user_id,
           COUNT(se.id) AS sof_count
    FROM voyage_port_calls vpc
    JOIN voyages v ON v.id = vpc.voyage_id
    LEFT JOIN sof_events se ON se.port_call_id = vpc.id
    WHERE vpc.status = 'completed'
      AND vpc.etd < NOW() - INTERVAL '24 hours'
    GROUP BY vpc.id, vpc.voyage_id, v.user_id, v.agent_user_id, vpc.port_name, v.vessel_name
    HAVING COUNT(se.id) < 3
  `).catch(() => ({ rows: [] }));
  for (const pc of rows) {
    await upsertReminder({
      userId: pc.notify_user_id,
      category: "sof_incomplete",
      title: `SOF Incomplete: ${pc.port_name}`,
      message: `Statement of Facts for "${pc.port_name}" (${pc.vessel_name}) is incomplete — only ${pc.sof_count} events recorded. Complete the SOF before it gets too late.`,
      entityType: "voyage",
      entityId: pc.voyage_id,
      priority: "normal",
    });
  }
}

// ── g) Vessel Approaching — watchlisted vessel within 24h ETA ───────────────
async function checkVesselApproaching() {
  const { rows } = await pool.query(`
    SELECT v.id, v.user_id, v.vessel_name, v.eta, v.agent_user_id,
           COALESCE(v.agent_user_id, v.user_id) AS notify_user_id
    FROM voyages v
    WHERE v.status IN ('planned', 'active')
      AND v.eta IS NOT NULL
      AND v.eta > NOW()
      AND v.eta <= NOW() + INTERVAL '24 hours'
  `).catch(() => ({ rows: [] }));
  for (const v of rows) {
    const hoursLeft = Math.ceil((new Date(v.eta).getTime() - Date.now()) / 3600000);
    await upsertReminder({
      userId: v.notify_user_id,
      category: "vessel_approaching",
      title: `Vessel Approaching: ${v.vessel_name}`,
      message: `"${v.vessel_name}" is expected to arrive in ${hoursLeft} hour(s). Ensure all pre-arrival formalities are ready.`,
      entityType: "voyage",
      entityId: v.id,
      priority: "urgent",
      dueDate: new Date(v.eta),
    });
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────
export async function runReminderEngine() {
  console.log("[reminders] Running engine...");
  try {
    // Check which rules are active
    const { rows: rules } = await pool.query(
      `SELECT rule_type, is_active FROM reminder_rules WHERE organization_id IS NULL AND user_id IS NULL`
    );
    const activeRules = new Set(rules.filter(r => r.is_active).map(r => r.rule_type));

    const checks: [string, () => Promise<void>][] = [
      ["tender_response",    checkTenderResponse],
      ["certificate_expiry", checkCertificateExpiry],
      ["invoice_overdue",    checkInvoiceOverdue],
      ["da_pending",         checkDaPending],
      ["nomination_pending", checkNominationPending],
      ["sof_incomplete",     checkSofIncomplete],
      ["vessel_approaching", checkVesselApproaching],
    ];

    let ran = 0;
    for (const [ruleType, fn] of checks) {
      if (activeRules.size === 0 || activeRules.has(ruleType)) {
        await fn().catch(err => console.error(`[reminders] ${ruleType} error:`, err?.message));
        ran++;
      }
    }
    console.log(`[reminders] Engine done — ran ${ran} checks.`);
  } catch (err: any) {
    console.error("[reminders] Engine error:", err?.message);
  }
}
