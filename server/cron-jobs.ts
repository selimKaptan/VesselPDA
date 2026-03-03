import cron from "node-cron";
import { pool } from "./db";
import { getPositionByMmsi } from "./ais-stream";
import { fetchTCMBRates } from "./exchange-rates";
import { runReminderEngine } from "./reminder-engine";

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
      const pos = getPositionByMmsi(row.mmsi);
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
//    Finds certificates expiring within 30 days and notifies the vessel owner.
// ────────────────────────────────────────────────────────────────────────────
async function checkExpiringCertificates() {
  console.log("[cron] checkExpiringCertificates: starting...");
  try {
    const result = await pool.query(`
      SELECT vc.id, vc.user_id, vc.name, vc.cert_type, vc.expires_at,
             v.name AS vessel_name
      FROM vessel_certificates vc
      JOIN vessels v ON v.id = vc.vessel_id
      WHERE vc.expires_at IS NOT NULL
        AND vc.status = 'valid'
        AND vc.expires_at > NOW()
        AND vc.expires_at <= NOW() + INTERVAL '30 days'
    `);

    let notified = 0;
    for (const cert of result.rows) {
      const daysLeft = Math.ceil(
        (new Date(cert.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const existingNotif = await pool.query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND type = 'certificate_expiry'
           AND message LIKE $2
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [cert.user_id, `%Certificate ID ${cert.id}%`]
      );
      if (existingNotif.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          cert.user_id,
          "certificate_expiry",
          `Certificate Expiring Soon — ${cert.vessel_name}`,
          `${cert.name} certificate for ${cert.vessel_name} expires in ${daysLeft} day(s). Certificate ID ${cert.id}`,
          `/vessels`,
        ]
      );
      notified++;
    }
    console.log(`[cron] checkExpiringCertificates: ${result.rows.length} expiring cert(s) found, ${notified} notification(s) sent.`);
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
    const expired = await pool.query(`
      SELECT id, user_id, vessel_name, expiry_hours
      FROM port_tenders
      WHERE status = 'open'
        AND created_at + (expiry_hours || ' hours')::INTERVAL < NOW()
    `);

    let closed = 0;
    for (const tender of expired.rows) {
      await pool.query(
        "UPDATE port_tenders SET status = 'expired' WHERE id = $1",
        [tender.id]
      );

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tender.user_id,
          "tender_expired",
          "Port Call Tender Expired",
          `Your tender for ${tender.vessel_name || "vessel"} has expired with no nominations and has been automatically closed.`,
          `/tenders`,
        ]
      );
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
    const result = await pool.query(`
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
export function startCronJobs() {
  cron.schedule("*/5 * * * *", syncWatchlistPositions);
  cron.schedule("0 8 * * *", checkExpiringCertificates);
  cron.schedule("0 0 * * *", autoCloseTenders);
  cron.schedule("0 * * * *", checkVoyageETA);
  cron.schedule("0 3 * * *", refreshExchangeRates);
  cron.schedule("30 12 * * *", refreshExchangeRates);
  cron.schedule("0 2 * * 0", cleanOldPositions);
  cron.schedule("0 * * * *", runReminderEngine);

  console.log("[cron] All 8 scheduled jobs registered:");
  console.log("[cron]   */5 * * * *  — syncWatchlistPositions");
  console.log("[cron]   0 8 * * *    — checkExpiringCertificates");
  console.log("[cron]   0 0 * * *    — autoCloseTenders");
  console.log("[cron]   0 * * * *    — checkVoyageETA");
  console.log("[cron]   0 3 * * *    — refreshExchangeRates (06:00 TRT)");
  console.log("[cron]   30 12 * * *  — refreshExchangeRates (15:30 TRT)");
  console.log("[cron]   0 2 * * 0    — cleanOldPositions");
  console.log("[cron]   0 * * * *    — runReminderEngine");
}
