const AIRPORTS: Record<string, string> = {
  ADB: "Izmir", IST: "Istanbul", SAW: "Istanbul SAW", GDN: "Gdansk",
  WAW: "Warsaw", RZE: "Rzeszow", SZZ: "Szczecin", KTW: "Katowice",
  MUC: "Munich", FRA: "Frankfurt", BER: "Berlin", LED: "St Petersburg",
  SVO: "Moscow", AER: "Sochi", LHR: "London", CDG: "Paris",
  AMS: "Amsterdam", DXB: "Dubai", DOH: "Doha", SIN: "Singapore",
  BKK: "Bangkok", MNL: "Manila", HKG: "Hong Kong",
};

function toTitle(s: string): string {
  return s ? s.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase()) : "";
}

export interface ParsedFlight {
  legNo: number;
  flightNo: string;
  date: string;
  fromAirport: string;
  toAirport: string;
  route: string;
  depTime: string;
  arrTime: string;
}

export interface ParsedCrew {
  signerType: "on_signer" | "off_signer";
  rank: string;
  firstName: string;
  lastName: string;
  middleName: string;
  fullName: string;
  dob: string;
  birthPlace: string;
  nationality: string;
  passportNo: string;
  passportIssued: string;
  passportExpiry: string;
  passportPlace: string;
  seamansBookNo: string;
  seamansBookIssued: string;
  seamansBookExpiry: string;
  seamansBookPlace: string;
  employeeNo: string;
  flights: ParsedFlight[];
  firstFlightCode: string;
  lastFlightArrival: string;
  lastArrivalAirport: string;
  warnings: string[];
}

