import { db } from "./db";
import { sql } from "drizzle-orm";

export async function cleanupInvalidPorts(): Promise<void> {
  try {
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM ports WHERE country = 'Turkey'`));
    const turkishCount = parseInt((countResult.rows[0] as any)?.cnt ?? "0");

    if (turkishCount <= 520) {
      console.log(`[cleanup] Turkish ports already clean (${turkishCount} ports). Skipping.`);
      return;
    }

    console.log(`[cleanup] Found ${turkishCount} Turkish ports — running cleanup...`);

    const badPortIds = `
      SELECT p.id FROM ports p
      WHERE p.country = 'Turkey' AND (
        lower(p.name) LIKE '%demir saha%'
        OR lower(p.name) LIKE '%demirleme saha%'
        OR lower(p.name) LIKE '%samandira%'
        OR p.name ILIKE '%şamandıra%'
        OR lower(p.name) LIKE '%nolu demir%'
        OR lower(p.name) LIKE '%nolu demirleme%'
        OR lower(p.name) LIKE '% boya%'
      )
    `;

    const dupPortIds = `
      SELECT p.id FROM ports p
      WHERE p.country = 'Turkey'
        AND p.id NOT IN (SELECT MIN(p2.id) FROM ports p2 WHERE p2.country = 'Turkey' GROUP BY p2.code)
        AND p.code IN (SELECT p3.code FROM ports p3 WHERE p3.country = 'Turkey' GROUP BY p3.code HAVING COUNT(*) > 1)
    `;

    const allBadIds = `SELECT id FROM (${badPortIds} UNION ${dupPortIds}) sub`;

    await db.execute(sql.raw(
      `DELETE FROM tariff_rates WHERE category_id IN (SELECT tc.id FROM tariff_categories tc WHERE tc.port_id IN (${allBadIds}))`
    ));
    await db.execute(sql.raw(
      `DELETE FROM tariff_categories WHERE port_id IN (${allBadIds})`
    ));
    const r3 = await db.execute(sql.raw(`DELETE FROM ports WHERE id IN (${badPortIds})`));
    const r4 = await db.execute(sql.raw(`DELETE FROM ports WHERE id IN (${dupPortIds})`));

    const afterResult = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM ports WHERE country = 'Turkey'`));
    const remaining = (afterResult.rows[0] as any)?.cnt ?? "?";

    console.log(`[cleanup] Done — removed ${(r3 as any).rowCount ?? 0} bad + ${(r4 as any).rowCount ?? 0} duplicate ports. ${remaining} Turkish ports remaining.`);
  } catch (err) {
    console.error("[cleanup] Port cleanup error:", err);
  }
}
