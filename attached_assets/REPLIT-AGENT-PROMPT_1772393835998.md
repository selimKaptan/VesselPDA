Sen bir gemi acentesi proforma hesaplama sistemi kuruyorsun. Bu sistem, gemilerin Türk limanlarına geldiğinde ödeyeceği liman masraflarını otomatik hesaplar.

## PROJE: Port Disbursement Account (PDA) Calculator
## TEKNOLOJİ: Next.js 14 + TypeScript + Prisma + PostgreSQL

---

## 1. PROJE YAPISI

```
├── prisma/schema.prisma
├── src/
│   ├── engine/
│   │   ├── index.ts           (Ana hesaplama orkestratörü)
│   │   ├── types.ts           (TypeScript interface'leri)
│   │   └── calculators/       (Her kalem için ayrı hesaplayıcı)
│   ├── data/                  (Tarife JSON dosyaları)
│   └── lib/db.ts              (Prisma client)
├── app/
│   ├── page.tsx               (Giriş formu)
│   ├── api/proforma/calculate/route.ts
│   └── layout.tsx
```

---

## 2. HESAPLAMA MANTIĞI

Girdiler: vesselName, NRT, GRT, flagCategory (TURK/YABANCI/KABOTAJ), cargoQuantity, isDangerousCargo, callPurpose (DISCHARGING/LOADING), estBerthStay (gün), terminalCode

Döviz: usdTry, eurTry, eurUsd (güncel kurlar)

### HER KALEMİN FORMÜLÜ:

**A. KILAVUZLUK (Pilotage) - USD:**
```
multiplier = 2 (giriş+çıkış)
tehlikeli_carpan = isDangerousCargo ? 1.3 : 1.0
GRT <= 1000: taban = 202.27
GRT > 1000:  taban = 202.27 + Math.ceil((GRT-1000)/1000) * 83.17
SONUÇ = multiplier * taban * tehlikeli_carpan
```

**B. RÖMORKÖR (Tugboat) - USD:**
```
romorkör_sayısı = GRT > 5000 ? 4 : 2
tehlikeli_carpan = isDangerousCargo ? 1.3 : 1.0
GRT <= 1000: taban = 382.99
GRT > 1000:  taban = 382.99 + Math.ceil((GRT-1000)/1000) * 71.87
SONUÇ = romorkör_sayısı * taban * tehlikeli_carpan
```

**C. PALAMAR (Mooring) - USD:**
```
multiplier = 2
tehlikeli_carpan = isDangerousCargo ? 1.3 : 1.0
GRT <= 1000: taban = 22.58
GRT > 1000:  taban = 22.58 + Math.ceil((GRT-1000)/1000) * 11.29
SONUÇ = multiplier * taban * tehlikeli_carpan
```

**D. BARINMA (Wharfage) - USD:**
```
Genel limanlar:
  birim = GRT <= 500 ? 10 : Math.ceil(GRT/1000) * 25
  bayrak_carpan = YABANCI:1.0, TURK:0.75, KABOTAJ:0.5
  SONUÇ = Math.ceil(birim * bayrak_carpan) * estBerthStay

TCDD İzmir özel:
  SONUÇ = Math.ceil(GRT/1000) * 10 * estBerthStay
```

**E. ÇÖP (Garbage) - USD:**
```
SONUÇ = 164.8199 (sabit)
```

**F. OTO SERVİS - USD:**
```
SONUÇ = GRT * 0.01
```

**G. LİMAN ÇIKIŞ BELGESİ (Harbour Master) - TL→USD:**
```
LÇB ve mesai dışı LÇB karmaşık formüllerle hesaplanır.
Şimdilik yaklaşık değer kullan: NRT bazlı lookup tablosu.
Basitleştirilmiş: lcb=77.96, mesaiDisi=14.30 (NRT=1004 için)
ordino = (mesaiDisi / 2) + (5.71 / usdTry)
TOPLAM = (mesaiDisi + lcb + 2*ordino)
```

