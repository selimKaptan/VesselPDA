# Hızlı Proforma - Kullanıcı Giriş Formu Tanımı

---

## ZORUNLU ALANLAR (Bunlar olmadan hesaplama yapılamaz)

| # | Alan Adı | Tip | Örnek Değer | Açıklama |
|---|----------|-----|-------------|----------|
| 1 | **Liman / Terminal** | Dropdown | TÜPRAŞ Aliağa | Hangi limana geliyor |
| 2 | **Gemi Adı** | Text | M/T ALSU | Geminin adı |
| 3 | **NRT (Net Tonaj)** | Sayı | 1004 | Geminin net tonajı |
| 4 | **GRT (Gross Tonaj)** | Sayı | 2298 | Geminin gros tonajı |
| 5 | **Bayrak** | Dropdown | TÜRKİYE | Geminin bayrağı (otomatik olarak TÜRK/YABANCI/KABOTAJ kategorisi belirlenir) |
| 6 | **Yük Cinsi** | Dropdown | SFS OIL | Yükün tipi (tehlikeli mi belirler) |
| 7 | **Yük Miktarı (MT)** | Sayı | 3001 | Metrik ton cinsinden |
| 8 | **Geliş Nedeni** | Dropdown | Discharging (Tahliye) | İthalat/ihracat/transit - gümrük hesabı için kritik |
| 9 | **Tahmini Barınma Süresi** | Sayı (gün) | 4 | Rıhtımda kalış süresi |

---

## OPSİYONEL ALANLAR (Varsayılan değerleri var, değiştirilebilir)

| # | Alan Adı | Tip | Varsayılan | Ne Zaman Değişir |
|---|----------|-----|------------|------------------|
| 10 | **Demirleme Süresi** | Sayı (gün) | 0 | Gemi açıkta bekleyecekse |
| 11 | **Tehlikeli Yük** | Evet/Hayır | Yük cinsinden otomatik | Manuel override gerekebilir |
| 12 | **Gümrük Türü** | Dropdown | Geliş nedeninden otomatik | İTHALAT / İHRACAT / YOK |
| 13 | **Alıcı (TO:)** | Text | Boş | Proforma kimin adına düzenlenecek |
| 14 | **Referans No** | Text | Otomatik üret | 2026/1202 formatında |

---

## OTOMATİK HESAPLANAN ALANLAR (Kullanıcı girmez)

| Alan | Nasıl Hesaplanır |
|------|-----------------|
| **USD/TRY Kuru** | TCMB API'den günlük çekilir (veya manuel girilebilir) |
| **EUR/TRY Kuru** | TCMB API'den günlük çekilir |
| **EUR/USD Parite** | EUR_TRY / USD_TRY |
| **Bayrak Kategorisi** | Bayrak seçiminden otomatik: TR→TÜRK, diğer→YABANCI |
| **Tehlikeli Yük** | Yük cinsi seçiminden otomatik (SFS OIL→Evet, Tahıl→Hayır) |
| **Tarih** | Bugünün tarihi |

---

## GELİŞMİŞ AYARLAR (İleri Düzey - Gizlenebilir)

Bu alanlar normalde ana bayrak ile aynı değeri alır ama bazı özel durumlarda farklı olabilir.
"Gelişmiş Ayarlar" toggle'ı altında gösterilebilir:

| Alan | Varsayılan | Ne Zaman Farklı Olur |
|------|-----------|----------------------|
| **Fener Bayrak Tipi** | Ana bayrakla aynı | Nadiren farklı |
| **VTS Bayrak Tipi** | Ana bayrakla aynı | Nadiren farklı |
| **DTO Bayrak Tipi** | Ana bayrakla aynı | TÜRK/YABANCI seçimi |
| **Barınma Bayrak Tipi** | Ana bayrakla aynı | YABANCI/TÜRK/KABOTAJ |
| **Döviz Kurları** | Otomatik (TCMB) | Manuel override |

---

## FORM AKIŞI (UX Önerisi)

