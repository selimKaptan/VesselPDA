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
      (2,'T1','acentelik',10001,20000,125.00,'EUR'),
      (2,'T2','koruyucu_acentelik',10001,20000,63.00,'EUR'),
      (2,'T1','acentelik',20001,30000,100.00,'EUR'),
      (2,'T2','koruyucu_acentelik',20001,30000,50.00,'EUR'),
      (2,'T1','acentelik',30001,999999,75.00,'EUR'),
      (2,'T2','koruyucu_acentelik',30001,999999,38.00,'EUR')
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS chamber_of_shipping_fees (
        id SERIAL PRIMARY KEY,
        port_id INTEGER REFERENCES ports(id),
        service_type VARCHAR,
        vessel_category VARCHAR,
        grt_min INTEGER,
        grt_max INTEGER,
        fee NUMERIC,
        flag_category VARCHAR DEFAULT 'turkish',
        currency VARCHAR DEFAULT 'TRY',
        valid_year INTEGER DEFAULT 2026,
        notes TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

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

    console.log("[tariff-tables] ✓ All new tariff tables verified.");
  } catch (err) {
    console.error("[tariff-tables] Error ensuring tariff tables:", err);
    throw err;
  } finally {
    client.release();
  }
}
