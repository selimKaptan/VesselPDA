import { pool } from "./db";

const ISM_ITEMS = [
  { sn: "1.1", title: "General – Definitions", req: "Verify that the SMS documentation contains clear definitions for all key terms as required by ISM Code Chapter 1." },
  { sn: "1.2", title: "General – Objectives", req: "Confirm the company has documented safety and environmental protection objectives as per ISM Code 1.2." },
  { sn: "1.3", title: "General – Application", req: "Verify the SMS applies to all vessels operated by the company as required." },
  { sn: "1.4", title: "General – Functional Requirements", req: "Confirm the SMS addresses all functional requirements: safety policy, instructions, procedures, authority levels, communication, reporting, emergency preparedness, drills, and audits." },
  { sn: "2.1", title: "Safety & Environmental Policy – Policy Statement", req: "A written safety and environmental protection policy exists, is signed by the DPA/CEO and posted on board." },
  { sn: "2.2", title: "Safety & Environmental Policy – Objectives", req: "Measurable safety and environmental objectives are established and reviewed annually." },
  { sn: "2.3", title: "Safety & Environmental Policy – Communication", req: "Policy is communicated to all levels of the company and ship personnel." },
  { sn: "3.1", title: "Company Responsibilities – Designated Person", req: "Designated Person Ashore (DPA) is formally appointed and has direct access to the highest level of management." },
  { sn: "3.2", title: "Company Responsibilities – Resources", req: "Adequate resources are provided including qualified and certified personnel, financial and technical support." },
  { sn: "3.3", title: "Company Responsibilities – Ship Inspection", req: "Company conducts periodic visits to ships at appropriate intervals." },
  { sn: "4.1", title: "Designated Person(s) – Role & Authority", req: "DPA job description is documented; DPA has authority to stop operations and report to top management." },
  { sn: "4.2", title: "Designated Person(s) – Monitoring", req: "DPA monitors safety and pollution-prevention aspects of each ship's operation." },
  { sn: "4.3", title: "Designated Person(s) – Link to Shore", req: "DPA acts as the link between the company and those on board." },
  { sn: "5.1", title: "Master's Responsibility – Authority", req: "Master's authority is clearly defined in the SMS; Master has overriding authority to take decisions for safety and environment." },
  { sn: "5.2", title: "Master's Responsibility – Motivating Crew", req: "Master implements the safety and environmental protection policy and motivates crew to observe it." },
  { sn: "5.3", title: "Master's Responsibility – Orders", req: "Master issues instructions and orders in a clear and simple manner." },
  { sn: "6.1", title: "Resources & Personnel – Qualifications", req: "All seafarers are properly qualified and certified per STCW requirements." },
  { sn: "6.2", title: "Resources & Personnel – Familiarization", req: "Familiarization programme is established for new joiners; records maintained." },
  { sn: "6.3", title: "Resources & Personnel – Training", req: "Training needs are identified; training programmes are documented and records kept." },
  { sn: "6.4", title: "Resources & Personnel – Communication", req: "Effective communications between ship and shore are ensured; language capabilities assessed." },
  { sn: "7.1", title: "Shipboard Operations – Key Operations", req: "Instructions for key shipboard operations are documented: cargo handling, bunkering, maneuvering, navigation." },
  { sn: "7.2", title: "Shipboard Operations – Checklists", req: "Checklists are developed and used for critical operations." },
  { sn: "7.3", title: "Shipboard Operations – Risk Assessment", req: "Risk assessment procedures are in place and applied for non-routine operations." },
  { sn: "8.1", title: "Emergency Preparedness – Contingency Plans", req: "Contingency plans exist for identified potential emergency shipboard situations including fire, flooding, collision, grounding." },
  { sn: "8.2", title: "Emergency Preparedness – Drills & Exercises", req: "Drills are conducted at required frequency; records maintained; effectiveness evaluated." },
  { sn: "8.3", title: "Emergency Preparedness – Reporting", req: "Procedures for reporting incidents to shore management are documented and understood by crew." },
  { sn: "9.1", title: "Non-conformities – Reporting System", req: "A non-conformity, near-miss, and hazardous occurrence reporting system is in place." },
  { sn: "9.2", title: "Non-conformities – Investigation", req: "Accidents and non-conformities are investigated; root causes identified; corrective actions taken." },
  { sn: "9.3", title: "Non-conformities – Corrective Actions", req: "Corrective actions are documented, tracked, and verified for effectiveness." },
  { sn: "10.1", title: "Maintenance – Planned Maintenance", req: "A planned maintenance system (PMS) exists covering all critical equipment." },
  { sn: "10.2", title: "Maintenance – Critical Equipment", req: "Critical equipment is identified; procedures for operation in emergency state exist." },
  { sn: "10.3", title: "Maintenance – Records", req: "Maintenance records are properly maintained and available for inspection." },
  { sn: "11.1", title: "Documentation – Document Control", req: "Document control procedures are in place; documents are reviewed and approved before issue." },
  { sn: "11.2", title: "Documentation – SMS Manual", req: "SMS manual is available on board and at the office in the working language; changes are controlled." },
  { sn: "11.3", title: "Documentation – Record Keeping", req: "Records of training, drills, maintenance, inspections, non-conformities, and audits are retained as required." },
  { sn: "12.1", title: "Company Verification – Internal Audits", req: "Internal audits of the SMS are carried out at least annually; audits cover all vessels." },
  { sn: "12.2", title: "Company Verification – Management Review", req: "Top management reviews the SMS at defined intervals to ensure its suitability and effectiveness." },
  { sn: "12.3", title: "Company Verification – Corrective Action Follow-up", req: "Non-conformities from audits are closed within agreed timescales." },
  { sn: "13.1", title: "Certification – DOC & SMC", req: "Document of Compliance (DOC) and Safety Management Certificate (SMC) are valid and on board." },
  { sn: "13.2", title: "Certification – Periodical Verification", req: "Intermediate and renewal verifications are scheduled and carried out by recognized flag state bodies." },
];

