import type { CrewChange, CrewDocConfig } from "@shared/schema";

interface VesselInfo {
  name: string;
  flag: string;
  imoNumber?: string | null;
}

interface DocGeneratorOptions {
  crewChanges: CrewChange[];
  vessel: VesselInfo;
  config: CrewDocConfig | null;
  docDate?: string;
}

function fmtDocDate(dt?: string | Date | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const SELIM_HEADER = `
  <div class="company-header">
    <div class="company-name">S E L İ M</div>
    <div class="company-sub">Denizcilik, Nakliyat, Gemicilik</div>
    <div class="company-sub">Sanayi Ticaret Limited Şirketi</div>
  </div>
`;

const SELIM_FOOTER = `
  <div class="footer">
    1443 Sk. No: 148 Kat: 5 D:503 – 504 Alsancak – İZMİR – TÜRKİYE<br>
    Tel: 0.232. 464 47 11 (PBX) &nbsp; Fax: 0.232 464 18 31 – 464 32 71 &nbsp; Telex: 51133 &nbsp; Tic. Sic. No.: Merkez 89899
  </div>
`;

function personelRow(cc: CrewChange, idx: number): string {
  const dob = fmtDocDate(cc.dateOfBirth);
  const passNo = cc.passportNumber || "";
  const gcNo = cc.seamanBookNumber || "";
  const nat = cc.nationality || "";
  const rank = cc.rank || "";
  return `
    <tr>
      <td class="seq">${idx + 1}.</td>
      <td class="name">${cc.seafarerName}</td>
      <td class="nat">${nat}</td>
      <td class="rank">${rank}</td>
      <td class="dob">${dob}</td>
      <td class="passno">${passNo}</td>
      <td class="gcno">${gcNo}</td>
    </tr>
  `;
}

// ─── Belge 1: Gümrük – Personel Değişikliği ─────────────────────────────────
function doc1_gumruk(opts: DocGeneratorOptions, docDate: string): string {
  const { crewChanges: all, vessel, config } = opts;
  const signOn = all.filter(c => c.changeType === "sign_on");
  const signOff = all.filter(c => c.changeType === "sign_off");
  const port = config?.portName || all[0]?.port || "—";
  const customsAuth = config?.customsAuthority || "ALİAĞA GÜMRÜK MÜDÜRLÜGÜ";
  const customsUnit = config?.customsUnit || "TÜPRAŞ GÜMRÜK MUHAFAZA KISIM AMİRLİĞİ";

  return `
    <div class="doc-page">
      ${SELIM_HEADER}
      <div class="recipient">
        <p>T.C.</p>
        <p>GÜMRÜK VE TİCARET BAKANLIĞI</p>
        <p>EGE GÜMRÜK VE TİCARET BÖLGE MÜDÜRLÜGÜ</p>
        <p>${customsAuth}</p>
        <p>${customsUnit}</p>
      </div>
      <div class="date-right">${docDate}</div>
      <div class="subject">PERSONEL DEĞİŞİKLİĞİ</div>
      <div class="body-text">
        Armatör acenteliğimize bağlı <strong>${vessel.flag}</strong> bayraklı&nbsp;
        <strong>${vessel.imoNumber}</strong> IMO numaralı <strong>${vessel.name}</strong> isimli gemi&nbsp;
        <strong>${port}</strong> limanına yanaşacak olup yanaşmasına müteakip aşağıda bilgileri sunulan
        personeller ayrılacak-katılacaktır. Gerekli müsaadenin verilmesini emir ve müsaadelerinize arz ederiz.
      </div>
      <div class="salutation">Saygılarımızla,</div>

      ${signOn.length > 0 ? `
        <div class="section-title">KATILACAK PERSONELLER;</div>
        <table class="crew-table">
          <thead>
            <tr><th></th><th>Adı Soyadı</th><th>Uyruğu</th><th>Görevi</th><th>Doğum Tarihi</th><th>Pas. No</th><th>G.Cüzdan No</th></tr>
          </thead>
          <tbody>${signOn.map((c, i) => personelRow(c, i)).join("")}</tbody>
        </table>
      ` : ""}

      ${signOff.length > 0 ? `
        <div class="section-title">AYRILACAK PERSONELLER;</div>
        <table class="crew-table">
          <thead>
            <tr><th></th><th>Adı Soyadı</th><th>Uyruğu</th><th>Görevi</th><th>Doğum Tarihi</th><th>Pas. No</th><th>G.Cüzdan No</th></tr>
          </thead>
          <tbody>${signOff.map((c, i) => personelRow(c, i)).join("")}</tbody>
        </table>
      ` : ""}

      ${SELIM_FOOTER}
    </div>
  `;
}

// ─── Belge 2: Polis – Yurttan Çıkış (Katılacak / Sign On) ───────────────────
function doc2_polisYurttan(opts: DocGeneratorOptions, docDate: string): string {
  const { crewChanges: all, vessel, config } = opts;
  const signOn = all.filter(c => c.changeType === "sign_on");
  if (!signOn.length) return "";
  const port = config?.portName || all[0]?.port || "—";
  const policeAuth = config?.policeAuthority || "ALİAĞA DENİZ LİMANI ŞUBE MÜDÜRLÜĞÜ";

  return `
    <div class="doc-page">
      ${SELIM_HEADER}
      <div class="recipient">
        <p>T.C</p>
        <p>İZMİR VALİLİĞİ</p>
        <p>İl Emniyet Müdürlüğü</p>
        <p>${policeAuth}</p>
      </div>
      <div class="date-right">${docDate}</div>
      <div class="body-text" style="margin-top:30px">
        Armatör acenteliğimize bağlı <strong>${vessel.flag}</strong> bayraklı&nbsp;
        <strong>${vessel.imoNumber}</strong> IMO numaralı <strong>${vessel.name}</strong> isimli gemiye&nbsp;
        <strong>${port}</strong> limanında aşağıda ismi yazılı personeller katılacaktır.
        Yurttan çıkış işlemlerinin yapılması hususunda gereğini emir ve müsaadelerinize arz ederiz.
      </div>
      <div class="salutation">Saygılarımızla,</div>
      <div class="section-title">KATILACAK PERSONELLER;</div>
      <table class="crew-table">
        <thead>
          <tr><th></th><th>Adı Soyadı</th><th>Uyruğu</th><th>Görevi</th><th>Doğum Tarihi</th><th>Pas. No</th><th>G.Cüzdan No</th></tr>
        </thead>
        <tbody>${signOn.map((c, i) => personelRow(c, i)).join("")}</tbody>
      </table>
      ${SELIM_FOOTER}
    </div>
  `;
}

// ─── Belge 3: Polis – Yurda Giriş (Ayrılacak / Sign Off) ────────────────────
function doc3_polisYurda(opts: DocGeneratorOptions, docDate: string): string {
  const { crewChanges: all, vessel, config } = opts;
  const signOff = all.filter(c => c.changeType === "sign_off");
  if (!signOff.length) return "";
  const port = config?.portName || all[0]?.port || "—";
  const policeAuth = config?.policeAuthority || "ALİAĞA DENİZ LİMANI ŞUBE MÜDÜRLÜĞÜ";

  return `
    <div class="doc-page">
      ${SELIM_HEADER}
      <div class="recipient">
        <p>T.C</p>
        <p>İZMİR VALİLİĞİ</p>
        <p>İl Emniyet Müdürlüğü</p>
        <p>${policeAuth}</p>
      </div>
      <div class="date-right">${docDate}</div>
      <div class="body-text" style="margin-top:30px">
        Armatör acenteliğimize bağlı <strong>${vessel.flag}</strong> bayraklı&nbsp;
        <strong>${vessel.imoNumber}</strong> IMO numaralı <strong>${vessel.name}</strong> isimli gemiden&nbsp;
        <strong>${port}</strong> limanında aşağıda isimleri yazılı personel ayrılacaktır.
        Yurda giriş işlemlerinin yapılması hususunda gereğini emir ve müsaadelerinize arz ederiz.
      </div>
      <div class="salutation">Saygılarımızla,</div>
      <div class="section-title">AYRILACAK PERSONELLER;</div>
      <table class="crew-table">
        <thead>
          <tr><th></th><th>Adı Soyadı</th><th>Uyruğu</th><th>Görevi</th><th>Doğum Tarihi</th><th>Pas. No</th><th>G.Cüzdan No</th></tr>
        </thead>
        <tbody>${signOff.map((c, i) => personelRow(c, i)).join("")}</tbody>
      </table>
      ${SELIM_FOOTER}
    </div>
  `;
}

// ─── Belge 4: Vize Talep Formu (vizesi olan her personel için) ───────────────
function doc4_vize(cc: CrewChange, vessel: VesselInfo, config: CrewDocConfig | null, docDate: string): string {
  const isSignOff = cc.changeType === "sign_off";

  return `
    <div class="doc-page vize-page">
      <table class="vize-table">
        <tr>
          <td colspan="2" class="vize-title">VİZEYE TABİ DENİZCİLER İÇİN VİZE TALEP FORM</td>
          <td colspan="2" class="vize-official">RESMİ KULLANIM İÇİN</td>
        </tr>
        <tr>
          <td colspan="2">DÜZENLEYEN : SELİM DENİZCİLİK</td>
          <td colspan="2">ALICI : T.C. İZMİR İL VALİLİĞİ<br>İL EMNİYET MÜDÜRLÜĞÜ<br>${config?.policeAuthority || "ALİAĞA DENİZ LİMANI ŞUBE MÜDÜRLÜĞÜ"}</td>
        </tr>
        <tr>
          <td colspan="4">YETKİLİNİN ADI SOYADI / KODU : MURAT ÖZVEREN</td>
        </tr>
        <tr>
          <td colspan="4" class="section-header">DENİZCİ HAKKINDA BİLGİ</td>
        </tr>
        <tr>
          <td>BİREY ✓</td>
          <td>GRUP LİDERİ</td>
          <td colspan="2">KAPALI GRUP</td>
        </tr>
        <tr>
          <td>1A. SOYAD (LAR)</td>
          <td>${cc.seafarerName.split(" ").slice(1).join(" ") || cc.seafarerName}</td>
          <td>1B. İLK İSİM(LER)</td>
          <td>${cc.seafarerName.split(" ")[0]}</td>
        </tr>
        <tr>
          <td>1C. UYRUK</td>
          <td>${cc.nationality || ""}</td>
          <td>1D. RÜTBE / DERECE</td>
          <td>${cc.rank || ""}</td>
        </tr>
        <tr>
          <td>2A. DOĞUM YERİ</td>
          <td>${cc.birthPlace || ""}</td>
          <td>2B. DOĞUM TARİHİ</td>
          <td>${fmtDocDate(cc.dateOfBirth)}</td>
        </tr>
        <tr>
          <td>3A. PASAPORT NUMARASI</td>
          <td>${cc.passportNumber || ""}</td>
          <td>4A. DENİZCİ CÜZDANI NUMARASI</td>
          <td>${cc.seamanBookNumber || ""}</td>
        </tr>
        <tr>
          <td>3B. VERİLİŞ TARİHİ</td>
          <td>${fmtDocDate(cc.passportIssueDate)}</td>
          <td>4B. VERİLİŞ TARİHİ</td>
          <td>${fmtDocDate(cc.seamanBookIssueDate)}</td>
        </tr>
        <tr>
          <td>3C. GEÇERLİLİK SÜRESİ</td>
          <td>${fmtDocDate(cc.passportExpiry)}</td>
          <td>4C. GEÇERLİLİK SÜRESİ</td>
          <td>${fmtDocDate(cc.seamanBookExpiry)}</td>
        </tr>
        <tr>
          <td colspan="4" class="section-header">GEMİ VE DENİZCİLİK ACENTASI İLE İLGİLİ BİLGİ</td>
        </tr>
        <tr>
          <td>5. DENİZCİLİK ACENTASININ ADI</td>
          <td colspan="3">SELİM DENİZCİLİK NAK. GEM. TİC. LTD. ŞTİ.</td>
        </tr>
        <tr>
          <td>6A. GEMİNİN ADI</td>
          <td>${vessel.name}</td>
          <td>6B. BANDIRASI</td>
          <td>${vessel.flag}</td>
        </tr>
        <tr>
          <td>7A. GELİŞ TARİHİ</td>
          <td>${isSignOff ? fmtDocDate(cc.departureDate) : ""}</td>
          <td>7B. GEMİNİN MENŞEİ</td>
          <td>${vessel.flag}</td>
        </tr>
        <tr>
          <td>8A. AYRILIŞ TARİHİ</td>
          <td>${isSignOff ? fmtDocDate(cc.departureDate) : fmtDocDate(cc.arrivalDate)}</td>
          <td>8B. GEMİNİN GİDECEĞİ YER</td>
          <td>-</td>
        </tr>
        <tr>
          <td colspan="4" class="section-header">DENİZCİNİN DOLAŞIMI İLE İLGİLİ BİLGİ</td>
        </tr>
        <tr>
          <td colspan="4">9. DENİZCİNİN SON VARIŞ NOKTASI : ${config?.portName || "ALİAĞA / İZMİR / TÜRKİYE"}</td>
        </tr>
        <tr>
          <td colspan="4">10. BAŞVURU NEDENLERİ &nbsp;&nbsp; ${cc.changeType === "sign_on" ? "İŞE (GEMİYE) GİRİŞ ✓" : "İŞTEN (GEMİDEN) AYRILMA ✓"}</td>
        </tr>
        <tr>
          <td colspan="2">11. YOLCULUK VASITASI &nbsp; UÇAK ✓</td>
          <td colspan="2">12. TARİH : ${docDate}</td>
        </tr>
        <tr>
          <td colspan="4" class="flight-info">
            YOLCULUK GÜZERGAHI:<br>
            ${cc.flightDetails ? cc.flightDetails.replace(/\n/g, "<br>") : ""}
          </td>
        </tr>
        <tr>
          <td colspan="4" class="declaration-text">
            13. Denizcilik acentası ya da gemi sahibi tarafından denizcinin ikamet sorumluluğu ve
            denizcinin eve dönüş masrafları adına imzalanmış resmi deklarasyon.
          </td>
        </tr>
      </table>
      <div class="footer" style="margin-top:10px">
        1443 Sk. No: 148 Kat: 5 D:503 – 504 Alsancak – İZMİR – TÜRKİYE &nbsp;
        Tel: 0.232. 464 47 11 (PBX) &nbsp; Fax: 0.232 464 18 31 – 464 32 71
      </div>
    </div>
  `;
}

// ─── Belge 5: Acente Personeli Liman Geçici Giriş Çıkış İzni ────────────────
function doc5_acente(opts: DocGeneratorOptions, docDate: string): string {
  const { vessel, config } = opts;
  const port = config?.portName || "—";
  const personnel = config?.agentPersonnel || [];
  const vehicles = config?.agentVehicles || [];

  return `
    <div class="doc-page">
      ${SELIM_HEADER}
      <div class="recipient">
        <p>T.C.GÜMRÜK VE TİCARET BAKANLIĞI</p>
        <p>EGE GÜMRÜK VE TİCARET BÖLGE MÜDÜRLÜGÜ</p>
        <p>${config?.customsAuthority || "ALİAĞA GÜMRÜK MÜDÜRLÜGÜ"}</p>
        <p>İSKELELER GÜMRÜK MUHAFAZA KISIM AMİRLİĞİ</p>
      </div>
      <div class="date-right">${docDate}</div>
      <div class="subject">ACENTE PERSONELİ LİMAN GEÇİCİ GİRİŞ ÇIKIŞ İZNİ</div>
      <div class="body-text">
        Armatör acenteliğimize bağlı <strong>${vessel.flag}</strong> bayraklı&nbsp;
        <strong>${vessel.imoNumber}</strong> IMO numaralı <strong>${vessel.name}</strong> isimli gemi&nbsp;
        <strong>${port}</strong> limanına yanaşacak olup acentelik işlemlerimiz ile ilgili gerekli işlemlerin
        yapılabilmesi için geçici giriş çıkış izni verilmesi hususunda emir ve müsaadelerinizi arz ederiz.
      </div>
      <div class="salutation">Saygılarımızla,</div>

      ${personnel.map(p => `
        <div class="agent-person">
          <div><strong>ADI SOYADI</strong> : ${p.name}</div>
          <div><strong>T.C. NO</strong> : ${p.tcId}</div>
          ${p.birthPlace ? `<div><strong>DOĞUM YERİ</strong> : ${p.birthPlace}</div>` : ""}
          ${p.birthDate ? `<div><strong>DOĞUM YILI</strong> : ${p.birthDate}</div>` : ""}
        </div>
      `).join("")}

      ${vehicles.length > 0 ? `
        <div class="section-title">ARAÇ PLAKALARI:</div>
        <div class="vehicle-list">
          ${vehicles.map(v => `<div>${v.plate}${v.model ? ` &nbsp; ${v.model}` : ""}</div>`).join("")}
        </div>
      ` : ""}

      ${SELIM_FOOTER}
    </div>
  `;
}

// ─── Belge 6: Ekim Tur Giriş İzni ────────────────────────────────────────────
function doc6_ekimTur(opts: DocGeneratorOptions, docDate: string): string {
  const { vessel, config } = opts;
  const port = config?.portName || "—";
  const personnel = config?.ekimTurPersonnel || [];
  const vehicles = config?.ekimTurVehicles || [];

  return `
    <div class="doc-page">
      ${SELIM_HEADER}
      <div class="recipient">
        <p>T.C.GÜMRÜK VE TİCARET BAKANLIĞI</p>
        <p>EGE GÜMRÜK VE TİCARET BÖLGE MÜDÜRLÜGÜ</p>
        <p>${config?.customsAuthority || "ALİAĞA GÜMRÜK MÜDÜRLÜGÜ"}</p>
        <p>İSKELELER GÜMRÜK MUHAFAZA KISIM AMİRLİĞİ</p>
      </div>
      <div class="date-right">${docDate}</div>
      <div class="body-text" style="margin-top:30px">
        Armatör acenteliğimize bağlı <strong>${vessel.flag}</strong> bayraklı&nbsp;
        <strong>${vessel.imoNumber}</strong> IMO numaralı <strong>${vessel.name}</strong> isimli gemi&nbsp;
        <strong>${port}</strong> limanına yanaşmasına müteakip personel değişikliği yapılacak olup
        personelin gemiden transferi EKİM TUR şirketi tarafından yapılacaktır. Limana giriş-çıkış
        yapacak personel ve araç bilgileri aşağıda tarafınıza sunulmuştur, gerekli izinlerin verilmesini
        arz ederiz.
      </div>
      <div class="salutation">Saygılarımızla,</div>

      ${personnel.length > 0 ? `
        <div class="section-title">EKİM TUR PERSONELİ ADI-SOYADI / TC NO</div>
        ${personnel.map(p => `<div class="ekim-person">${p.name} &nbsp; - &nbsp; ${p.tcId}</div>`).join("")}
      ` : ""}

      ${vehicles.length > 0 ? `
        <div class="section-title" style="margin-top:15px">ARAÇ PLAKALARI</div>
        ${vehicles.map(v => `<div class="vehicle-item">${v}</div>`).join("")}
      ` : ""}

      ${SELIM_FOOTER}
    </div>
  `;
}

// ─── Ana Belge Üretici ────────────────────────────────────────────────────────
const DOC_STYLES = `
  <style>
    @page { size: A4; margin: 20mm 20mm 15mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; }
    .doc-page { page-break-after: always; min-height: 240mm; display: flex; flex-direction: column; }
    .doc-page:last-child { page-break-after: auto; }
    .company-header { text-align: center; margin-bottom: 20px; }
    .company-name { font-size: 16pt; font-weight: bold; letter-spacing: 4px; }
    .company-sub { font-size: 10pt; }
    .recipient { margin: 10px 0 5px 0; font-size: 10.5pt; font-weight: bold; text-align: center; }
    .recipient p { margin: 2px 0; }
    .date-right { text-align: right; font-size: 10.5pt; margin: 5px 0; }
    .subject { text-align: center; font-size: 12pt; font-weight: bold; text-decoration: underline; margin: 15px 0; }
    .body-text { font-size: 10.5pt; line-height: 1.6; text-align: justify; margin: 10px 0; }
    .salutation { text-align: center; margin: 15px 0 10px 0; font-size: 10.5pt; }
    .section-title { font-size: 10.5pt; font-weight: bold; margin: 12px 0 6px 0; }
    .crew-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 5px; }
    .crew-table th { border: 1px solid #000; padding: 3px 5px; background: #f5f5f5; font-weight: bold; text-align: left; font-size: 9pt; }
    .crew-table td { border: 1px solid #000; padding: 3px 5px; }
    .crew-table td.seq { width: 25px; }
    .crew-table td.name { font-weight: bold; }
    .agent-person { margin: 8px 0; font-size: 10.5pt; }
    .agent-person div { margin: 2px 0; }
    .vehicle-list { font-size: 10.5pt; margin-left: 10px; }
    .vehicle-list div { margin: 2px 0; }
    .ekim-person { font-size: 10.5pt; font-weight: bold; margin: 4px 0 4px 30px; }
    .vehicle-item { font-size: 10.5pt; margin: 2px 0 2px 30px; }
    .footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #000; font-size: 8.5pt; text-align: center; }
    .vize-page { font-family: Arial, sans-serif; }
    .vize-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .vize-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
    .vize-title { font-weight: bold; font-size: 10pt; text-align: center; background: #eee; }
    .vize-official { text-align: center; background: #eee; }
    .section-header { background: #ddd; font-weight: bold; text-align: center; }
    .flight-info { font-size: 9pt; }
    .declaration-text { font-size: 8.5pt; font-style: italic; }
    .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #003366; color: white; border: none; cursor: pointer; font-size: 14px; border-radius: 4px; z-index: 9999; }
    @media print { .print-btn { display: none !important; } }
  </style>
`;

export interface DocSelection {
  gumruk: boolean;
  polisYurttan: boolean;
  polisYurda: boolean;
  vize: boolean;
  acente: boolean;
  ekimTur: boolean;
}

export function generateAndPrintCrewDocs(
  opts: DocGeneratorOptions,
  selection: DocSelection,
  docDate: string
): void {
  const pages: string[] = [];

  if (selection.gumruk) {
    pages.push(doc1_gumruk(opts, docDate));
  }
  if (selection.polisYurttan) {
    const doc = doc2_polisYurttan(opts, docDate);
    if (doc) pages.push(doc);
  }
  if (selection.polisYurda) {
    const doc = doc3_polisYurda(opts, docDate);
    if (doc) pages.push(doc);
  }
  if (selection.vize) {
    const visaCrewMembers = opts.crewChanges.filter(c => c.visaRequired);
    for (const cc of visaCrewMembers) {
      pages.push(doc4_vize(cc, opts.vessel, opts.config, docDate));
    }
  }
  if (selection.acente) {
    pages.push(doc5_acente(opts, docDate));
  }
  if (selection.ekimTur) {
    pages.push(doc6_ekimTur(opts, docDate));
  }

  if (!pages.length) return;

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Personel Değişikliği Belgeleri — ${opts.vessel.name}</title>
      ${DOC_STYLES}
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">🖨 Yazdır / PDF Kaydet</button>
      ${pages.join("\n")}
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
