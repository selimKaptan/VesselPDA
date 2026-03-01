-- ============================================================================
-- PROFORMA DISBURSEMENT ACCOUNT (PDA) SYSTEM - DATABASE SCHEMA
-- Technology: PostgreSQL (recommended) / Can be adapted for MySQL
-- Stack: Node.js + Express/Next.js + Prisma ORM
-- ============================================================================

-- ============================================================================
-- 1. TEMEL REFERANS TABLOLARI
-- ============================================================================

-- Ülke bayrakları
CREATE TABLE flags (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,        -- 'TR', 'MT', 'PA', 'LR' vb.
    name_tr VARCHAR(100) NOT NULL,            -- 'TÜRKİYE', 'MALTA' vb.
    name_en VARCHAR(100) NOT NULL,            -- 'TURKIYE', 'MALTA' vb.
    category VARCHAR(20) NOT NULL,            -- 'TURK', 'YABANCI', 'KABOTAJ'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yük tipleri
CREATE TABLE cargo_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,         -- 'SFS_OIL', 'CRUDE', 'LPG' vb.
    name_en VARCHAR(100) NOT NULL,
    name_tr VARCHAR(100) NOT NULL,
    is_dangerous BOOLEAN DEFAULT FALSE,       -- Tehlikeli yük mü?
    category VARCHAR(30),                     -- 'LIQUID_BULK', 'DRY_BULK', 'CONTAINER' vb.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geliş nedenleri
CREATE TABLE call_purposes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,         -- 'DISCHARGING', 'LOADING', 'TRANSIT'
    name_en VARCHAR(50) NOT NULL,
    name_tr VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. LİMAN & TERMİNAL YAPISI
-- ============================================================================

-- Bölgeler (İzmir, Marmara, Akdeniz vb.)
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,                -- 'EGE', 'MARMARA', 'AKDENİZ', 'KARADENİZ'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limanlar
CREATE TABLE ports (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,         -- 'ALIAGA', 'TEKIRDAG', 'IZMIR', 'MERSIN'
    name_tr VARCHAR(100) NOT NULL,            -- 'Aliağa'
    name_en VARCHAR(100) NOT NULL,            -- 'ALIAGA'
    region_id INTEGER REFERENCES regions(id),
    city VARCHAR(50),                         -- 'İzmir', 'Tekirdağ'
    country VARCHAR(10) DEFAULT 'TR',
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terminaller (bir limanın içinde birden fazla terminal olabilir)
CREATE TABLE terminals (
    id SERIAL PRIMARY KEY,
    port_id INTEGER NOT NULL REFERENCES ports(id),
    code VARCHAR(30) NOT NULL UNIQUE,         -- 'TUPRAS_ALIAGA', 'CEYPORT_TEKIRDAG', 'TCDD_IZMIR'
    name VARCHAR(100) NOT NULL,               -- 'TÜPRAŞ Aliağa', 'Ceyport Tekirdağ'
    operator VARCHAR(100),                    -- 'TÜPRAŞ', 'Ceyport', 'TCDD'
    terminal_type VARCHAR(30),                -- 'OIL', 'CONTAINER', 'GENERAL', 'BULK'
    has_pilotage BOOLEAN DEFAULT TRUE,
    has_tugboat BOOLEAN DEFAULT TRUE,
    has_mooring_boat BOOLEAN DEFAULT TRUE,
    has_pelikan_passage BOOLEAN DEFAULT FALSE, -- ISS Palm gibi özel geçişler
    has_vts BOOLEAN DEFAULT FALSE,
    has_anchorage BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. TARİFE SİSTEMİ (Çekirdek - En Kritik Kısım)
-- ============================================================================

-- Tarife kategorileri
CREATE TABLE tariff_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name_tr VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    description TEXT
);

-- Önceden tanımlı kategoriler:
-- 'PILOTAGE'          → Kılavuzluk
-- 'TUGBOAT'           → Römorkör
-- 'MOORING'           → Palamar
-- 'WHARFAGE'          → Barınma / Rıhtım
-- 'GARBAGE'           → Çöp
-- 'HARBOUR_MASTER'    → Liman Çıkış Belgesi (LÇB)
-- 'SANITARY'          → Sağlık Resmi
-- 'LIGHT_DUES'        → Fener Ücreti
-- 'VTS'               → VTS Ücreti
-- 'CUSTOMS'           → Gümrük Mesai
-- 'ANCHORAGE'         → Demirleme
-- 'DTO_FEE'           → Deniz Ticaret Odası Ücreti
-- 'DTO_FREIGHT'       → DTO Hasılat Payı
-- 'VDA_FEE'           → VDA (Denizcilik Derneği) Ücreti
-- 'SUPERVISION'       → Süpervizyon
-- 'AGENCY_FEE'        → Acente Ücreti
-- 'MOTORBOAT'         → Motorbot
-- 'OTO_SERVICE'       → Oto Servis
-- 'FACILITIES'        → Tesis Masrafları
-- 'TRANSPORTATION'    → Ulaşım
-- 'FISCAL_NOTARY'     → Mali & Noter
-- 'COMMUNICATION'     → İletişim & Kırtasiye
-- 'PELIKAN_PASSAGE'   → Pelikan Boğazı Geçişi

-- Tarife kalemleri (her liman/terminal için hangi kalemler aktif)
CREATE TABLE tariff_items (
    id SERIAL PRIMARY KEY,
    terminal_id INTEGER NOT NULL REFERENCES terminals(id),
    category_id INTEGER NOT NULL REFERENCES tariff_categories(id),
    
    -- Hesaplama yöntemi
    calc_method VARCHAR(30) NOT NULL,
    -- 'TIERED_GRT'      → GRT bazlı kademe tablosu (kılavuzluk, römorkör, palamar)
    -- 'TIERED_NRT'      → NRT bazlı kademe tablosu (fener, VTS, DTO, acente)
    -- 'TIERED_CARGO'    → Yük miktarı bazlı kademe (gümrük, DTO hasılat)
    -- 'NRT_FACTOR'      → NRT × katsayı (sağlık resmi)
    -- 'GRT_DAILY'       → GRT × gün bazlı (barınma)
    -- 'CARGO_FACTOR'    → Yük miktarı × katsayı (süpervizyon)
    -- 'FIXED_USD'       → Sabit $ tutar (motorbot, ulaşım vb.)
    -- 'FIXED_EUR'       → Sabit € tutar
    -- 'FIXED_TL'        → Sabit TL tutar
    -- 'GRT_PERCENT'     → GRT × yüzde (oto servis)
    -- 'FORMULA'         → Özel formül (LÇB, demirleme vb.)
    
    -- Döviz cinsi
    currency VARCHAR(3) DEFAULT 'USD',        -- 'USD', 'EUR', 'TRY'
    
    -- Çarpanlar
    multiplier DECIMAL(6,2) DEFAULT 1,        -- Giriş+çıkış = 2, 4 römorkör vb.
    dangerous_cargo_surcharge DECIMAL(4,2) DEFAULT 1.0, -- Tehlikeli yük çarpanı (1.3)
    overtime_surcharge DECIMAL(4,2) DEFAULT 1.5,         -- Mesai dışı çarpanı
    
    -- Görüntüleme
    display_name_en VARCHAR(200),
    display_note_en TEXT,                      -- '%50 overtime will applicable...'
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Versiyon kontrolü
    effective_from DATE NOT NULL,              -- Bu tarife ne zaman başladı
    effective_to DATE,                         -- NULL = hala geçerli
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(terminal_id, category_id, effective_from)
);

-- ============================================================================
-- 4. KADEME TABLOLARI (Lookup/Rate Tables)
-- ============================================================================

-- Genel kademe tablosu (kılavuzluk, römorkör, palamar, fener, VTS, DTO, acente vb.)
CREATE TABLE tariff_rate_tiers (
    id SERIAL PRIMARY KEY,
    tariff_item_id INTEGER NOT NULL REFERENCES tariff_items(id) ON DELETE CASCADE,
    
    -- Kademe aralığı
    min_value DECIMAL(12,2) NOT NULL,         -- Başlangıç tonajı/miktarı (0, 501, 2001...)
    max_value DECIMAL(12,2),                  -- Bitiş (NULL = sınırsız)
    
    -- Bayrak/tip bazlı fiyatlar (hepsi aynı anda kullanılmaz)
    base_rate DECIMAL(12,4),                  -- Taban fiyat
    per_unit_rate DECIMAL(12,4),              -- Her ek 1000 ton için ek ücret
    unit_size DECIMAL(10,2) DEFAULT 1000,     -- Birim büyüklüğü (genelde 1000)
    
    -- Bayrak kategorisine göre farklı oranlar (fener, VTS gibi)
    rate_turk DECIMAL(12,4),
    rate_yabanci DECIMAL(12,4),
    rate_kabotaj DECIMAL(12,4),
    
    -- İthalat/ihracat bazlı farklı oranlar (gümrük gibi)
    rate_import DECIMAL(12,4),
    rate_export DECIMAL(12,4),
    
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SABİT PARAMETRELER & KATSAYILAR
-- ============================================================================

-- Terminal bazlı sabit parametreler
CREATE TABLE terminal_parameters (
    id SERIAL PRIMARY KEY,
    terminal_id INTEGER NOT NULL REFERENCES terminals(id),
    param_key VARCHAR(50) NOT NULL,
    param_value DECIMAL(12,6) NOT NULL,
    currency VARCHAR(3),
    description TEXT,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(terminal_id, param_key, effective_from)
);

-- Örnek parametreler:
-- 'SANITARY_NRT_FACTOR'      → 21.67 (sağlık resmi NRT çarpanı)
-- 'SUPERVISION_CARGO_FACTOR' → 0.15 (süpervizyon yük çarpanı)
-- 'OTO_SERVICE_GRT_PERCENT'  → 0.01 (oto servis GRT yüzdesi)
-- 'GARBAGE_FIXED'            → 164.8199 (çöp sabit ücreti $)
-- 'MOTORBOAT_FIXED'          → 500 (motorbot sabit $)
-- 'FACILITIES_FIXED'         → 550
-- 'TRANSPORTATION_FIXED'     → 500
-- 'FISCAL_NOTARY_FIXED'      → 250
-- 'COMMUNICATION_FIXED'      → 250
-- 'ANCHORAGE_DAILY_FACTOR'   → 0.004 (≤7 gün)
-- 'ANCHORAGE_EXTRA_FACTOR'   → 0.006 (>7 gün)
-- 'ANCHORAGE_THRESHOLD_DAYS' → 7
-- 'AGENCY_EXTRA_DAYS_THRESHOLD' → 7
-- 'AGENCY_EXTRA_DAYS_SURCHARGE' → 0.20
-- 'VDA_MULTIPLIER_SMALL'     → 20 (NRT ≤ 5000)
-- 'VDA_MULTIPLIER_LARGE'     → 40 (NRT > 5000)
-- 'CUSTOMS_EXTRA_TL'         → 3865 (ithalat/ihracat ek gümrük TL)
-- 'LCB_ORDINO_EXTRA_TL'      → 5.71

-- ============================================================================
-- 6. GEMİ BİLGİLERİ
-- ============================================================================

CREATE TABLE vessels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,               -- 'M/T ALSU'
    imo_number VARCHAR(20) UNIQUE,            -- IMO numarası
    flag_id INTEGER REFERENCES flags(id),
    nrt DECIMAL(10,2) NOT NULL,               -- Net Registered Tonnage
    grt DECIMAL(10,2) NOT NULL,               -- Gross Registered Tonnage
    dwt DECIMAL(10,2),                        -- Deadweight Tonnage
    vessel_type VARCHAR(30),                  -- 'TANKER', 'BULKER', 'CONTAINER'
    loa DECIMAL(8,2),                         -- Length Overall (metre)
    beam DECIMAL(8,2),                        -- Genişlik (metre)
    draft DECIMAL(6,2),                       -- Su çekimi (metre)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. PROFORMA (HESAPLANAN ÇIKTI)
-- ============================================================================

CREATE TABLE proformas (
    id SERIAL PRIMARY KEY,
    ref_no VARCHAR(30) NOT NULL UNIQUE,       -- '2026/1202'
    
    -- Gemi & Sefer bilgileri
    vessel_id INTEGER REFERENCES vessels(id),
    vessel_name VARCHAR(100),                 -- Denormalize (gemi sonra değişebilir)
    nrt DECIMAL(10,2) NOT NULL,
    grt DECIMAL(10,2) NOT NULL,
    flag_category VARCHAR(20) NOT NULL,       -- 'TURK', 'YABANCI', 'KABOTAJ'
    
    -- Liman & Terminal
    terminal_id INTEGER NOT NULL REFERENCES terminals(id),
    port_name VARCHAR(50) NOT NULL,
    
    -- Sefer detayları
    call_purpose_id INTEGER REFERENCES call_purposes(id),
    cargo_type_id INTEGER REFERENCES cargo_types(id),
    cargo_quantity DECIMAL(12,2),
    is_dangerous_cargo BOOLEAN DEFAULT FALSE,
    est_berth_stay INTEGER,                   -- Tahmini barınma günü
    est_anchorage_days INTEGER DEFAULT 0,     -- Tahmini demirleme günü
    
    -- Alıcı bilgileri
    addressed_to VARCHAR(200),                -- 'CHEMTANKERS SHIPPING SA'
    
    -- Döviz kurları (proforma anındaki)
    usd_try_rate DECIMAL(10,6),
    eur_try_rate DECIMAL(10,6),
    eur_usd_rate DECIMAL(10,6),
    
    -- Toplamlar
    total_usd DECIMAL(12,2),
    total_eur DECIMAL(12,2),
    
    -- Durum
    status VARCHAR(20) DEFAULT 'DRAFT',       -- 'DRAFT', 'SENT', 'CONFIRMED', 'INVOICED'
    proforma_date DATE NOT NULL,
    
    -- Meta
    created_by INTEGER,                       -- User ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proforma kalemleri (her satır)
CREATE TABLE proforma_items (
    id SERIAL PRIMARY KEY,
    proforma_id INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    tariff_item_id INTEGER REFERENCES tariff_items(id),
    category_code VARCHAR(30) NOT NULL,       -- 'PILOTAGE', 'TUGBOAT' vb.
    
    display_name VARCHAR(200) NOT NULL,
    display_note TEXT,
    
    amount_usd DECIMAL(12,2) NOT NULL,
    amount_eur DECIMAL(12,2) NOT NULL,
    
    -- Hesaplama detayı (debug/audit için)
    calc_details JSONB,
    -- Örnek: {"method": "TIERED_GRT", "grt": 2298, "base": 202.27, 
    --         "extra_per_1000": 83.17, "tiers_used": 2, "dangerous_mult": 1.3,
    --         "in_out_mult": 2, "raw_result": 958.386}
    
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. KULLANICI & YETKİ
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(200) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    company VARCHAR(200),
    role VARCHAR(20) DEFAULT 'AGENT',         -- 'ADMIN', 'AGENT', 'VIEWER'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. DÖVİZ KURLARI (Tarihsel)
-- ============================================================================

CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    rate_date DATE NOT NULL,
    usd_try DECIMAL(10,6) NOT NULL,
    eur_try DECIMAL(10,6) NOT NULL,
    eur_usd DECIMAL(10,6) NOT NULL,
    source VARCHAR(50),                       -- 'TCMB', 'GOOGLE_FINANCE', 'MANUAL'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(rate_date, source)
);

-- ============================================================================
-- 10. TARİFE DEĞİŞİKLİK LOG (Audit Trail)
-- ============================================================================

CREATE TABLE tariff_change_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL,              -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT                               -- 'Yeni yıl tarife güncellemesi' vb.
);

-- ============================================================================
-- INDEXLER
-- ============================================================================

CREATE INDEX idx_tariff_items_terminal ON tariff_items(terminal_id);
CREATE INDEX idx_tariff_items_category ON tariff_items(category_id);
CREATE INDEX idx_tariff_items_effective ON tariff_items(effective_from, effective_to);
CREATE INDEX idx_tariff_rate_tiers_item ON tariff_rate_tiers(tariff_item_id);
CREATE INDEX idx_proformas_terminal ON proformas(terminal_id);
CREATE INDEX idx_proformas_date ON proformas(proforma_date);
CREATE INDEX idx_proformas_status ON proformas(status);
CREATE INDEX idx_proforma_items_proforma ON proforma_items(proforma_id);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(rate_date);
