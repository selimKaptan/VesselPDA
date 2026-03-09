/**
 * Migration script: move base64-encoded files stored in DB columns to filesystem.
 *
 * Run once with:  npx tsx server/scripts/migrate-base64-to-disk.ts
 *
 * Tables migrated:
 *  - voyage_documents   : fileBase64 → fileUrl
 *  - vessel_certificates: fileBase64 → fileUrl
 *  - tender_bids        : proformaPdfBase64 → proformaPdfUrl
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { saveBase64File } from "../file-storage";
import type { UploadCategory } from "../file-storage";

type Row = { id: number; base64: string | null };

async function migrateTable(
  tableName: string,
  b64Col: string,
  urlCol: string,
  category: UploadCategory
) {
  const rows: Row[] = await db.execute(
    sql.raw(`SELECT id, ${b64Col} AS base64, ${urlCol} AS url FROM ${tableName} WHERE ${b64Col} IS NOT NULL AND (${urlCol} IS NULL OR ${urlCol} = '')`)
  ).then((r: any) => r.rows ?? r);

  console.log(`[${tableName}] Found ${rows.length} rows with base64 data.`);
  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.base64) continue;
    try {
      const fileUrl = saveBase64File(row.base64, category);
      await db.execute(
        sql.raw(`UPDATE ${tableName} SET ${urlCol} = '${fileUrl}', ${b64Col} = NULL WHERE id = ${row.id}`)
      );
      migrated++;
      if (migrated % 10 === 0) console.log(`  [${tableName}] Migrated ${migrated}/${rows.length}...`);
    } catch (err) {
      console.error(`  [${tableName}] Failed for id=${row.id}:`, err);
      failed++;
    }
  }

  console.log(`[${tableName}] Done — migrated: ${migrated}, failed: ${failed}`);
}

async function main() {
  console.log("Starting base64 → disk migration...\n");

  await migrateTable("voyage_documents", "file_base64", "file_url", "documents");
  await migrateTable("vessel_certificates", "file_base64", "file_url", "certificates");
  await migrateTable("tender_bids", "proforma_pdf_base64", "proforma_pdf_url", "bids");

  console.log("\nMigration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
