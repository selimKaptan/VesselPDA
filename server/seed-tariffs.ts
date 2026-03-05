import { pool } from "./db";

export async function seedTariffData() {
  const client = await pool.connect();
  try {
    const { rows: check } = await client.query("SELECT COUNT(*) FROM pilotage_tariffs");
    if (parseInt(check[0].count) > 0) {
      console.log("[tariff-seed] Tariff data already present, skipping.");
      return;
    }

    console.log("[tariff-seed] Seeding tariff data...");

    // ── Pilotage Tariffs (İstanbul port_id=2) ─────────────────────────────
    await client.query(`
      INSERT INTO pilotage_tariffs (port_id, service_type, vessel_category, grt_min, grt_max, base_fee, per_1000_grt, currency) VALUES
      (2,'palamar_kabotaj_yeni','diger_tum',0,1000,22.00,11.00,'USD'),
      (2,'palamar_kabotaj','calisan_gemiler',0,1000,21.00,NULL,'USD'),
      (2,'palamar_kabotaj','diger_tum',0,1000,36.00,18.00,'USD'),
      (2,'palamar_kabotaj_yeni','calisan_gemiler',0,1000,25.00,NULL,'USD'),
      (2,'kabotaj','yolcu_feribot_roro_car_carrier',0,1000,550.00,325.00,'USD'),
      (2,'kabotaj','konteyner',0,1000,105.00,42.00,'USD'),
      (2,'kabotaj','diger_yuk',0,1000,139.00,59.00,'USD'),
      (2,'kabotaj','diger_tum',0,1000,179.00,74.00,'USD'),
      (2,'kabotaj_yeni','yolcu_feribot_roro_car_carrier',0,1000,605.00,136.00,'USD'),
      (2,'kabotaj_yeni','konteyner',0,1000,153.00,65.00,'USD'),
      (2,'kabotaj_yeni','diger_yuk',0,1000,202.00,81.00,'USD'),
      (2,'kabotaj_yeni','diger_tum',0,1000,116.00,46.00,'USD'),
      (2,'romorkör_kabotaj','yolcu_feribot_roro_car_carrier',0,1000,23.00,NULL,'USD'),
      (2,'romorkör_kabotaj','konteyner',0,1000,63.00,NULL,'USD'),
      (2,'romorkör_kabotaj','diger_yuk',0,1000,249.00,47.00,'USD'),
      (2,'romorkör_kabotaj','diger_tum',0,1000,311.00,58.00,'USD'),
      (2,'romorkör_kabotaj_yeni','yolcu_feribot_roro_car_carrier',0,1000,25.00,NULL,'USD'),
      (2,'romorkör_kabotaj_yeni','konteyner',0,1000,70.00,NULL,'USD'),
      (2,'romorkör_kabotaj_yeni','diger_yuk',0,1000,373.00,70.00,'USD'),
      (2,'romorkör_kabotaj_yeni','diger_tum',0,1000,384.00,NULL,'USD'),
      (2,'kabotaj','yolcu_feribot_roro_car_carrier',1001,999999,550.00,325.00,'USD'),
      (2,'kabotaj','diger_yuk',1001,999999,139.00,59.00,'USD'),
      (2,'kabotaj','konteyner',1001,999999,105.00,42.00,'USD'),
      (2,'kabotaj','diger_tum',1001,999999,179.00,74.00,'USD'),
      (2,'uluslararasi','diger_yuk',0,999999,232.00,93.00,'USD'),
      (2,'uluslararasi','diger_tum',0,999999,133.00,53.00,'USD'),
      (2,'uluslararasi','konteyner',0,999999,176.00,75.00,'USD'),
      (2,'uluslararasi','yolcu_feribot_roro_car_carrier',0,999999,696.00,156.00,'USD'),
      (2,'romorkör_uluslararasi','diger_yuk',0,999999,429.00,81.00,'USD'),
      (2,'romorkör_uluslararasi','diger_tum',0,999999,442.00,NULL,'USD'),
      (2,'romorkör_uluslararasi','konteyner',0,999999,81.00,NULL,'USD'),
      (2,'romorkör_uluslararasi','yolcu_feribot_roro_car_carrier',0,999999,29.00,NULL,'USD')
    `);

    // ── External Pilotage Tariffs (İstanbul port_id=2) ────────────────────
    await client.query(`
      INSERT INTO external_pilotage_tariffs (port_id, service_description, grt_up_to_1000, per_additional_1000_grt, currency) VALUES
      (2,'Haliç''e giriş veya çıkış',550.00,325.00,'USD'),
      (2,'İstanbul veya Çanakkale Boğaz geçişi',500.00,92.00,'USD'),
      (2,'Ahırkapı-Gelibolu veya Marmara Limanı veya mukabili',500.00,92.00,'USD'),
      (2,'İstanbul Liman hudutları içinde (Boğaz geçiş hariç) bir noktadan diğerine geçmek',415.00,50.00,'USD'),
      (2,'Büyükdere/Paşabahçe ve İstanbul Boğazı etap + sahasında kalan alan ile Kilyos demirden kaldırma',500.00,92.00,'USD'),
      (2,'Çanakkale Boğazı içi, Karanik Liman, Ahırkapı, Kumkapı, Dolmabahçe, Bakırköy, Haliç ve Yeşilköy demirden kaldırma',256.00,40.00,'USD'),
      (2,'İzmir ve diğer limanlar demirleme veya demirden kaldırma',112.00,62.00,'USD'),
      (2,'Haliç''e giriş veya çıkış (YENİ 2026)',605.00,136.00,'USD'),
      (2,'İstanbul veya Çanakkale Boğaz geçişi (YENİ 2026)',550.00,100.00,'USD'),
      (2,'Ahırkapı-Gelibolu veya Marmara Limanı (YENİ 2026)',550.00,100.00,'USD'),
      (2,'İstanbul Liman hudutları içinde (YENİ 2026)',457.00,55.00,'USD'),
      (2,'Büyükdere/Paşabahçe İstanbul Boğazı (YENİ 2026)',500.00,92.00,'USD'),
      (2,'Çanakkale ve çevre limanlar demirleme (YENİ 2026)',282.00,48.00,'USD'),
      (2,'İzmir ve diğer limanlar (YENİ 2026)',124.00,68.00,'USD')
    `);

    // ── Agency Fees (İstanbul port_id=2) ─────────────────────────────────
    await client.query(`
      INSERT INTO agency_fees (port_id, tariff_no, service_type, nt_min, nt_max, fee, currency) VALUES
      (2,'T1','acentelik',0,500,600.00,'EUR'),
      (2,'T2','koruyucu_acentelik',0,500,300.00,'EUR'),
      (2,'T1','acentelik',501,1000,1000.00,'EUR'),
      (2,'T2','koruyucu_acentelik',501,1000,500.00,'EUR'),
      (2,'T1','acentelik',1001,2000,1500.00,'EUR'),
      (2,'T2','koruyucu_acentelik',1001,2000,750.00,'EUR'),
      (2,'T1','acentelik',2001,3000,1850.00,'EUR'),
      (2,'T2','koruyucu_acentelik',2001,3000,925.00,'EUR'),
      (2,'T1','acentelik',3001,4000,2300.00,'EUR'),
      (2,'T2','koruyucu_acentelik',3001,4000,1150.00,'EUR'),
      (2,'T1','acentelik',4001,5000,2750.00,'EUR'),
      (2,'T2','koruyucu_acentelik',4001,5000,1375.00,'EUR'),
      (2,'T1','acentelik',5001,7500,3200.00,'EUR'),
      (2,'T2','koruyucu_acentelik',5001,7500,1600.00,'EUR'),
      (2,'T1','acentelik',7501,10000,4000.00,'EUR'),
      (2,'T2','koruyucu_acentelik',7501,10000,2000.00,'EUR'),
      (2,'T1','acentelik',10001,20000,4000.00,'EUR'),
      (2,'T2','koruyucu_acentelik',10001,20000,2000.00,'EUR'),
      (2,'T1','acentelik',20001,30000,5250.00,'EUR'),
      (2,'T2','koruyucu_acentelik',20001,30000,2625.00,'EUR'),
      (2,'T1','acentelik',30001,999999,6250.00,'EUR'),
      (2,'T2','koruyucu_acentelik',30001,999999,3125.00,'EUR')
    `);

    await client.query(`
      UPDATE agency_fees SET per_1000_nt = 125.00 WHERE service_type='acentelik' AND nt_min = 10001 AND port_id = 2;
      UPDATE agency_fees SET per_1000_nt = 100.00 WHERE service_type='acentelik' AND nt_min = 20001 AND port_id = 2;
      UPDATE agency_fees SET per_1000_nt = 75.00  WHERE service_type='acentelik' AND nt_min = 30001 AND port_id = 2;
    `);

    // ── MARPOL Tariffs (İzmir port_id=3) ─────────────────────────────────
    await client.query(`
      INSERT INTO marpol_tariffs (port_id, grt_min, grt_max, marpol_ek1_included, marpol_ek4_included, marpol_ek5_included, fixed_fee, weekday_ek1_rate, weekday_ek4_rate, weekday_ek5_rate, weekend_ek1_rate, weekend_ek4_rate, weekend_ek5_rate, currency) VALUES
      (3,0,1000,1.00,2.00,1.00,80.00,13.00,15.00,10.00,1.50,15.00,25.00,'EUR'),
      (3,1001,5000,3.00,3.00,2.00,140.00,10.00,15.00,10.00,1.88,18.75,31.25,'EUR'),
      (3,5001,10000,4.00,4.00,3.00,210.00,8.00,10.00,6.00,NULL,NULL,NULL,'EUR'),
      (3,10001,15000,5.00,5.00,3.00,250.00,7.00,10.00,6.00,NULL,NULL,NULL,'EUR'),
      (3,15001,20000,6.00,5.00,3.00,300.00,6.00,10.00,5.00,NULL,NULL,NULL,'EUR'),
      (3,20001,25000,7.00,6.00,4.00,350.00,6.00,8.00,5.00,NULL,NULL,NULL,'EUR'),
      (3,25001,35000,8.00,8.00,4.00,400.00,5.00,7.00,4.00,NULL,NULL,NULL,'EUR'),
      (3,35001,60000,10.00,10.00,4.00,540.00,5.00,7.00,4.00,NULL,NULL,NULL,'EUR'),
      (3,60001,999999,13.00,15.00,5.00,720.00,5.00,7.00,4.00,NULL,NULL,NULL,'EUR')
    `);

    // ── LCB Tariffs (İzmir port_id=3) ────────────────────────────────────
    await client.query(`
      INSERT INTO lcb_tariffs (port_id, nrt_min, nrt_max, amount, currency) VALUES
      (3,11,500,628.00,'TRY'),
      (3,501,2000,1506.00,'TRY'),
      (3,2001,4000,2259.00,'TRY'),
      (3,4001,8000,3012.00,'TRY'),
      (3,8001,10000,6024.00,'TRY'),
      (3,10001,30000,9036.00,'TRY'),
      (3,30001,50000,15059.00,'TRY'),
      (3,50001,999999,25000.00,'TRY')
    `);

    // ── Tonnage Tariffs (İzmir port_id=3) ────────────────────────────────
    await client.query(`
      INSERT INTO tonnage_tariffs (port_id, nrt_min, nrt_max, ithalat, ihracat, currency) VALUES
      (3,0,3000,20100.00,NULL,'TRY'),
      (3,3001,6000,26350.00,NULL,'TRY'),
      (3,6001,9000,32700.00,NULL,'TRY'),
      (3,9001,12000,38840.00,NULL,'TRY'),
      (3,12001,15000,45305.00,NULL,'TRY'),
      (3,15001,18000,51585.00,NULL,'TRY'),
      (3,18001,21000,57935.00,NULL,'TRY'),
      (3,21001,25000,62210.00,NULL,'TRY'),
      (3,25001,30000,68525.00,NULL,'TRY'),
      (3,30001,35000,77205.00,NULL,'TRY'),
      (3,35001,999999,106105.00,NULL,'TRY')
    `);

    // ── Cargo Handling Tariffs (İzmir port_id=3) ─────────────────────────
    await client.query(`
      INSERT INTO cargo_handling_tariffs (port_id, cargo_type, operation, rate, unit, currency) VALUES
      (3,'General Kargo','yukleme',6.00,'ton','USD'),
      (3,'General Kargo','bosaltma',6.00,'ton','USD'),
      (3,'Dökme Katı','yukleme',4.50,'ton','USD'),
      (3,'Dökme Katı','bosaltma',4.50,'ton','USD'),
      (3,'Dökme Katı (TMO/ETİBANK)','yukleme',1.50,'ton','USD'),
      (3,'Boş Konteyner','yukleme',35.00,'adet','USD'),
      (3,'Boş Konteyner','bosaltma',32.00,'adet','USD'),
      (3,'Dolu Konteyner (20)','yukleme',90.00,'adet','USD'),
      (3,'Dolu Konteyner (20)','bosaltma',75.00,'adet','USD'),
      (3,'Dolu Konteyner (40)','yukleme',106.00,'adet','USD'),
      (3,'Dolu Konteyner (40)','bosaltma',85.00,'adet','USD'),
      (3,'Dolu Konteyner Yanıcı (20)','yukleme',114.00,'adet','USD'),
      (3,'Dolu Konteyner Yanıcı (40)','yukleme',132.00,'adet','USD'),
      (3,'Oto/Pikap/Jeep/Midibüs','yukleme',12.00,'adet','USD'),
      (3,'Oto/Pikap/Jeep/Midibüs','bosaltma',12.00,'adet','USD'),
      (3,'Proje Kargo','yukleme',15.00,'ton','USD'),
      (3,'Proje Kargo','bosaltma',15.00,'ton','USD'),
      (3,'Canlı Hayvan','yukleme',3.50,'adet','USD')
    `);

    // ── Berthing Tariffs (İzmir port_id=3, 82 rows) ───────────────────────
    // Rates per day: intl_foreign_flag, intl_turkish_flag, cabotage_turkish (USD)
    const berthingRows: [number, number, number, number, number][] = [
      [0, 500, 25, 8, 5],
      [501, 1000, 50, 19, 8],
    ];
    // From GT 1001 upward, each band is 1000 GT wide, 80 more bands
    const foreignBase = 75, turkishBase = 38, cabotageBase = 13;
    for (let i = 0; i < 80; i++) {
      const gtMin = 1001 + i * 1000;
      const gtMax = i === 79 ? 999999 : 2000 + i * 1000;
      const foreign = foreignBase + i * 25;
      const turkish = Math.round(turkishBase + i * 18.75);
      const cabotage = Math.round(cabotageBase + i * 12.5);
      berthingRows.push([gtMin, gtMax, foreign, turkish, cabotage]);
    }

    const berthingValues = berthingRows
      .map(([mn, mx, f, t, c]) => `(3,${mn},${mx},${f}.00,${t}.00,${c}.00,'USD',2026)`)
      .join(",\n      ");

    await client.query(`
      INSERT INTO berthing_tariffs (port_id, gt_min, gt_max, intl_foreign_flag, intl_turkish_flag, cabotage_turkish, currency, valid_year)
      VALUES ${berthingValues}
    `);

    console.log("[tariff-seed] ✓ All tariff data seeded successfully.");
  } catch (err) {
    console.error("[tariff-seed] Error seeding tariff data:", err);
  } finally {
    client.release();
  }
}