**H. SAĞLIK RESMİ (Sanitary) - TL→USD:**
```
SONUÇ = (NRT * 21.67) / usdTry
```

**I. FENER (Light Dues) - USD:**
```
Bayrak bazlı katsayılar:
  YABANCI: ilk800=0.22176, üst=0.11088
  TURK:    ilk800=0.1241856, üst=0.0620928
  KABOTAJ: ilk800=0.03528, üst=0.01764

SONUÇ = (Math.min(NRT,800)*ilk800 + Math.max(0,NRT-800)*üst) * 2
```

**J. GÜMRÜK MESAİ (Customs) - TL→USD:**
```
Yük miktarına göre kademe tablosu (ithalat/ihracat farklı):
İthalat kademe: [0-3000:20100TL, 3001-6000:26350TL, 6001-9000:32700TL, ...]
İhracat kademe: [0-3000:8615TL, 3001-6000:11230TL, ...]
ek_gümrük = 3865 TL (ithalat/ihracat ise)
SONUÇ = (VLOOKUP(cargoQty, kademe) + ek_gümrük) / usdTry

Tekirdağ özel: 7900 / usdTry
Aliağa özel: 214.20 USD (sabit)
```

**K. DEMİRLEME (Anchorage) - USD:**
```
gün = 0 → SONUÇ = 0
gün <= 7 → SONUÇ = GRT * 0.004 * gün
gün > 7  → SONUÇ = (GRT*0.004*7) + (GRT*0.006*(gün-7))
```

**L. DTO ÜCRETİ (Chamber of Shipping Fee) - TL→USD:**
```
GRT kademe (bayrak bazlı):
[0-500: Türk=670TL/Yabancı=1400TL]
[501-1500: 1120/2800]
[1501-2500: 2050/4200]
[2501-5000: 2800/4900]
...
SONUÇ = VLOOKUP(GRT, kademe, bayrak_sütunu) / usdTry
```

**M. DTO HASILAT PAYI (Freight Share) - USD:**
```
Yük kademe: [0-20000:580$, 20001-40000:870$, 40001-60000:1130$, ...]
SONUÇ = VLOOKUP(cargoQty, kademe)
```

**N. VDA ÜCRETİ (Maritime Assoc.) - EUR→USD:**
```
carpan = GRT <= 5000 ? 20 : 40
SONUÇ = carpan * eurTry / usdTry
```

**O. VTS - USD:**
```
NRT < 300 → 0
NRT kademe + bayrak: [300-2000: Yabancı=92.4/Türk=23.1/Kabotaj=8.4, ...]
SONUÇ = VLOOKUP(NRT, kademe, bayrak) * 2
Sadece VTS olan terminallerde (ISS Palm)
```

**P. SÜPERVİZYON - EUR→USD:**
```
SONUÇ = cargoQty * 0.15 * eurUsd
```

**Q. ACENTE ÜCRETİ (Agency Fee) - EUR→USD:**
```
NRT kademe (€ bazlı):
[0-500:600€, 501-1000:1000€, 1001-2000:1500€, 2001-3000:1850€, ...]
10001+ NRT: taban€ + Math.ceil((NRT-kademe_başlangıç)/1000) * ek€
SONUÇ = taban€ * eurUsd

ISS Palm özel: sabit $2400
```

**R. SABİT MASRAFLAR (terminal bazlı):**
```
Motorbot:   $225-500 (terminale göre)
Tesisler:   $550
Ulaşım:     $500
Mali/Noter:  $250
İletişim:    $250
```

---

## 3. TERMİNAL FARKLILIKLARI

### TÜPRAŞ Aliağa: Tüm kalemler aktif, oto servis var
### Tekirdağ Ceyport: Oto servis YOK, gümrük=sabit 7900TL
### ISS Palm İzmir: Pelikan geçişi var, VTS var, acente=$2400 sabit, az kalem
### TCDD İzmir: Barınma farklı hesap (GRT/1000×10×gün)

