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

    const badPattern = `
      country = 'Turkey' AND (
        lower(name) LIKE '%demir saha%'
        OR lower(name) LIKE '%demirleme saha%'
        OR lower(name) LIKE '%samandira%'
        OR name ILIKE '%şamandıra%'
        OR lower(name) LIKE '%nolu demir%'
        OR lower(name) LIKE '%nolu demirleme%'
        OR lower(name) LIKE '% boya%'
      )
    `;
    const dupPattern = `
      country = 'Turkey'
      AND id NOT IN (SELECT MIN(id) FROM ports WHERE country = 'Turkey' GROUP BY code)
      AND code IN (SELECT code FROM ports WHERE country = 'Turkey' GROUP BY code HAVING COUNT(*) > 1)
    `;

    await db.execute(sql.raw(
      `DELETE FROM tariff_rates WHERE category_id IN (SELECT tc.id FROM tariff_categories tc JOIN ports p ON tc.port_id = p.id WHERE ${badPattern} OR ${dupPattern})`
    ));
    await db.execute(sql.raw(
      `DELETE FROM tariff_categories WHERE port_id IN (SELECT id FROM ports WHERE ${badPattern} OR ${dupPattern})`
    ));
    const r3 = await db.execute(sql.raw(`DELETE FROM ports WHERE ${badPattern}`));
    const r4 = await db.execute(sql.raw(`DELETE FROM ports WHERE ${dupPattern}`));

    const afterResult = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM ports WHERE country = 'Turkey'`));
    const remaining = (afterResult.rows[0] as any)?.cnt ?? "?";

    console.log(`[cleanup] Done — removed ${(r3 as any).rowCount ?? 0} bad + ${(r4 as any).rowCount ?? 0} duplicate ports. ${remaining} Turkish ports remaining.`);
  } catch (err) {
    console.error("[cleanup] Port cleanup error:", err);
  }
}