export function parseCrewText(raw: string): ParsedCrew[] {
  const crew: ParsedCrew[] = [];
  let signerType: "on_signer" | "off_signer" = "on_signer";
  const lines = raw.split("\n");
  const blocks: { text: string; st: "on_signer" | "off_signer" }[] = [];
  let cur = "";

  for (const l of lines) {
    if (/on[- ]?signers?\s*(details|info)?/i.test(l)) { signerType = "on_signer"; continue; }
    if (/off[- ]?signers?\s*(details|info)?/i.test(l)) { signerType = "off_signer"; continue; }
    if (/^(Planned\s+)?Rank\s*:/i.test(l.trim()) && cur.trim().length > 10) {
      blocks.push({ text: cur, st: signerType });
      cur = l + "\n";
    } else {
      cur += l + "\n";
    }
  }
  if (cur.trim().length > 10) blocks.push({ text: cur, st: signerType });

  for (const b of blocks.filter((x) => /rank\s*:/i.test(x.text))) {
    const t = b.text;
    const m: ParsedCrew = {
      signerType: b.st, rank: "", firstName: "", lastName: "", middleName: "",
      fullName: "", dob: "", birthPlace: "", nationality: "", passportNo: "",
      passportIssued: "", passportExpiry: "", passportPlace: "", seamansBookNo: "",
      seamansBookIssued: "", seamansBookExpiry: "", seamansBookPlace: "",
      employeeNo: "", flights: [], firstFlightCode: "", lastFlightArrival: "",
      lastArrivalAirport: "", warnings: [],
    };

    const rm = t.match(/(?:Planned\s+)?Rank\s*:\s*(.+?)(?:\n|$)/i);
    if (rm) m.rank = rm[1].trim();

    const nm = t.match(/Full\s*Name\s*:\s*(.+?)(?:\n|$)/i);
    if (nm) {
      m.fullName = nm[1].trim();
      const p = m.fullName.split(",").map((s) => s.trim());
      if (p.length >= 2) {
        m.lastName = toTitle(p[0]);
        const fp = p[1].split(/\s+/);
        m.firstName = toTitle(fp[0]);
        m.middleName = fp.slice(1).map(toTitle).join(" ");
      } else {
        const w = m.fullName.split(/\s+/);
        m.lastName = toTitle(w[0]);
        m.firstName = toTitle(w.slice(1).join(" "));
      }
    }

    const dm = t.match(/DOB\s*(?:&|and)?\s*Place\s*:\s*(.+?)(?:\n|$)/i);
    if (dm) {
      const dp = dm[1].split(/\s*-\s*/);
      m.dob = dp[0]?.trim() || "";
      m.birthPlace = toTitle(dp.slice(1).join(", "));
    }

    const ntm = t.match(/Nationality\s*:\s*(.+?)(?:\n|$)/i);
    if (ntm) m.nationality = ntm[1].trim();

    const pnm = t.match(/Passport\s*No\.?\s*:\s*(\S+)/i);
    if (pnm) m.passportNo = pnm[1].trim();

    const pdm = t.match(/Passport\s*Issued\s*-\s*Valid\s*Until\s*-\s*Place\.?\s*:\s*(.+?)(?:\n|$)/i);
    if (pdm) {
      const p = pdm[1].split(/\s*-\s*/);
      m.passportIssued = p[0]?.trim() || "";
      m.passportExpiry = p[1]?.trim() || "";
      m.passportPlace = toTitle(p.slice(2).join(", "));
    }

    const sbm = t.match(/Seaman\s*Book\s*No\.?\s*:\s*(.+?)(?:\n|$)/i);
    if (sbm) m.seamansBookNo = sbm[1].trim().replace(/\s+/g, "");

    const sdm = t.match(/Seaman\s*Book\s*Issued\s*-\s*Valid\s*Until\s*-\s*Place\s*:\s*(.+?)(?:\n|$)/i);
    if (sdm) {
      const p = sdm[1].split(/\s*-\s*/);
      m.seamansBookIssued = p[0]?.trim() || "";
      m.seamansBookExpiry = p[1]?.trim() || "";
      m.seamansBookPlace = toTitle(p.slice(2).join(", "));
    }

    const em = t.match(/Employee\s*No\.?\s*:\s*(\S+)/i);
    if (em) m.employeeNo = em[1].trim();

    const fls = t.split("\n").filter((l) => /^\s*\d+\.\s/.test(l));
    for (const fl of fls) {
      const fm = fl.match(/(\d+)\.\s*(\S+)\s+(\d{2}[A-Z]{3})\s+(\w{6,7})\s+(\S+)\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})/i);
      if (fm) {
        const from = fm[4].substring(0, 3).toUpperCase();
        const to = fm[4].substring(3, 6).toUpperCase();
        m.flights.push({
          legNo: +fm[1], flightNo: fm[2], date: fm[3],
          fromAirport: from, toAirport: to,
          route: `${from} (${AIRPORTS[from] || from}) → ${to} (${AIRPORTS[to] || to})`,
          depTime: fm[6], arrTime: fm[7],
        });
      }
    }

    if (m.flights.length > 0) {
      m.firstFlightCode = m.flights[0].flightNo;
      const lf = m.flights[m.flights.length - 1];
      m.lastFlightArrival = lf.arrTime;
      m.lastArrivalAirport = lf.toAirport;
    }

    if (!m.passportNo) m.warnings.push("⚠️ Passport missing");
    if (!m.flights.length) m.warnings.push("✈️ No flights detected");
    if (m.nationality?.toLowerCase() === "russian") m.warnings.push("🛂 Russian — check visa");
    if (m.passportExpiry) {
      const d = new Date(m.passportExpiry);
      if (!isNaN(d.getTime())) {
        const ml = (d.getTime() - Date.now()) / (30 * 24 * 3600000);
        if (ml < 0) m.warnings.push("⛔ Passport EXPIRED!");
        else if (ml < 6) m.warnings.push(`⚠️ Passport expires in ${Math.round(ml)}m`);
      }
    }

    if (m.rank || m.fullName) crew.push(m);
  }
  return crew;
}

export function getParseStats(crew: ParsedCrew[]) {
  return {
    total: crew.length,
    onSigners: crew.filter((c) => c.signerType === "on_signer").length,
    offSigners: crew.filter((c) => c.signerType === "off_signer").length,
    withWarnings: crew.filter((c) => c.warnings.length > 0).length,
    nationalities: [...new Set(crew.map((c) => c.nationality).filter(Boolean))],
    totalFlightLegs: crew.reduce((s, c) => s + c.flights.length, 0),
    expiredPassports: crew.filter((c) => c.warnings.some((w) => w.includes("EXPIRED"))).length,
    expiringPassports: crew.filter((c) => c.warnings.some((w) => w.includes("expires in"))).length,
  };
}