---

## 4. KULLANICI GİRİŞ FORMU

### ZORUNLU ALANLAR (bunlar olmadan hesaplama yapılamaz):

| # | Alan | Tip | Örnek |
|---|------|-----|-------|
| 1 | **Liman/Terminal** | Dropdown | TÜPRAŞ Aliağa, Ceyport Tekirdağ, ISS Palm İzmir, TCDD İzmir |
| 2 | **Gemi Adı** | Text input | M/T ALSU |
| 3 | **NRT (Net Tonaj)** | Number input | 1004 |
| 4 | **GRT (Gross Tonaj)** | Number input | 2298 |
| 5 | **Bayrak** | Dropdown | TÜRKİYE, MALTA, PANAMA... (seçime göre otomatik TÜRK/YABANCI/KABOTAJ belirle) |
| 6 | **Yük Cinsi** | Dropdown | SFS OIL, Crude Oil, LPG... (seçime göre otomatik tehlikeli yük belirle) |
| 7 | **Yük Miktarı** | Number input (MT) | 3001 |
| 8 | **Geliş Nedeni** | Dropdown | Discharging, Loading, Transit... (gümrük hesabı için kritik) |
| 9 | **Tahmini Barınma** | Number input (gün) | 4 |

### OPSİYONEL ALANLAR (varsayılan değerleri var):

| # | Alan | Varsayılan |
|---|------|-----------|
| 10 | **Demirleme Süresi** | 0 gün |
| 11 | **Tehlikeli Yük** | Yük cinsinden otomatik (override edilebilir) |
| 12 | **Alıcı (TO:)** | Boş |
| 13 | **Referans No** | Otomatik üretilir (YYYY/XXXX) |

### OTOMATİK ALANLAR (kullanıcı girmez):

| Alan | Kaynak |
|------|--------|
| **USD/TRY** | TCMB API veya manuel |
| **EUR/TRY** | TCMB API veya manuel |
| **EUR/USD** | EUR_TRY / USD_TRY |
| **Bayrak Kategorisi** | Bayrak seçiminden (TR→TÜRK, diğer→YABANCI) |
| **Tarih** | Bugün |

### GELİŞMİŞ AYARLAR (toggle ile gizle/göster):
- Fener bayrak tipi (varsayılan: ana bayrak)
- VTS bayrak tipi (varsayılan: ana bayrak)
- DTO bayrak tipi (varsayılan: TÜRK veya YABANCI)
- Barınma bayrak tipi (varsayılan: ana bayrak)
- Döviz kurlarını manuel girme

### FORM UX:
- Formu 4 bölüme ayır: 1)Terminal 2)Gemi 3)Yük 4)Süre
- Her bölüm kart (card) şeklinde
- Altta büyük "PROFORMA HESAPLA" butonu
- Sonuç: Profesyonel tablo (Kalem | USD $ | EUR € | Açıklama)
- Tablonun altında TOPLAM satırı bold
- Export butonları: PDF İndir, Excel İndir

---

## 5. DOĞRULAMA

Bu test verisiyle kontrol et:
- Gemi: M/T ALSU, NRT=1004, GRT=2298, Bayrak=TURK
- Yük: SFS OIL, 3001 ton, Tehlikeli=EVET, İthalat
- Terminal: TUPRAS_ALIAGA, 4 gün barınma, 0 demirleme
- Kur: USD/TRY=43.92, EUR/TRY=51.4158, EUR/USD=1.177285

Beklenen sonuçlar:
- Kılavuzluk: $958.39
- Römorkör: $1369.50
- Barınma: $300.00
- Palamar: $117.42
- Çöp: $164.82
- Fener: $224.03
- Sağlık: $495.37
- Gümrük: $687.96
- DTO: $46.68
- DTO Hasılat: $580.00
- Acente: $1765.93
- Süpervizyon: $529.95
- TOPLAM: ~$9443