const ISPS_ITEMS = [
  { sn: "A/1", title: "Ship Security Assessment", req: "A ship security assessment (SSA) has been conducted and documented." },
  { sn: "A/2", title: "Ship Security Plan", req: "A ship security plan (SSP) has been developed, approved by the flag administration, and is on board." },
  { sn: "A/3", title: "Ship Security Officer", req: "A Ship Security Officer (SSO) is designated and trained per STCW." },
  { sn: "A/4", title: "Company Security Officer", req: "A Company Security Officer (CSO) is designated with defined responsibilities." },
  { sn: "A/5", title: "Security Level 1 – Minimum Measures", req: "Security measures for Security Level 1 are implemented and documented in the SSP." },
  { sn: "A/6", title: "Security Level 2 – Heightened Measures", req: "Heightened security measures for Security Level 2 are defined and can be activated promptly." },
  { sn: "A/7", title: "Security Level 3 – Exceptional Measures", req: "Exceptional security measures for Security Level 3 are defined and can be activated on authority instruction." },
  { sn: "A/8", title: "Declaration of Security", req: "Procedures for requesting and completing Declarations of Security (DoS) with port facilities are in place." },
  { sn: "A/9", title: "Security Equipment", req: "Required security equipment (AIS, SSAS, LRIT) is fitted, operational, and tested regularly." },
  { sn: "A/10", title: "Access Control", req: "Access control measures for the ship are defined and enforced at all security levels." },
  { sn: "A/11", title: "Monitoring", req: "Procedures for monitoring restricted areas and deck/hull areas are established." },
  { sn: "A/12", title: "Drill & Exercises", req: "Security drills and exercises are conducted at required intervals; records maintained." },
  { sn: "A/13", title: "ISSC Certificate", req: "International Ship Security Certificate (ISSC) is valid and available on board." },
];

