import { db } from "./db";
import { documentTemplates } from "@shared/schema";
import { count } from "drizzle-orm";

const BUILT_IN_TEMPLATES = [
  {
    name: "SOF (Statement of Facts)",
    category: "SOF",
    content: `<h2 style="text-align:center;font-family:serif;">STATEMENT OF FACTS</h2>
<p><strong>Vessel:</strong> {{vesselName}} &nbsp;&nbsp; <strong>IMO:</strong> {{imoNumber}}</p>
<p><strong>Port:</strong> {{port}} &nbsp;&nbsp; <strong>Purpose of Call:</strong> {{purposeOfCall}}</p>
<p><strong>Date:</strong> {{date}}</p>
<hr/>
<table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:monospace;font-size:12px;">
  <thead style="background:#003D7A;color:white;">
    <tr>
      <th>Date</th><th>Time</th><th>Event</th><th>Remarks</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>{{date}}</td><td></td><td>Vessel arrived at pilot station</td><td></td></tr>
    <tr><td></td><td></td><td>Pilot boarded</td><td></td></tr>
    <tr><td></td><td></td><td>Vessel berthed at ___</td><td></td></tr>
    <tr><td></td><td></td><td>All fast / gangway rigged</td><td></td></tr>
    <tr><td></td><td></td><td>NOR tendered</td><td></td></tr>
    <tr><td></td><td></td><td>NOR accepted</td><td></td></tr>
    <tr><td></td><td></td><td>Commenced {{purposeOfCall}}</td><td></td></tr>
    <tr><td></td><td></td><td>Completed {{purposeOfCall}}</td><td></td></tr>
    <tr><td></td><td></td><td>Pilot boarded for departure</td><td></td></tr>
    <tr><td></td><td></td><td>Last line / Vessel departed</td><td></td></tr>
  </tbody>
</table>
<br/>
<p><strong>GRT:</strong> {{grt}} &nbsp;&nbsp; <strong>ETA:</strong> {{eta}} &nbsp;&nbsp; <strong>ETD:</strong> {{etd}}</p>
<br/>
<p>Signed by Ship's Master: _________________________</p>
<p>Signed by Ship's Agent: _________________________</p>
<p>Date &amp; Stamp: _________________________</p>`,
    isBuiltIn: true,
  },
  {
    name: "NOR (Notice of Readiness)",
    category: "NOR",
    content: `<h2 style="text-align:center;font-family:serif;">NOTICE OF READINESS</h2>
<p style="text-align:right;"><strong>Date:</strong> {{date}}</p>
<p><strong>To:</strong> Port Agent / Terminal Operator<br/><strong>Port:</strong> {{port}}</p>
<hr/>
<p>Dear Sir/Madam,</p>
<p>We hereby give you notice that the vessel <strong>{{vesselName}}</strong> (IMO: <strong>{{imoNumber}}</strong>, GRT: <strong>{{grt}}</strong> tons) has arrived at the port of <strong>{{port}}</strong> and is now in all respects ready to:</p>
<ul>
  <li>Commence <strong>{{purposeOfCall}}</strong> of cargo</li>
</ul>
<p>The vessel arrived at: _________________________ hours on {{date}}</p>
<p>This NOR is tendered at: _________________________ hours on {{date}}</p>
<p>The vessel is berthed / anchored at: _________________________</p>
<p>Laytime to commence as per charter party terms.</p>
<br/>
<p>Yours faithfully,</p>
<br/>
<p>Master: _________________________</p>
<p>Agent: _________________________</p>
<p>Stamp: _________________________</p>`,
    isBuiltIn: true,
  },
  {
    name: "Protest Letter",
    category: "Protest",
    content: `<h2 style="text-align:center;font-family:serif;">LETTER OF PROTEST</h2>
<p style="text-align:right;"><strong>Date:</strong> {{date}}</p>
<p><strong>To:</strong> Terminal Operator / Port Authority<br/><strong>Port:</strong> {{port}}</p>
<hr/>
<p>Dear Sir/Madam,</p>
<p>We, the undersigned Master and Agent of the vessel <strong>{{vesselName}}</strong> (IMO: <strong>{{imoNumber}}</strong>), hereby formally protest against:</p>
<p style="margin-left:20px;font-style:italic;">[Describe the issue: damage, delay, contamination, quantity discrepancy, unsafe berth conditions, etc.]</p>
<p>This incident occurred on <strong>{{date}}</strong> at the port of <strong>{{port}}</strong> during the <strong>{{purposeOfCall}}</strong> operation.</p>
<p>We reserve all rights to claim compensation for any loss, damage, or additional costs incurred as a result of the above.</p>
<p>We hold you responsible for all consequences arising from the above and reserve the right to present a formal claim.</p>
<br/>
<p>This letter is presented under protest and without prejudice to any rights and claims we may have.</p>
<br/>
<p>Master: _________________________</p>
<p>Agent: _________________________</p>
<p>Witness: _________________________</p>
<p>Date &amp; Stamp: _________________________</p>`,
    isBuiltIn: true,
  },
  {
    name: "Proforma DA (Tahmini Masraflar)",
    category: "DA",
    content: `<h2 style="text-align:center;font-family:serif;">PROFORMA DISBURSEMENT ACCOUNT</h2>
<p><strong>Vessel:</strong> {{vesselName}} &nbsp;&nbsp; <strong>IMO:</strong> {{imoNumber}}</p>
<p><strong>Port:</strong> {{port}} &nbsp;&nbsp; <strong>Purpose:</strong> {{purposeOfCall}}</p>
<p><strong>ETA:</strong> {{eta}} &nbsp;&nbsp; <strong>ETD:</strong> {{etd}} &nbsp;&nbsp; <strong>Date:</strong> {{date}}</p>
<p><strong>GRT:</strong> {{grt}}</p>
<hr/>
<table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:12px;">
  <thead style="background:#003D7A;color:white;">
    <tr><th>#</th><th>Description</th><th>Currency</th><th>Amount</th><th>Remarks</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Port Dues / Rıhtım Harcı</td><td>USD</td><td></td><td></td></tr>
    <tr><td>2</td><td>Pilotage (In)</td><td>USD</td><td></td><td></td></tr>
    <tr><td>3</td><td>Pilotage (Out)</td><td>USD</td><td></td><td></td></tr>
    <tr><td>4</td><td>Towage (In)</td><td>USD</td><td></td><td></td></tr>
    <tr><td>5</td><td>Towage (Out)</td><td>USD</td><td></td><td></td></tr>
    <tr><td>6</td><td>Mooring / Bağlama</td><td>USD</td><td></td><td></td></tr>
    <tr><td>7</td><td>Wharfage</td><td>USD</td><td></td><td></td></tr>
    <tr><td>8</td><td>Agency Fee</td><td>USD</td><td></td><td></td></tr>
    <tr><td>9</td><td>Documentation</td><td>USD</td><td></td><td></td></tr>
    <tr><td>10</td><td>Miscellaneous</td><td>USD</td><td></td><td></td></tr>
    <tr style="font-weight:bold;background:#f0f4ff;"><td colspan="3"><strong>TOTAL ESTIMATED</strong></td><td></td><td></td></tr>
  </tbody>
</table>
<br/>
<p><em>Note: This is a proforma estimate. Final amounts may vary based on actual port operations.</em></p>
<p>Agent: _________________________</p>
<p>Date: {{date}}</p>`,
    isBuiltIn: true,
  },
  {
    name: "Sea Protest (Deniz Protestosu)",
    category: "SeaProtest",
    content: `<h2 style="text-align:center;font-family:serif;">NOTE OF SEA PROTEST</h2>
<p style="text-align:center;">Before the undersigned Notary Public / Harbour Master</p>
<p style="text-align:right;"><strong>Date:</strong> {{date}}</p>
<hr/>
<p>On this day appeared before me:</p>
<p><strong>Master:</strong> _________________________ of the vessel <strong>{{vesselName}}</strong></p>
<p><strong>IMO Number:</strong> {{imoNumber}} &nbsp;&nbsp; <strong>GRT:</strong> {{grt}}</p>
<p><strong>Flag:</strong> _________________________ &nbsp;&nbsp; <strong>Class:</strong> _________________________</p>
<p>Who stated and declared that the above vessel departed from _________________________ on _________________________ bound for <strong>{{port}}</strong>.</p>
<p>During the voyage, the vessel encountered the following adverse weather / circumstances:</p>
<p style="margin-left:20px;font-style:italic;">[Describe weather conditions, sea state, incidents, dates and positions]</p>
<p>As a result of the above conditions, the Master hereby formally protests against all losses, damages, delays and consequences that may have occurred to the vessel, cargo, crew, and third parties.</p>
<p>The Master reserves the right to extend this protest upon full investigation.</p>
<br/>
<p>Sworn before me this day of {{date}} at {{port}}</p>
<br/>
<p>Master's Signature: _________________________</p>
<p>Notary / Harbour Master: _________________________</p>
<p>Official Stamp: _________________________</p>`,
    isBuiltIn: true,
  },
];

export async function seedDocumentTemplates() {
  const [{ value: cnt }] = await db.select({ value: count() }).from(documentTemplates);
  if (Number(cnt) > 0) return;
  await db.insert(documentTemplates).values(BUILT_IN_TEMPLATES);
  console.log(`[seed] Inserted ${BUILT_IN_TEMPLATES.length} document templates`);
}
