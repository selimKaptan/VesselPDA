import cron from "node-cron";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { fetchTCMBRates } from "./exchange-rates";
import { checkAndSendReminders } from "./payment-reminders";
import { sendCertificateExpiryEmail } from "./email";
import { checkInvoiceDueDates, checkCertificateExpiry as checkCertificateExpiryAlert, checkDaAdvanceDue } from "./cron";
import { syncVesselStatuses } from "./vessel-status-sync";

// ────────────────────────────────────────────────────────────────────────────
// a) syncWatchlistPositions — Every 5 minutes
//    Saves the current AIS cache position for each watchlisted vessel
//    to vessel_positions, as a scheduled backup alongside the stream handler.
// ────────────────────────────────────────────────────────────────────────────
async function syncWatchlistPositions() {
  console.log("[cron] syncWatchlistPositions: starting...");
  try {
    const watchlist = await pool.query(
      "SELECT id, mmsi FROM vessel_watchlist WHERE mmsi IS NOT NULL AND mmsi <> ''"
    );
    let saved = 0;
    for (const row of watchlist.rows) {
      const pos = null; // AIS stream removed — positions synced via Datalastic only
      if (!pos) continue;

      const lastRow = await pool.query(
        "SELECT timestamp FROM vessel_positions WHERE mmsi = $1 ORDER BY timestamp DESC LIMIT 1",
        [row.mmsi]
      );
      const lastTs: Date | null = lastRow.rows[0]?.timestamp ?? null;
      const cutoff = new Date(Date.now() - 4.5 * 60 * 1000);
      if (lastTs && lastTs > cutoff) continue;

      await pool.query(
        `INSERT INTO vessel_positions
          (watchlist_item_id, mmsi, imo, vessel_name, latitude, longitude,
           speed, heading, navigation_status, destination)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          row.id,
          pos.mmsi,
          pos.imo ?? null,
          pos.name ?? null,
          pos.lat,
          pos.lng,
          pos.speed ?? null,
          pos.heading ?? null,
          pos.status ?? null,
          pos.destination ?? null,
        ]
      );
      saved++;
    }
    console.log(`[cron] syncWatchlistPositions: saved ${saved} position(s) for ${watchlist.rows.length} watchlisted vessel(s).`);
  } catch (err: any) {
    console.error("[cron] syncWatchlistPositions error:", err?.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// b) checkExpiringCertificates — Every day at 08:00
//    Finds certificates expiring within 30 days. Sends 30/14/7-day email alerts
//    to vessel owners (tracked via reminder_sent_days column).
// ────────────────────────────────────────────────────────────────────────────
async function checkExpiringCertificates() {
  console.log("[cron] checkExpiringCertificates: starting...");
  try {
    const result = await pool.query(`
      SELECT vc.id, vc.user_id, vc.name, vc.cert_type, vc.expires_at,
             vc.reminder_sent_days,
             v.name AS vessel_name
      FROM vessel_certificates vc
      JOIN vessels v ON v.id = vc.vessel_id
      WHERE vc.expires_at IS NOT NULL
        AND vc.expires_at > NOW()
        AND vc.expires_at <= NOW() + INTERVAL '31 days'
    `);

    let notified = 0;
    let emailed = 0;
    for (const cert of result.rows) {
      const daysLeft = Math.ceil(
        (new Date(cert.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Determine which threshold this cert hits: 30, 14, or 7
      const hitThreshold = [7, 14, 30].find(t => daysLeft <= t);
      if (!hitThreshold) continue;

      const sentDays: number[] = (cert.reminder_sent_days || "").split(",").filter(Boolean).map(Number);

      // Send DB notification (once per 24h)
      const existingNotif = await pool.query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND type = 'certificate_expiry'
           AND message LIKE $2
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [cert.user_id, `%Certificate ID ${cert.id}%`]
      );
      if (existingNotif.rows.length === 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            cert.user_id,
            "certificate_expiry",
            `Certificate Expiring Soon — ${cert.vessel_name}`,
            `${cert.name} certificate for ${cert.vessel_name} expires in ${daysLeft} day(s). Certificate ID ${cert.id}`,
            `/vessel-certificates`,
          ]
        );
        notified++;
      }

      // Send email alert if this threshold hasn't been emailed yet
      if (!sentDays.includes(hitThreshold)) {
        const userRow = await pool.query(
          "SELECT email, first_name, last_name FROM users WHERE id = $1",
          [cert.user_id]
        );
        const user = userRow.rows[0];
        if (user?.email) {
          const sent = await sendCertificateExpiryEmail({
            toEmail: user.email,
            toName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
            vesselName: cert.vessel_name,
            certName: cert.name,
            expiresAt: new Date(cert.expires_at).toLocaleDateString("en-GB"),
            daysLeft,
          });
          if (sent) {
            const newSentDays = [...sentDays, hitThreshold].join(",");
            await pool.query(
              "UPDATE vessel_certificates SET reminder_sent_days = $1 WHERE id = $2",
              [newSentDays, cert.id]
            );
            emailed++;
          }
        }
      }
    }
    console.log(`[cron] checkExpiringCertificates: ${result.rows.length} cert(s) checked, ${notified} notification(s) sent, ${emailed} email(s) sent.`);
  } catch (err: any) {
    console.error("[cron] checkExpiringCertificates error:", err?.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// c) autoCloseTenders — Every day at 00:00
//    Marks expired open tenders as 'expired' and notifies their owners.
// ────────────────────────────────────────────────────────────────────────────
async function autoCloseTenders() {
  console.log("[cron] autoCloseTenders: starting...");
  try {
    const expired = await db.execute(sql`
      SELECT id, user_id, vessel_name, expiry_hours
      FROM port_tenders
      WHERE status = 'open'
        AND created_at + (expiry_hours || ' hours')::INTERVAL < NOW()
    `);

    let closed = 0;
    for (const tender of expired.rows) {
      await db.execute(sql`
        UPDATE port_tenders SET status = 'expired' WHERE id = ${tender.id}
      `);

      await db.execute(sql`
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
          ${tender.user_id},
          ${"tender_expired"},
          ${"Port Call Tender Expired"},
          ${`Your tender for ${tender.vessel_name || "vessel"} has expired with no nominations and has been automatically closed.`},
          ${"/tenders"}
        )
      `);
      closed++;
    }
    console.log(`[cron] autoCloseTenders: ${closed} tender(s) closed.`);
  } catch (err: any) {
    console.error("[cron] autoCloseTenders error:", err?.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// d) checkVoyageETA — Every hour
//    Sends ETA warnings for voyages arriving within the next 24 hours.
// ────────────────────────────────────────────────────────────────────────────
async function checkVoyageETA() {
  console.log("[cron] checkVoyageETA: starting...");
  try {
    const result = await db.execute(sql`
      SELECT v.id, v.user_id, v.agent_user_id, v.vessel_name, v.eta,
             p.name AS port_name
      FROM voyages v
      LEFT JOIN ports p ON p.id = v.port_id
      WHERE v.status NOT IN ('completed', 'cancelled')
        AND v.eta IS NOT NULL
        AND v.eta > NOW()
        AND v.eta <= NOW() + INTERVAL '24 hours'
    `);

    let warned = 0;
    for (const voyage of result.rows) {
      const hoursLeft = Math.ceil(
        (new Date(voyage.eta).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      const notifKey = `Voyage ${voyage.id}`;
      const recipients = [voyage.user_id, voyage.agent_user_id].filter(Boolean);

      for (const userId of recipients) {
        const existing = await pool.query(
          `SELECT id FROM notifications
           WHERE user_id = $1 AND type = 'voyage_eta'
             AND message LIKE $2
             AND created_at > NOW() - INTERVAL '12 hours'`,
          [userId, `%${notifKey}%`]
        );
        if (existing.rows.length > 0) continue;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            "voyage_eta",
            `ETA Alert — ${voyage.vessel_name || "Vessel"} arriving soon`,
            `${notifKey}: ${voyage.vessel_name || "Vessel"} is expected to arrive at ${voyage.port_name || "port"} in approximately ${hoursLeft} hour(s).`,
            `/voyages/${voyage.id}`,
          ]
        );
        warned++;
      }
    }
    console.log(`[cron] checkVoyageETA: ${result.rows.length} voyage(s) with ETA within 24h, ${warned} notification(s) sent.`);
  } catch (err: any) {
    console.error("[cron] checkVoyageETA error:", err?.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// e) refreshExchangeRates — Daily at 06:00 and 15:30 Turkey time (03:00 & 12:30 UTC)
//    Fetches latest USD/TRY, EUR/TRY, GBP/TRY rates from TCMB and saves to DB.
// ────────────────────────────────────────────────────────────────────────────
async function refreshExchangeRates() {
  console.log("[cron] refreshExchangeRates: starting...");
  try {
    const rates = await fetchTCMBRates();
    console.log(`[cron] refreshExchangeRates: USD/TRY=${rates.usdTry} EUR/TRY=${rates.eurTry} EUR/USD=${rates.eurUsd}`);
  } catch (err: any) {
    console.error("[cron] refreshExchangeRates error:", err?.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// f) cleanOldPositions — Every Sunday at 02:00
//    Removes vessel position records older than 90 days.
// ────────────────────────────────────────────────────────────────────────────
async function cleanOldPositions() {
  console.log("[cron] cleanOldPositions: starting...");
  try {
    const result = await pool.query(
      "DELETE FROM vessel_positions WHERE timestamp < NOW() - INTERVAL '90 days'"
    );
    const deleted = result.rowCount ?? 0;
    console.log(`[cron] cleanOldPositions: deleted ${deleted} old position record(s).`);
  } catch (err: any) {
    console.error("[cron] cleanOldPositions error:", err?.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Start all cron jobs
// ────────────────────────────────────────────────────────────────────────────
async function checkPaymentReminders() {
  console.log("[cron] checkPaymentReminders: starting...");
  const result = await checkAndSendReminders();
  console.log("[cron] checkPaymentReminders: result:", result);
  
  // Custom Invoice Reminders
  await checkInvoiceDueDates();
  
  // Custom Certificate Expiry
  await checkCertificateExpiryAlert();
  
  // DA Advance Due
  await checkDaAdvanceDue();
}

// ────────────────────────────────────────────────────────────────────────────
// i) autoSyncVesselStatuses — Every 10 minutes
//    Derives fleet_status from active voyage + port_call status
// ────────────────────────────────────────────────────────────────────────────
async function autoSyncVesselStatusesCron() {
  try {
    const { updated } = await syncVesselStatuses();
    if (updated > 0) console.log(`[cron] autoSyncVesselStatuses: updated ${updated} vessel(s)`);
  } catch (err: any) {
    console.error("[cron] autoSyncVesselStatuses error:", err?.message);
  }
}

async function purgeDeletedRecords() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const tables = ["vessels", "proformas", "voyages", "fixtures", "invoices"];
  let totalPurged = 0;
  try {
    for (const table of tables) {
      const res = await pool.query(
        `DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
        [cutoff]
      );
      totalPurged += res.rowCount ?? 0;
    }
    console.log(`[cron] purgeDeletedRecords: removed ${totalPurged} record(s), cutoff = ${cutoff.toISOString()}`);
  } catch (err: any) {
    console.error("[cron] purgeDeletedRecords error:", err?.message);
  }
}