const MLC_ITEMS = [
  { sn: "T1.1", title: "Title 1 – Minimum Age", req: "No seafarer under 16 is employed on board; age verification records are maintained." },
  { sn: "T1.2", title: "Title 1 – Medical Certificate", req: "All seafarers hold a valid ENG1 or equivalent medical fitness certificate." },
  { sn: "T1.3", title: "Title 1 – Training & Qualifications", req: "Seafarers are trained and certified as required by STCW and national law." },
  { sn: "T1.4", title: "Title 1 – Recruitment & Placement", req: "Recruitment is through licensed agencies; no fees charged to seafarers." },
  { sn: "T2.1", title: "Title 2 – Seafarers' Employment Agreements", req: "All seafarers have a signed SEA containing required elements; copy provided to seafarer." },
  { sn: "T2.2", title: "Title 2 – Wages", req: "Seafarers are paid at least ITF/MLC minimum wage; pay slips provided monthly; bank transfer records maintained." },
  { sn: "T2.3", title: "Title 2 – Hours of Work & Rest", req: "Hours of work/rest comply with MLC limits (max 14h work/day, 72h/week; min 10h rest/day); records maintained." },
  { sn: "T2.4", title: "Title 2 – Paid Annual Leave", req: "Seafarers accrue minimum 2.5 calendar days leave per month; leave records maintained." },
  { sn: "T2.5", title: "Title 2 – Repatriation", req: "Repatriation arrangements are in place at no cost to the seafarer; financial security provided." },
  { sn: "T3.1", title: "Title 3 – Accommodation Standards", req: "Crew accommodation meets MLC minimum standards for space, ventilation, heating, and sanitation." },
  { sn: "T3.2", title: "Title 3 – Food & Catering", req: "Sufficient, nutritious food and drinking water are provided free of charge; cook is qualified." },
  { sn: "T3.3", title: "Title 3 – Recreational Facilities", req: "Recreational facilities including internet access are available on board." },
  { sn: "T4.1", title: "Title 4 – Medical Care On Board", req: "Adequate medicines and medical equipment are on board; a qualified person can provide medical care." },
  { sn: "T4.2", title: "Title 4 – Shipowners' Liability", req: "Financial security for medical care and sickness benefits is in place (P&I cover or equivalent)." },
  { sn: "T4.3", title: "Title 4 – Social Security", req: "Seafarers are covered by social security protection in at least 3 of the 9 MLC branches." },
  { sn: "T5.1", title: "Title 5 – MLC Certificate & DMLC", req: "MLC Certificate and Declaration of Maritime Labour Compliance (DMLC) Parts I & II are on board and valid." },
  { sn: "T5.2", title: "Title 5 – Inspections", req: "Port state control inspections are facilitated; deficiencies from previous PSC inspections are corrected." },
  { sn: "T5.3", title: "Title 5 – Grievance Procedure", req: "An on-board complaint procedure is established; seafarers can file complaints without retaliation." },
];

export async function migrateCompliance() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_checklists (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER REFERENCES vessels(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        standard_code TEXT NOT NULL,
        standard_name TEXT NOT NULL,
        version TEXT,
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        compliance_percentage REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'in_progress',
        last_audit_date TIMESTAMP,
        next_audit_date TIMESTAMP,
        auditor_name TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS compliance_items (
        id SERIAL PRIMARY KEY,
        checklist_id INTEGER NOT NULL REFERENCES compliance_checklists(id) ON DELETE CASCADE,
        section_number TEXT,
        section_title TEXT NOT NULL,
        requirement TEXT NOT NULL,
        is_compliant BOOLEAN DEFAULT FALSE,
        evidence TEXT,
        evidence_file_url TEXT,
        responsible_person TEXT,
        due_date TIMESTAMP,
        completed_date TIMESTAMP,
        finding_type TEXT DEFAULT 'none',
        corrective_action TEXT,
        corrective_action_due_date TIMESTAMP,
        corrective_action_status TEXT DEFAULT 'open',
        notes TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS compliance_audits (
        id SERIAL PRIMARY KEY,
        checklist_id INTEGER NOT NULL REFERENCES compliance_checklists(id) ON DELETE CASCADE,
        audit_type TEXT NOT NULL,
        auditor_name TEXT NOT NULL,
        auditor_organization TEXT,
        audit_date TIMESTAMP NOT NULL,
        findings JSONB DEFAULT '[]',
        overall_result TEXT,
        report_file_url TEXT,
        next_audit_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_compliance_checklists_user ON compliance_checklists(user_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_checklists_vessel ON compliance_checklists(vessel_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_checklists_org ON compliance_checklists(organization_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_checklists_code ON compliance_checklists(standard_code);
      CREATE INDEX IF NOT EXISTS idx_compliance_items_checklist ON compliance_items(checklist_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_items_compliant ON compliance_items(is_compliant);
      CREATE INDEX IF NOT EXISTS idx_compliance_audits_checklist ON compliance_audits(checklist_id);
    `);
    console.log("[compliance] Tables created/verified");
  } catch (err) {
    console.error("[compliance] Migration error:", err);
  }
}

export async function getStandardTemplate(code: string): Promise<Array<{ sn: string; title: string; req: string }>> {
  if (code === "ISM") return ISM_ITEMS;
  if (code === "ISPS") return ISPS_ITEMS;
  if (code === "MLC") return MLC_ITEMS;
  return [];
}

export const STANDARD_NAMES: Record<string, string> = {
  ISM: "International Safety Management Code",
  ISPS: "International Ship and Port Facility Security Code",
  MLC: "Maritime Labour Convention 2006",
  MARPOL: "International Convention for the Prevention of Pollution from Ships",
  SOLAS: "International Convention for the Safety of Life at Sea",
};