```
┌─────────────────────────────────────────────────────────┐
│                   HIZLI PROFORMA                        │
│                                                         │
│  ┌─ ADIM 1: LİMAN ──────────────────────────────────┐  │
│  │  Terminal:  [TÜPRAŞ Aliağa        ▼]              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ ADIM 2: GEMİ BİLGİLERİ ─────────────────────────┐  │
│  │  Gemi Adı:  [M/T ALSU          ]                  │  │
│  │  NRT:       [1004  ]    GRT: [2298  ]              │  │
│  │  Bayrak:    [TÜRKİYE            ▼]                 │  │
│  │                                                    │  │
│  │  💡 IMO numarası ile otomatik doldur (opsiyonel)   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ ADIM 3: YÜK BİLGİLERİ ──────────────────────────┐  │
│  │  Yük Cinsi:    [SFS OIL            ▼]  ⚠️ Tehlikeli│  │
│  │  Yük Miktarı:  [3001     ] MT                      │  │
│  │  Geliş Nedeni: [Discharging (Tahliye) ▼]           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ ADIM 4: SÜRE ───────────────────────────────────┐  │
│  │  Barınma:   [4  ] gün                             │  │
│  │  Demirleme: [0  ] gün  (opsiyonel)                │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ ADIM 5: DİĞER (opsiyonel) ──────────────────────┐  │
│  │  Alıcı (TO):  [CHEMTANKERS SHIPPING SA  ]         │  │
│  │  Ref No:      [2026/1202] (otomatik)               │  │
│  │                                                    │  │
│  │  ▶ Gelişmiş Ayarlar (döviz kuru, bayrak detayları) │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ DÖVİZ KURLARI ──────────────────────────────────┐  │
│  │  USD/TRY: 43.92  EUR/TRY: 51.42  (TCMB güncel)   │  │
│  │  [Manuel değiştir]                                 │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│         [  🔄  PROFORMA HESAPLA  ]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘

                        ↓ ↓ ↓

┌─────────────────────────────────────────────────────────┐
│  PROFORMA D/A – M/T ALSU – TÜPRAŞ Aliağa               │
│  Tarih: 01.03.2026    Ref: 2026/1202                    │
│  EUR/USD: 1.177285                                      │
│                                                         │
│  ┌───────────────────────┬──────────┬──────────┐        │
│  │ Kalem                 │  USD ($) │  EUR (€) │        │
│  ├───────────────────────┼──────────┼──────────┤        │
│  │ Pilotage              │   958.39 │   814.06 │        │
│  │ Tugboats              │ 1,369.50 │ 1,163.27 │        │
│  │ Wharfage              │   300.00 │   254.82 │        │
│  │ Mooring boat          │   117.42 │    99.73 │        │
│  │ Garbage               │   164.82 │   140.00 │        │
│  │ Oto service           │    22.98 │    19.52 │        │
│  │ Harbour Master        │   106.82 │    90.73 │        │
│  │ Sanitary dues         │   495.37 │   420.77 │        │
│  │ Light dues            │   224.03 │   190.29 │        │
│  │ Customs Overtime      │   687.96 │   584.36 │        │
│  │ Anchorage             │     0.00 │     0.00 │        │
│  │ Chamber of shipping   │    46.68 │    39.65 │        │
│  │ Chamber freight share │   580.00 │   492.66 │        │
│  │ Maritime Assoc. fee   │    23.41 │    19.89 │        │
│  │ Motorboat exp.        │   500.00 │   424.71 │        │
│  │ Facilities exp.       │   550.00 │   467.18 │        │
│  │ Transportation exp.   │   500.00 │   424.71 │        │
│  │ Fiscal & Notary       │   250.00 │   212.35 │        │
│  │ Communication         │   250.00 │   212.35 │        │
│  │ Supervision fee       │   529.95 │   450.15 │        │
│  │ Agency fee            │ 1,765.93 │ 1,500.00 │        │
│  ├───────────────────────┼──────────┼──────────┤        │
│  │ TOTAL                 │ 9,443.25 │ 8,021.21 │        │
│  └───────────────────────┴──────────┴──────────┘        │
│                                                         │
│  [📥 PDF İndir]  [📊 Excel İndir]  [📧 E-posta Gönder] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## AKILLI ÖZELLİKLER (İlerisi İçin)

### 1. IMO ile Otomatik Doldurma
Kullanıcı IMO numarası girerse → gemi adı, NRT, GRT, bayrak otomatik gelsin.
Kaynak: Daha önce kaydedilmiş gemiler veya harici API.

### 2. Son Kullanılan Gemiler
Son 10 gemi dropdown olarak gösterilsin → tek tıkla doldur.

### 3. Favori Terminaller
Kullanıcının sık kullandığı terminaller üstte gösterilsin.

### 4. Karşılaştırma Modu
Aynı gemi için 2-3 farklı terminali yan yana karşılaştır.

### 5. Hızlı Tekrar
Önceki proformayı aç → sadece değişen alanları güncelle → yeniden hesapla.
