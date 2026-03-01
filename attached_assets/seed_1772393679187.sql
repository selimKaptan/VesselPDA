-- ============================================================================
-- SEED DATA - Başlangıç Verileri
-- ============================================================================

-- Tarife Kategorileri
INSERT INTO tariff_categories (code, name_tr, name_en, sort_order) VALUES
('PILOTAGE',        'Kılavuzluk',                    'Pilotage',                      1),
('TUGBOAT',         'Römorkör',                       'Tugboats',                      2),
('MOORING',         'Palamar',                        'Mooring Boat',                  3),
('WHARFAGE',        'Barınma / Rıhtım Ücreti',       'Wharfage / Quay Dues',          4),
('GARBAGE',         'Çöp Toplama',                    'Garbage (Compulsory)',           5),
('OTO_SERVICE',     'Oto Servis',                     'Oto Service',                   6),
('HARBOUR_MASTER',  'Liman Çıkış Belgesi',            'Harbour Master Dues',           7),
('SANITARY',        'Sağlık Resmi',                   'Sanitary Dues',                 8),
('LIGHT_DUES',      'Fener Ücreti',                   'Light Dues',                    9),
('VTS',             'VTS Ücreti',                     'VTS Fee',                       10),
('CUSTOMS',         'Gümrük Mesai',                   'Customs Overtime',              11),
('ANCHORAGE',       'Demirleme',                      'Anchorage Dues',                12),
('DTO_FEE',         'Deniz Ticaret Odası Ücreti',     'Chamber of Shipping Fee',       13),
('DTO_FREIGHT',     'DTO Hasılat Payı',               'Chamber of Shipping Share',     14),
('VDA_FEE',         'Denizcilik Derneği Ücreti',      'Maritime Association Fee',       15),
('MOTORBOAT',       'Motorbot',                       'Motorboat Exp.',                16),
('FACILITIES',      'Tesis & Diğer Masraflar',        'Facilities & Other Exp.',       17),
('TRANSPORTATION',  'Ulaşım',                         'Transportation Exp.',           18),
('FISCAL_NOTARY',   'Mali & Noter Masrafları',         'Fiscal & Notary Exp.',          19),
('COMMUNICATION',   'İletişim & Kırtasiye',           'Communication & Copy & Stamp',  20),
('SUPERVISION',     'Süpervizyon',                     'Supervision Fee',               21),
('AGENCY_FEE',      'Acentelik Ücreti',               'Agency Fee',                    22),
('PELIKAN_PASSAGE', 'Pelikan Boğazı Geçişi',          'Pelikan Bank Passage Pilot',    23);

-- Bayraklar
INSERT INTO flags (code, name_tr, name_en, category) VALUES
('TR', 'TÜRKİYE', 'TURKIYE', 'TURK'),
('MT', 'MALTA', 'MALTA', 'YABANCI'),
('PA', 'PANAMA', 'PANAMA', 'YABANCI'),
('LR', 'LİBERYA', 'LIBERIA', 'YABANCI'),
('MH', 'MARSHALL ADALARI', 'MARSHALL ISLANDS', 'YABANCI'),
('GR', 'YUNANİSTAN', 'GREECE', 'YABANCI'),
('CY', 'KIBRIS', 'CYPRUS', 'YABANCI'),
('SG', 'SİNGAPUR', 'SINGAPORE', 'YABANCI');

-- Geliş Nedenleri
INSERT INTO call_purposes (code, name_en, name_tr) VALUES
('DISCHARGING', 'Discharging', 'Tahliye'),
('LOADING', 'Loading', 'Yükleme'),
('LOADING_DISCHARGING', 'Loading & Discharging', 'Yükleme & Tahliye'),
('TRANSIT', 'Transit', 'Transit'),
('BUNKERING', 'Bunkering', 'Yakıt İkmali'),
('STS', 'Ship to Ship', 'Gemiden Gemiye Transfer'),
('REPAIR', 'Repair', 'Tamir'),
('SHELTER', 'Shelter', 'Barınma');

-- Bölgeler
INSERT INTO regions (name) VALUES
('EGE'), ('MARMARA'), ('AKDENİZ'), ('KARADENİZ');

-- Limanlar
INSERT INTO ports (code, name_tr, name_en, region_id, city) VALUES
('ALIAGA',    'Aliağa',    'ALIAGA',    1, 'İzmir'),
('IZMIR',     'İzmir',     'IZMIR',     1, 'İzmir'),
('TEKIRDAG',  'Tekirdağ',  'TEKIRDAG',  2, 'Tekirdağ'),
('MERSIN',    'Mersin',    'MERSIN',    3, 'Mersin'),
('ISKENDERUN','İskenderun','ISKENDERUN',3, 'Hatay'),
('IZMIT',     'İzmit',     'IZMIT',     2, 'Kocaeli'),
('ISTANBUL',  'İstanbul',  'ISTANBUL',  2, 'İstanbul'),
('SAMSUN',    'Samsun',    'SAMSUN',    4, 'Samsun'),
('TRABZON',   'Trabzon',   'TRABZON',   4, 'Trabzon'),
('ANTALYA',   'Antalya',   'ANTALYA',   3, 'Antalya');

-- Terminaller (Excel'deki 4 terminal + genişleme)
INSERT INTO terminals (port_id, code, name, operator, terminal_type, has_pelikan_passage, has_vts) VALUES
(1, 'TUPRAS_ALIAGA',     'TÜPRAŞ Aliağa',       'TÜPRAŞ',  'OIL',       FALSE, FALSE),
(2, 'TCDD_IZMIR',        'TCDD İzmir Alsancak',  'TCDD',    'GENERAL',   FALSE, FALSE),
(2, 'ISS_PALM_IZMIR',    'ISS Palm İzmir',       'ISS',     'OIL',       TRUE,  TRUE),
(3, 'CEYPORT_TEKIRDAG',  'Ceyport Tekirdağ',     'Ceyport', 'GENERAL',   FALSE, FALSE);

-- Yük Tipleri
INSERT INTO cargo_types (code, name_en, name_tr, is_dangerous, category) VALUES
('SFS_OIL',    'SFS Oil',         'SFS Yağ',          TRUE,  'LIQUID_BULK'),
('CRUDE_OIL',  'Crude Oil',       'Ham Petrol',        TRUE,  'LIQUID_BULK'),
('FUEL_OIL',   'Fuel Oil',        'Akaryakıt',         TRUE,  'LIQUID_BULK'),
('LPG',        'LPG',             'LPG',               TRUE,  'LIQUID_BULK'),
('NAPHTHA',    'Naphtha',         'Nafta',             TRUE,  'LIQUID_BULK'),
('CHEMICALS',  'Chemicals',       'Kimyasal',          TRUE,  'LIQUID_BULK'),
('VEG_OIL',    'Vegetable Oil',   'Bitkisel Yağ',      FALSE, 'LIQUID_BULK'),
('GRAIN',      'Grain',           'Tahıl',             FALSE, 'DRY_BULK'),
('COAL',       'Coal',            'Kömür',             FALSE, 'DRY_BULK'),
('IRON_ORE',   'Iron Ore',        'Demir Cevheri',     FALSE, 'DRY_BULK'),
('CONTAINER',  'Container',       'Konteyner',         FALSE, 'CONTAINER'),
('GENERAL',    'General Cargo',   'Genel Kargo',       FALSE, 'GENERAL');
