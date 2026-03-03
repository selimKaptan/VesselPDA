import { pool } from "./db";

export async function ensureMaritimeDocsSchema() {
  console.log("[maritime-docs] Ensuring schema...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maritime_doc_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL DEFAULT 'cargo',
        description TEXT,
        fields JSONB NOT NULL DEFAULT '[]',
        is_built_in BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS maritime_documents (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES maritime_doc_templates(id),
        voyage_id INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
        port_call_id INTEGER REFERENCES voyage_port_calls(id) ON DELETE SET NULL,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        document_number TEXT,
        data JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        reviewed_by_user_id VARCHAR REFERENCES users(id),
        reviewed_at TIMESTAMPTZ,
        signed_by_user_id VARCHAR REFERENCES users(id),
        signed_at TIMESTAMPTZ,
        signature_text TEXT,
        pdf_file_url TEXT,
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        parent_id INTEGER REFERENCES maritime_documents(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: existing } = await pool.query(`SELECT id FROM maritime_doc_templates LIMIT 1`);
    if (existing.length === 0) {
      await seedTemplates();
    }

    console.log("[maritime-docs] ✓ Schema ready.");
  } catch (err) {
    console.error("[maritime-docs] Schema error:", err);
  }
}

async function seedTemplates() {
  const templates = [
    {
      name: "Bill of Lading",
      code: "BL",
      category: "cargo",
      description: "Negotiable document of title for cargo transport",
      fields: [
        { fieldName: "shipper", fieldType: "text", label: "Shipper", required: true, defaultValue: "" },
        { fieldName: "consignee", fieldType: "text", label: "Consignee", required: true, defaultValue: "" },
        { fieldName: "notifyParty", fieldType: "text", label: "Notify Party", required: false, defaultValue: "" },
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "voyageNo", fieldType: "text", label: "Voyage No", required: true, defaultValue: "", autoFill: "voyageId" },
        { fieldName: "portOfLoading", fieldType: "text", label: "Port of Loading", required: true, defaultValue: "", autoFill: "loadPort" },
        { fieldName: "portOfDischarge", fieldType: "text", label: "Port of Discharge", required: true, defaultValue: "", autoFill: "dischargePort" },
        { fieldName: "cargoDescription", fieldType: "textarea", label: "Cargo Description", required: true, defaultValue: "" },
        { fieldName: "grossWeight", fieldType: "number", label: "Gross Weight (MT)", required: true, defaultValue: "" },
        { fieldName: "measurement", fieldType: "text", label: "Measurement (CBM)", required: false, defaultValue: "" },
        { fieldName: "marksAndNumbers", fieldType: "textarea", label: "Marks & Numbers", required: false, defaultValue: "" },
        { fieldName: "freightDetails", fieldType: "textarea", label: "Freight Details", required: false, defaultValue: "Freight Prepaid" },
        { fieldName: "numberOfOriginals", fieldType: "select", label: "Number of Originals", required: true, defaultValue: "3", options: ["1", "2", "3"] },
        { fieldName: "placeOfIssue", fieldType: "text", label: "Place of Issue", required: true, defaultValue: "", autoFill: "loadPort" },
        { fieldName: "dateOfIssue", fieldType: "date", label: "Date of Issue", required: true, defaultValue: "" },
      ],
    },
    {
      name: "Cargo Manifest",
      code: "MANIFEST",
      category: "cargo",
      description: "Complete list of a ship's cargo",
      fields: [
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "voyageNo", fieldType: "text", label: "Voyage No", required: true, defaultValue: "", autoFill: "voyageId" },
        { fieldName: "portOfLoading", fieldType: "text", label: "Port of Loading", required: true, defaultValue: "", autoFill: "loadPort" },
        { fieldName: "portOfDischarge", fieldType: "text", label: "Port of Discharge", required: true, defaultValue: "", autoFill: "dischargePort" },
        { fieldName: "blNumber", fieldType: "text", label: "B/L Number", required: false, defaultValue: "" },
        { fieldName: "shipper", fieldType: "text", label: "Shipper", required: true, defaultValue: "" },
        { fieldName: "consignee", fieldType: "text", label: "Consignee", required: true, defaultValue: "" },
        { fieldName: "cargoDescription", fieldType: "textarea", label: "Cargo Description", required: true, defaultValue: "" },
        { fieldName: "packages", fieldType: "text", label: "Number of Packages", required: false, defaultValue: "" },
        { fieldName: "grossWeight", fieldType: "number", label: "Gross Weight (MT)", required: true, defaultValue: "" },
        { fieldName: "measurement", fieldType: "text", label: "Measurement (CBM)", required: false, defaultValue: "" },
        { fieldName: "hsCode", fieldType: "text", label: "HS Code", required: false, defaultValue: "" },
      ],
    },
    {
      name: "Mate's Receipt",
      code: "MATES_RECEIPT",
      category: "cargo",
      description: "Receipt issued by mate acknowledging cargo aboard",
      fields: [
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "date", fieldType: "date", label: "Date", required: true, defaultValue: "" },
        { fieldName: "shipper", fieldType: "text", label: "Shipper", required: true, defaultValue: "" },
        { fieldName: "cargoDescription", fieldType: "textarea", label: "Cargo Description", required: true, defaultValue: "" },
        { fieldName: "quantity", fieldType: "text", label: "Quantity", required: true, defaultValue: "" },
        { fieldName: "condition", fieldType: "textarea", label: "Condition of Cargo", required: false, defaultValue: "Apparent good order and condition" },
        { fieldName: "remarks", fieldType: "textarea", label: "Remarks", required: false, defaultValue: "" },
        { fieldName: "receivedBy", fieldType: "text", label: "Received By (Chief Officer)", required: true, defaultValue: "" },
      ],
    },
    {
      name: "Crew List",
      code: "CREW_LIST",
      category: "crew",
      description: "Official list of crew members aboard the vessel",
      fields: [
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "flag", fieldType: "text", label: "Flag", required: true, defaultValue: "" },
        { fieldName: "imoNumber", fieldType: "text", label: "IMO Number", required: false, defaultValue: "", autoFill: "imoNumber" },
        { fieldName: "port", fieldType: "text", label: "Port", required: true, defaultValue: "", autoFill: "loadPort" },
        { fieldName: "date", fieldType: "date", label: "Date", required: true, defaultValue: "" },
        { fieldName: "crewMembers", fieldType: "table", label: "Crew Members", required: true, defaultValue: "",
          tableColumns: [
            { key: "name", label: "Full Name" },
            { key: "rank", label: "Rank" },
            { key: "nationality", label: "Nationality" },
            { key: "birthDate", label: "Date of Birth" },
            { key: "passportNo", label: "Passport No" },
            { key: "seamansBookNo", label: "Seaman's Book No" },
          ]
        },
      ],
    },
    {
      name: "Customs Declaration",
      code: "CUSTOMS_DEC",
      category: "customs",
      description: "General declaration for customs authorities",
      fields: [
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "flag", fieldType: "text", label: "Flag", required: true, defaultValue: "" },
        { fieldName: "lastPort", fieldType: "text", label: "Last Port of Call", required: true, defaultValue: "" },
        { fieldName: "nextPort", fieldType: "text", label: "Next Port of Call", required: true, defaultValue: "" },
        { fieldName: "cargoOnBoard", fieldType: "textarea", label: "Cargo on Board", required: false, defaultValue: "" },
        { fieldName: "crewNumber", fieldType: "number", label: "Number of Crew", required: true, defaultValue: "" },
        { fieldName: "passengerNumber", fieldType: "number", label: "Number of Passengers", required: false, defaultValue: "0" },
        { fieldName: "stores", fieldType: "textarea", label: "Ship's Stores", required: false, defaultValue: "" },
        { fieldName: "dunnage", fieldType: "textarea", label: "Dunnage/Packing Material", required: false, defaultValue: "None" },
        { fieldName: "personalEffects", fieldType: "textarea", label: "Personal Effects", required: false, defaultValue: "As per attached list" },
      ],
    },
    {
      name: "Port Clearance",
      code: "PORT_CLEARANCE",
      category: "port",
      description: "Document authorizing vessel departure from port",
      fields: [
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "flag", fieldType: "text", label: "Flag", required: true, defaultValue: "" },
        { fieldName: "gt", fieldType: "number", label: "Gross Tonnage", required: true, defaultValue: "" },
        { fieldName: "nt", fieldType: "number", label: "Net Tonnage", required: false, defaultValue: "" },
        { fieldName: "master", fieldType: "text", label: "Master's Name", required: true, defaultValue: "" },
        { fieldName: "nextPort", fieldType: "text", label: "Next Port of Call", required: true, defaultValue: "", autoFill: "dischargePort" },
        { fieldName: "crewNumber", fieldType: "number", label: "Number of Crew", required: true, defaultValue: "" },
        { fieldName: "departureDate", fieldType: "date", label: "Date of Departure", required: true, defaultValue: "" },
      ],
    },
    {
      name: "Damage Report",
      code: "DAMAGE_REPORT",
      category: "safety",
      description: "Report documenting cargo or vessel damage",
      fields: [
        { fieldName: "vesselName", fieldType: "text", label: "Vessel Name", required: true, defaultValue: "", autoFill: "vesselName" },
        { fieldName: "date", fieldType: "date", label: "Date of Damage", required: true, defaultValue: "" },
        { fieldName: "location", fieldType: "text", label: "Location / Port", required: true, defaultValue: "" },
        { fieldName: "cargoAffected", fieldType: "text", label: "Cargo Affected", required: false, defaultValue: "" },
        { fieldName: "damageDescription", fieldType: "textarea", label: "Description of Damage", required: true, defaultValue: "" },
        { fieldName: "estimatedLoss", fieldType: "text", label: "Estimated Loss (USD)", required: false, defaultValue: "" },
        { fieldName: "surveyorName", fieldType: "text", label: "Surveyor Name", required: false, defaultValue: "" },
        { fieldName: "surveyorCompany", fieldType: "text", label: "Surveyor Company", required: false, defaultValue: "" },
        { fieldName: "photos", fieldType: "textarea", label: "Photos / Evidence Reference", required: false, defaultValue: "" },
        { fieldName: "remarks", fieldType: "textarea", label: "Additional Remarks", required: false, defaultValue: "" },
      ],
    },
  ];

  for (const t of templates) {
    await pool.query(
      `INSERT INTO maritime_doc_templates (name, code, category, description, fields, is_built_in)
       VALUES ($1, $2, $3, $4, $5::jsonb, TRUE)
       ON CONFLICT (code) DO NOTHING`,
      [t.name, t.code, t.category, t.description, JSON.stringify(t.fields)]
    );
  }
  console.log("[maritime-docs] Seeded 7 built-in templates.");
}