export function startCronJobs() {
  cron.schedule("*/5 * * * *", syncWatchlistPositions);
  cron.schedule("0 8 * * *", checkExpiringCertificates);
  cron.schedule("0 0 * * *", autoCloseTenders);
  cron.schedule("0 * * * *", checkVoyageETA);
  cron.schedule("0 3 * * *", refreshExchangeRates);
  cron.schedule("30 12 * * *", refreshExchangeRates);
  cron.schedule("0 2 * * 0", cleanOldPositions);
  cron.schedule("0 9 * * *", checkPaymentReminders);
  cron.schedule("*/10 * * * *", autoSyncVesselStatusesCron);
  cron.schedule("0 3 * * 1", purgeDeletedRecords);

  console.log("[cron] All 10 scheduled jobs registered:");
  console.log("[cron]   */5 * * * *  — syncWatchlistPositions");
  console.log("[cron]   0 8 * * *    — checkExpiringCertificates");
  console.log("[cron]   0 0 * * *    — autoCloseTenders");
  console.log("[cron]   0 * * * *    — checkVoyageETA");
  console.log("[cron]   0 3 * * *    — refreshExchangeRates (06:00 TRT)");
  console.log("[cron]   30 12 * * *  — refreshExchangeRates (15:30 TRT)");
  console.log("[cron]   0 2 * * 0    — cleanOldPositions");
  console.log("[cron]   0 9 * * *    — checkPaymentReminders");
  console.log("[cron]   */10 * * * * — autoSyncVesselStatuses");
  console.log("[cron]   0 3 * * 1    — purgeDeletedRecords (weekly, 30-day grace)");

  setTimeout(() => autoSyncVesselStatusesCron(), 3000);
}