export async function ensureNewTariffTables() {
  const client = await pool.connect();
  try {
    console.log("[tariff-tables] Ensuring new tariff tables exist...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS light_dues (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        service_type VARCHAR,
        vessel_category VARCHAR,
        grt_min INTEGER,
        grt_max INTEGER,
        fee NUMERIC,
        currency VARCHAR DEFAULT 'USD',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    await client.query(`ALTER TABLE light_dues ADD COLUMN IF NOT EXISTS vessel_category VARCHAR`);
    await client.query(`ALTER TABLE light_dues ADD COLUMN IF NOT EXISTS service_type VARCHAR`);
    await client.query(`ALTER TABLE light_dues ADD COLUMN IF NOT EXISTS service_desc VARCHAR`);
    await client.query(`ALTER TABLE light_dues ADD COLUMN IF NOT EXISTS rate_up_to_800 NUMERIC`);
    await client.query(`ALTER TABLE light_dues ADD COLUMN IF NOT EXISTS rate_above_800 NUMERIC`);

    const { rows: lightCheck } = await client.query("SELECT COUNT(*)::int AS cnt FROM light_dues WHERE vessel_category IS NOT NULL");
    if (lightCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO light_dues (port_id, vessel_category, service_type, service_desc, rate_up_to_800, rate_above_800, currency, valid_year, notes) VALUES
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Non-Stop Voyage (Round Trip)',2.4486,1.2243,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Çanakkale Strait Entry',0.26136,0.13068,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Çanakkale Strait Exit',0.26136,0.13068,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Istanbul Strait Entry',0.26136,0.13068,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Istanbul Strait Exit',0.26136,0.13068,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Port Entry',0.22176,0.11088,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Lighthouse Fee','Port Exit',0.22176,0.11088,'USD',2026,'TABLO 1 – Official 2026 rate'),
        (NULL,'Foreign Flagged Commercial','Life-Saving Fee','Non-Stop Voyage (Round Trip)',0.583,NULL,'USD',2026,'TABLO 1 – Single rate'),
        (NULL,'Foreign Flagged Commercial','Life-Saving Fee','Istanbul Strait Entry',0.13068,NULL,'USD',2026,'TABLO 1 – Single rate'),
        (NULL,'Foreign Flagged Commercial','Life-Saving Fee','Istanbul Strait Exit',0.13068,NULL,'USD',2026,'TABLO 1 – Single rate'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Non-Stop Voyage (Round Trip)',2.4486,1.2243,'USD',2026,'TABLO 2 – Official 2026 rate'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Çanakkale Strait Entry',0.19008,0.09504,'USD',2026,'TABLO 2 – 27% discount'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Çanakkale Strait Exit',0.19008,0.09504,'USD',2026,'TABLO 2 – 27% discount'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Istanbul Strait Entry',0.19008,0.09504,'USD',2026,'TABLO 2 – 27% discount'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Istanbul Strait Exit',0.19008,0.09504,'USD',2026,'TABLO 2 – 27% discount'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Port Entry',0.16896,0.08448,'USD',2026,'TABLO 2 – 24% discount'),
        (NULL,'Foreign Flagged Passenger','Lighthouse Fee','Port Exit',0.16896,0.08448,'USD',2026,'TABLO 2 – 24% discount'),
        (NULL,'Foreign Flagged Passenger','Life-Saving Fee','Non-Stop Voyage (Round Trip)',0.583,NULL,'USD',2026,'TABLO 2 – Single rate'),
        (NULL,'Foreign Flagged Passenger','Life-Saving Fee','Istanbul Strait Entry',0.09504,NULL,'USD',2026,'TABLO 2 – Single rate'),
        (NULL,'Foreign Flagged Passenger','Life-Saving Fee','Istanbul Strait Exit',0.09504,NULL,'USD',2026,'TABLO 2 – Single rate'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Non-Stop Voyage (Round Trip)',2.4486,1.2243,'USD',2026,'TABLO 3 – Official 2026 rate'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Çanakkale Strait Entry',0.209088,0.104544,'USD',2026,'TABLO 3 – 20% discount'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Çanakkale Strait Exit',0.209088,0.104544,'USD',2026,'TABLO 3 – 20% discount'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Istanbul Strait Entry',0.209088,0.104544,'USD',2026,'TABLO 3 – 20% discount'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Istanbul Strait Exit',0.209088,0.104544,'USD',2026,'TABLO 3 – 20% discount'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Port Entry',0.1241856,0.0620928,'USD',2026,'TABLO 3 – 44% discount'),
        (NULL,'Turkish Flagged International','Lighthouse Fee','Port Exit',0.1241856,0.0620928,'USD',2026,'TABLO 3 – 44% discount'),
        (NULL,'Turkish Flagged International','Life-Saving Fee','Non-Stop Voyage (Round Trip)',0.583,NULL,'USD',2026,'TABLO 3 – Single rate'),
        (NULL,'Turkish Flagged International','Life-Saving Fee','Istanbul Strait Entry',0.104544,NULL,'USD',2026,'TABLO 3 – Single rate'),
        (NULL,'Turkish Flagged International','Life-Saving Fee','Istanbul Strait Exit',0.104544,NULL,'USD',2026,'TABLO 3 – Single rate'),
        (NULL,'Turkish Cabotage','Lighthouse Fee','Çanakkale Strait Entry',0.066,0.033,'USD',2026,'TABLO 4 – 75% discount'),
        (NULL,'Turkish Cabotage','Lighthouse Fee','Çanakkale Strait Exit',0.066,0.033,'USD',2026,'TABLO 4 – 75% discount'),
        (NULL,'Turkish Cabotage','Lighthouse Fee','Istanbul Strait Entry',0.066,0.033,'USD',2026,'TABLO 4 – 75% discount'),
        (NULL,'Turkish Cabotage','Lighthouse Fee','Istanbul Strait Exit',0.066,0.033,'USD',2026,'TABLO 4 – 75% discount'),
        (NULL,'Turkish Cabotage','Lighthouse Fee','Port Entry',0.03528,0.01764,'USD',2026,'TABLO 4 – 84% discount'),
        (NULL,'Turkish Cabotage','Lighthouse Fee','Port Exit',0.03528,0.01764,'USD',2026,'TABLO 4 – 84% discount'),
        (NULL,'Turkish Cabotage','Life-Saving Fee','Istanbul Strait Entry',0.033,NULL,'USD',2026,'TABLO 4 – Single rate'),
        (NULL,'Turkish Cabotage','Life-Saving Fee','Istanbul Strait Exit',0.033,NULL,'USD',2026,'TABLO 4 – Single rate'),
        (NULL,'Foreign Yacht','Lighthouse + Life-Saving','Transit Log (Navigation Permit) – NT 30-50',60,NULL,'USD',2026,'TABLO 5 – NT 30-50, flat fee USD'),
        (NULL,'Foreign Yacht','Lighthouse + Life-Saving','Transit Log (Navigation Permit) – NT 51-100',72,NULL,'USD',2026,'TABLO 5 – NT 51-100, flat fee USD'),
        (NULL,'Foreign Yacht','Lighthouse + Life-Saving','Transit Log (Navigation Permit) – NT 101+',1.2,NULL,'USD',2026,'TABLO 5 – NT 101+, per NT USD'),
        (NULL,'Annual Rate Vessels','Annual Fee','Annual Fee per NT',0.72,NULL,'USD',2026,'TABLO 6 – Single rate, all NT')
      `);
      console.log("[tariff-tables] Seeded 42 Light Dues rows.");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS chamber_of_shipping_fees (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        service_type VARCHAR,
        vessel_category VARCHAR,
        gt_min INTEGER,
        gt_max INTEGER,
        fee NUMERIC,
        flag_category VARCHAR DEFAULT 'turkish',
        currency VARCHAR DEFAULT 'TRY',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    await client.query(`DELETE FROM chamber_of_shipping_fees WHERE currency = 'USD' AND port_id IS NULL`);
    const chamberShippingCount = await client.query("SELECT COUNT(*) FROM chamber_of_shipping_fees");
    if (parseInt(chamberShippingCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO chamber_of_shipping_fees
          (port_id, gt_min, gt_max, fee, flag_category, currency, valid_year, notes)
        VALUES
          (NULL, 0,     500,    500,  'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 501,   1500,   1120, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 1501,  2500,   2050, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 2501,  5000,   2800, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 5001,  10000,  3400, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 10001, 25000,  4000, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 25001, 35000,  4500, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 35001, 50000,  5000, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 50001, 999999, 5300, 'turkish', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 0,     500,    1400, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 501,   1500,   2800, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 1501,  2500,   4200, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 2501,  5000,   4900, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 5001,  10000,  5900, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 10001, 25000,  7100, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 25001, 35000,  8200, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 35001, 50000,  9000, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee'),
          (NULL, 50001, 999999, 9700, 'foreign', 'TRY', 2026, '2026 Chamber of Shipping Fee')
      `);
      console.log("[tariff-tables] Seeded 18 Chamber of Shipping Fee rows (TRY).");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS chamber_freight_share (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        cargo_min INTEGER,
        cargo_max INTEGER,
        fee NUMERIC,
        flag_category VARCHAR DEFAULT 'foreign',
        currency VARCHAR DEFAULT 'USD',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS harbour_master_dues (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        service_type VARCHAR,
        vessel_category VARCHAR,
        grt_min INTEGER,
        grt_max INTEGER,
        fee NUMERIC,
        currency VARCHAR DEFAULT 'TRY',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sanitary_dues (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        nrt_rate NUMERIC,
        currency VARCHAR DEFAULT 'TRY',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    const { rows: freightCheck } = await client.query("SELECT COUNT(*)::int AS cnt FROM chamber_freight_share");
    if (freightCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO chamber_freight_share (port_id, cargo_min, cargo_max, fee, flag_category, currency, valid_year, notes) VALUES
          (NULL, 0,      20000,   580,  'foreign', 'USD', 2026, 'Official 2026 rate'),
          (NULL, 20001,  40000,   870,  'foreign', 'USD', 2026, 'Official 2026 rate'),
          (NULL, 40001,  60000,   1130, 'foreign', 'USD', 2026, 'Official 2026 rate'),
          (NULL, 60001,  100000,  1400, 'foreign', 'USD', 2026, 'Official 2026 rate'),
          (NULL, 100001, 999999,  1780, 'foreign', 'USD', 2026, 'Official 2026 rate')
      `);
      console.log("[tariff-tables] Seeded chamber_freight_share with 5 official rate bands.");
    }

    const { rows: sanitaryCheck } = await client.query("SELECT COUNT(*)::int AS cnt FROM sanitary_dues");
    if (sanitaryCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO sanitary_dues (port_id, nrt_rate, currency, valid_year, notes)
        VALUES (NULL, 21.67, 'TRY', 2026, 'Official 2026 rate')
      `);
      console.log("[tariff-tables] Seeded sanitary_dues with global rate.");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS vts_fees (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        service_name VARCHAR,
        fee NUMERIC,
        unit VARCHAR,
        currency VARCHAR DEFAULT 'USD',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    const { rows: vtsCheck } = await client.query("SELECT COUNT(*)::int AS cnt FROM vts_fees");
    if (vtsCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO vts_fees (port_id, service_name, fee, unit, currency, valid_year, notes) VALUES
          (NULL, 'Foreign Flagged Commercial – 300-2,000 NT',     92.40,    'per call', 'USD', 2026, 'TABLO 1 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Commercial – 2,001-5,000 NT',   184.80,   'per call', 'USD', 2026, 'TABLO 1 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Commercial – 5,001-10,000 NT',  346.50,   'per call', 'USD', 2026, 'TABLO 1 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Commercial – 10,001-20,000 NT', 519.75,   'per call', 'USD', 2026, 'TABLO 1 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Commercial – 20,001-50,000 NT', 693.00,   'per call', 'USD', 2026, 'TABLO 1 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Commercial – 50,001+ NT',       1039.50,  'per call', 'USD', 2026, 'TABLO 1 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Passenger – 300-2,000 NT',      70.40,    'per call', 'USD', 2026, 'TABLO 2 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Passenger – 2,001-5,000 NT',    140.80,   'per call', 'USD', 2026, 'TABLO 2 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Passenger – 5,001-10,000 NT',   264.00,   'per call', 'USD', 2026, 'TABLO 2 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Passenger – 10,001-20,000 NT',  396.00,   'per call', 'USD', 2026, 'TABLO 2 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Passenger – 20,001-50,000 NT',  528.00,   'per call', 'USD', 2026, 'TABLO 2 – Official 2026 rate'),
          (NULL, 'Foreign Flagged Passenger – 50,001+ NT',        792.00,   'per call', 'USD', 2026, 'TABLO 2 – Official 2026 rate'),
          (NULL, 'Turkish Flagged International – 300-2,000 NT',     23.10,     'per call', 'USD', 2026, 'TABLO 3 – Official 2026 rate'),
          (NULL, 'Turkish Flagged International – 2,001-5,000 NT',   46.20,     'per call', 'USD', 2026, 'TABLO 3 – Official 2026 rate'),
          (NULL, 'Turkish Flagged International – 5,001-10,000 NT',  86.625,    'per call', 'USD', 2026, 'TABLO 3 – Official 2026 rate'),
          (NULL, 'Turkish Flagged International – 10,001-20,000 NT', 129.9375,  'per call', 'USD', 2026, 'TABLO 3 – Official 2026 rate'),
          (NULL, 'Turkish Flagged International – 20,001-50,000 NT', 173.25,    'per call', 'USD', 2026, 'TABLO 3 – Official 2026 rate'),
          (NULL, 'Turkish Flagged International – 50,001+ NT',       259.875,   'per call', 'USD', 2026, 'TABLO 3 – Official 2026 rate'),
          (NULL, 'Turkish Cabotage – 300-2,000 NT',     8.40,   'per call', 'USD', 2026, 'TABLO 4 – Official 2026 rate'),
          (NULL, 'Turkish Cabotage – 2,001-5,000 NT',   16.80,  'per call', 'USD', 2026, 'TABLO 4 – Official 2026 rate'),
          (NULL, 'Turkish Cabotage – 5,001-10,000 NT',  31.50,  'per call', 'USD', 2026, 'TABLO 4 – Official 2026 rate'),
          (NULL, 'Turkish Cabotage – 10,001-20,000 NT', 47.25,  'per call', 'USD', 2026, 'TABLO 4 – Official 2026 rate'),
          (NULL, 'Turkish Cabotage – 20,001-50,000 NT', 63.00,  'per call', 'USD', 2026, 'TABLO 4 – Official 2026 rate'),
          (NULL, 'Turkish Cabotage – 50,001+ NT',       94.50,  'per call', 'USD', 2026, 'TABLO 4 – Official 2026 rate')
      `);
      console.log("[tariff-tables] Seeded 24 VTS fee rows.");
    }

    const { rows: globalPilotageCheck } = await client.query(
      "SELECT COUNT(*)::int AS cnt FROM pilotage_tariffs WHERE port_id IS NULL"
    );
    if (globalPilotageCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO pilotage_tariffs (port_id, service_type, vessel_category, grt_min, grt_max, base_fee, per_1000_grt, currency, valid_year, notes) VALUES
        -- T.1.1 Pilotage (official 2026 rates)
        (NULL, 'kabotaj',       'calisan_gemiler',                 0, 999999,  71.87, 25.67, 'USD', 2026, 'Port services x2 multiplier applies'),
        (NULL, 'uluslararasi',  'yolcu_feribot_roro_car_carrier',  0, 999999, 116.00, 46.00, 'USD', 2026, 'Port services x2 multiplier applies'),
        (NULL, 'uluslararasi',  'konteyner',                       0, 999999, 153.00, 65.00, 'USD', 2026, 'Port services x2 multiplier applies'),
        (NULL, 'uluslararasi',  'diger_yuk',                       0, 999999, 202.27, 83.17, 'USD', 2026, 'Port services x2 multiplier applies'),
        -- T.1.2 Tugboats (official 2026 rates)
        (NULL, 'romorkör_kabotaj',      'calisan_gemiler',                0, 999999, 122.18, 25.67, 'USD', 2026, 'x2 multiplier applies'),
        (NULL, 'romorkör_uluslararasi', 'yolcu_feribot_roro_car_carrier', 0, 999999, 224.00, 40.00, 'USD', 2026, 'x2 multiplier applies'),
        (NULL, 'romorkör_uluslararasi', 'konteyner',                      0, 999999, 299.00, 56.00, 'USD', 2026, 'x2 multiplier applies'),
        (NULL, 'romorkör_uluslararasi', 'diger_yuk',                      0, 999999, 382.99, 71.87, 'USD', 2026, 'x2 multiplier applies'),
        -- T.1.3 Mooring (official 2026 rates)
        (NULL, 'palamar_kabotaj',      'calisan_gemiler', 0, 999999, 11.29, 6.16,  'USD', 2026, 'Mooring x2 multiplier applies'),
        (NULL, 'palamar_uluslararasi', 'diger_tum',       0, 999999, 22.58, 11.29, 'USD', 2026, 'Mooring x2 multiplier applies')
      `);
      console.log("[tariff-tables] Seeded 10 global Pilotage/Tugboat/Mooring rows (T.1.1–T.1.3).");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS supervision_fees (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        category VARCHAR,
        cargo_type VARCHAR,
        quantity_range VARCHAR,
        rate NUMERIC,
        unit VARCHAR,
        currency VARCHAR DEFAULT 'EUR',
        notes TEXT,
        valid_year INTEGER DEFAULT 2026,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows: supCheck } = await client.query("SELECT COUNT(*)::int AS cnt FROM supervision_fees");
    if (supCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO supervision_fees (port_id, category, cargo_type, quantity_range, rate, unit, currency, valid_year, notes) VALUES
        (NULL, 'A - Dokme Esya', 'Kati Esya (Maden cevheri / hurda / komur / cimento / klinker / ponza / suni gubre)', '0 - 10.000 ton', 0.15, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Kati Esya (Maden cevheri / hurda / komur / cimento / klinker / ponza / suni gubre)', '10.001 - 20.000 ton', 0.10, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Kati Esya (Maden cevheri / hurda / komur / cimento / klinker / ponza / suni gubre)', '20.000 ton uzeri', 0.05, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Tahil ve Tohumlar (Bugday / arpa / misir / pirinc / soya / aycicegi)', '0 - 10.000 ton', 0.10, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Tahil ve Tohumlar (Bugday / arpa / misir / pirinc / soya / aycicegi)', '10.001 - 25.000 ton', 0.075, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Tahil ve Tohumlar (Bugday / arpa / misir / pirinc / soya / aycicegi)', '25.000 ton uzeri', 0.045, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Bakliyat (Bakla / fasulye / mercimek / nohut)', '0 - 5.000 ton', 0.30, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Bakliyat (Bakla / fasulye / mercimek / nohut)', '5.000 ton uzeri', 0.15, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Ham Petrol ve Akaryakit', '0 - 15.000 ton', 0.040, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Ham Petrol ve Akaryakit', '15.001 - 35.000 ton', 0.030, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Ham Petrol ve Akaryakit', '35.000 ton uzeri', 0.015, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'LPG ve LNG', '0 - 15.000 ton', 0.15, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'LPG ve LNG', '15.000 ton uzeri', 0.05, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'A - Dokme Esya', 'Kimyevi maddeler / Zeytinyagi / Melas / Madeni yag', 'Tum miktarlar', 0.15, 'EUR/MT', 'EUR', 2026, 'Sabit oran'),
        (NULL, 'B - Dokme Olmayan Esya', 'Tahil-Un / Seker / Cimento / Mermer blok', '0 - 20.000 ton', 0.15, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Tahil-Un / Seker / Cimento / Mermer blok', '20.000 ton uzeri', 0.05, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Taze meyve-sebze / Narenciye / Dondurulmus gida', 'Tum miktarlar', 1.00, 'EUR/MT', 'EUR', 2026, 'Sabit oran'),
        (NULL, 'B - Dokme Olmayan Esya', 'Bakliyat ve Tohumlar', 'Tum miktarlar', 0.60, 'EUR/MT', 'EUR', 2026, 'Sabit oran'),
        (NULL, 'B - Dokme Olmayan Esya', 'Kagit ve Demir-celik urunleri (Sac / kangal / profil / boru / rulo sac)', '0 - 5.000 ton', 0.25, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Kagit ve Demir-celik urunleri (Sac / kangal / profil / boru / rulo sac)', '5.001 - 10.000 ton', 0.15, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Kagit ve Demir-celik urunleri (Sac / kangal / profil / boru / rulo sac)', '10.000 ton uzeri', 0.10, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Agac kutugu ve tomruk', '0 - 3.000 ton', 0.50, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Agac kutugu ve tomruk', '3.001 - 5.000 ton', 0.35, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'B - Dokme Olmayan Esya', 'Agac kutugu ve tomruk', '5.001 ton uzeri', 0.10, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'C - Bos Konteyner / Bos Treyler', 'Bos konteyner ve bos treyler', 'Tum miktarlar', 10.00, 'EUR/Adet', 'EUR', 2026, 'Yillik 25.000 adet uzerinde islem yapan hatlar muaf'),
        (NULL, 'D - Canli Hayvanlar', 'Kucukbas hayvan', 'Tum miktarlar', 0.05, 'EUR/Adet', 'EUR', 2026, NULL),
        (NULL, 'D - Canli Hayvanlar', 'Buyukbas hayvan', 'Tum miktarlar', 0.15, 'EUR/Adet', 'EUR', 2026, NULL),
        (NULL, 'E - Diger / Kirkambar', 'Tasiyan tarafindan odenir', 'Tum miktarlar', 1.00, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'E - Diger / Kirkambar', 'Yukleyici veya alici tarafindan odenir', 'Tum miktarlar', 0.60, 'EUR/MT', 'EUR', 2026, NULL),
        (NULL, 'F - Konteyner', 'Dolu konteyner (tum yukler)', 'Tum miktarlar', 15.00, 'EUR/Adet', 'EUR', 2026, 'Yillik 50.000 adet uzerinde islem yapan hatlar muaf'),
        (NULL, 'F - Konteyner', 'Transit konteyner (yurt disi - yurt disi)', 'Tum miktarlar', 15.00, 'EUR/Adet', 'EUR', 2026, 'Yillik 50.000 adet uzerinde islem yapan hatlar muaf'),
        (NULL, 'G - Otomobil / Hafif Araclar', 'Otomobil / Jeep / Pikap / Panelvan / Minibus / Midibus', '0 - 50 adet', 5.00, 'EUR/Adet', 'EUR', 2026, NULL),
        (NULL, 'G - Otomobil / Hafif Araclar', 'Otomobil / Jeep / Pikap / Panelvan / Minibus / Midibus', '51 - 300 adet', 3.00, 'EUR/Adet', 'EUR', 2026, NULL),
        (NULL, 'G - Otomobil / Hafif Araclar', 'Otomobil / Jeep / Pikap / Panelvan / Minibus / Midibus', '301 ve uzeri', 1.50, 'EUR/Adet', 'EUR', 2026, NULL),
        (NULL, 'H - Ro-Ro / Is Makinalari', 'Tekerlekli-paletli vasita ve is makinalari', 'Tum miktarlar', 3.00, 'EUR/Metre', 'EUR', 2026, 'Uzunluk uzerinden beher metre icin'),
        (NULL, 'Genel Kural', 'Asgari gozetim ucreti', '--', 300, 'EUR', 'EUR', 2026, 'Hesaplanan toplam ucret 300 EUR altinda olamaz'),
        (NULL, 'Genel Kural', 'Azami gozetim ucreti', '--', 10000, 'EUR', 'EUR', 2026, 'Hesaplanan toplam ucret 10.000 EUR ustunde olamaz'),
        (NULL, 'Genel Kural', 'Turk bayrakli gemiler indirimi', '--', NULL, '--', 'EUR', 2026, 'Turk bayrakli gemilere tum ucretler %50 indirimli uygulanir')
      `);
      console.log("[tariff-tables] Seeded 38 Supervision Fee rows.");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_tariff_sections (
        id SERIAL PRIMARY KEY,
        label VARCHAR NOT NULL,
        default_currency VARCHAR DEFAULT 'USD',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_tariff_entries (
        id SERIAL PRIMARY KEY,
        section_id INTEGER NOT NULL REFERENCES custom_tariff_sections(id) ON DELETE CASCADE,
        port_id INTEGER REFERENCES ports(id),
        service_name VARCHAR,
        fee NUMERIC,
        unit VARCHAR,
        currency VARCHAR DEFAULT 'USD',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS misc_expenses (
        id SERIAL PRIMARY KEY,
        port_id INT REFERENCES ports(id) ON DELETE SET NULL,
        expense_type TEXT NOT NULL,
        fee_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        valid_year INT DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS misc_expenses_global_idx
        ON misc_expenses (expense_type)
        WHERE port_id IS NULL
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS misc_expenses_port_idx
        ON misc_expenses (port_id, expense_type)
        WHERE port_id IS NOT NULL
    `);

    for (const [expense_type, fee_usd] of [
      ['motorboat', 500], ['facilities', 550], ['transportation', 500],
      ['fiscal', 250], ['communication', 250],
      ['vts', 0], ['customs', 0], ['chamber_dto', 0], ['anchorage', 0],
    ]) {
      await client.query(
        `INSERT INTO misc_expenses (port_id, expense_type, fee_usd, valid_year)
         SELECT NULL, $1, $2, 2026
         WHERE NOT EXISTS (SELECT 1 FROM misc_expenses WHERE expense_type = $1 AND port_id IS NULL)`,
        [expense_type, fee_usd]
      );
    }

    // ── Global Agency Fee rows (port_id=NULL) — per_1000_nt doğru değerleriyle ──
    const { rows: globalAgencyCheck } = await client.query(
      "SELECT COUNT(*)::int AS cnt FROM agency_fees WHERE port_id IS NULL AND service_type='acentelik'"
    );

    if (globalAgencyCheck[0].cnt === 0) {
      await client.query(`
        INSERT INTO agency_fees (port_id, tariff_no, service_type, nt_min, nt_max, fee, per_1000_nt, currency, valid_year) VALUES
        (NULL,'T1','acentelik',0,500,600,NULL,'EUR',2026),
        (NULL,'T1','acentelik',501,1000,1000,NULL,'EUR',2026),
        (NULL,'T1','acentelik',1001,2000,1500,NULL,'EUR',2026),
        (NULL,'T1','acentelik',2001,3000,1850,NULL,'EUR',2026),
        (NULL,'T1','acentelik',3001,4000,2300,NULL,'EUR',2026),
        (NULL,'T1','acentelik',4001,5000,2750,NULL,'EUR',2026),
        (NULL,'T1','acentelik',5001,7500,3200,NULL,'EUR',2026),
        (NULL,'T1','acentelik',7501,10000,4000,NULL,'EUR',2026),
        (NULL,'T1','acentelik',10001,20000,4000,125,'EUR',2026),
        (NULL,'T1','acentelik',20001,30000,5250,100,'EUR',2026),
        (NULL,'T1','acentelik',30001,40000,6250,75,'EUR',2026),
        (NULL,'T1','acentelik',40001,50000,7000,75,'EUR',2026),
        (NULL,'T1','acentelik',50001,999999,7750,75,'EUR',2026)
      `);
    } else {
      await client.query(`
        UPDATE agency_fees SET per_1000_nt = 125, fee = 4000
          WHERE port_id IS NULL AND service_type='acentelik' AND nt_min = 10001;
        UPDATE agency_fees SET per_1000_nt = 100, fee = 5250
          WHERE port_id IS NULL AND service_type='acentelik' AND nt_min = 20001;
        UPDATE agency_fees SET per_1000_nt = 75, fee = 6250
          WHERE port_id IS NULL AND service_type='acentelik' AND nt_min = 30001;
        UPDATE agency_fees SET per_1000_nt = 75, fee = 7000
          WHERE port_id IS NULL AND service_type='acentelik' AND nt_min = 40001;
        UPDATE agency_fees SET per_1000_nt = 75, fee = 7750
          WHERE port_id IS NULL AND service_type='acentelik' AND nt_min = 50001;
      `);
    }

    console.log("[tariff-tables] ✓ All new tariff tables verified.");
  } catch (err) {
    console.error("[tariff-tables] Error ensuring tariff tables:", err);
    throw err;
  } finally {
    client.release();
  }
}
