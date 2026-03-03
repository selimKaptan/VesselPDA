import { pool } from "./db";

export async function ensureSofSchema() {
  console.log("[sof] Ensuring SOF schema...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sof_events (
      id SERIAL PRIMARY KEY,
      port_call_id INTEGER NOT NULL REFERENCES voyage_port_calls(id) ON DELETE CASCADE,
      voyage_id INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
      event_code TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_time TIMESTAMP NOT NULL,
      remarks TEXT,
      is_official BOOLEAN DEFAULT false,
      recorded_by_user_id VARCHAR REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      organization_id INTEGER REFERENCES organizations(id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sof_events_port_call ON sof_events(port_call_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sof_events_voyage ON sof_events(voyage_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sof_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      port_call_type TEXT,
      events JSONB NOT NULL DEFAULT '[]',
      is_default BOOLEAN DEFAULT true,
      organization_id INTEGER REFERENCES organizations(id)
    )
  `);

  const { rows: existing } = await pool.query("SELECT COUNT(*) FROM sof_templates WHERE is_default = true");
  if (parseInt(existing[0].count) === 0) {
    const loadingEvents = [
      { eventCode: "VESSEL_ARRIVED",     eventName: "Vessel arrived at port / anchorage", order: 1 },
      { eventCode: "NOR_TENDERED",       eventName: "Notice of Readiness tendered",         order: 2 },
      { eventCode: "NOR_ACCEPTED",       eventName: "Notice of Readiness accepted",          order: 3 },
      { eventCode: "FREE_PRATIQUE",      eventName: "Free pratique granted",                 order: 4 },
      { eventCode: "BERTH_ORDERED",      eventName: "Berth ordered",                         order: 5 },
      { eventCode: "BERTHED",            eventName: "All fast / Vessel berthed",             order: 6 },
      { eventCode: "HATCH_OPEN",         eventName: "Hatches opened",                        order: 7 },
      { eventCode: "LOADING_COMMENCED",  eventName: "Loading commenced",                     order: 8 },
      { eventCode: "LOADING_COMPLETED",  eventName: "Loading completed",                     order: 9 },
      { eventCode: "HATCH_CLOSED",       eventName: "Hatches closed / sealed",               order: 10 },
      { eventCode: "DOCS_ON_BOARD",      eventName: "Documents on board",                    order: 11 },
      { eventCode: "PILOT_ON_BOARD",     eventName: "Pilot on board",                        order: 12 },
      { eventCode: "UNBERTHED",          eventName: "Vessel unberthed",                      order: 13 },
      { eventCode: "VESSEL_SAILED",      eventName: "Vessel sailed",                         order: 14 },
    ];
    const dischargingEvents = [
      { eventCode: "VESSEL_ARRIVED",      eventName: "Vessel arrived at port / anchorage", order: 1 },
      { eventCode: "NOR_TENDERED",        eventName: "Notice of Readiness tendered",         order: 2 },
      { eventCode: "NOR_ACCEPTED",        eventName: "Notice of Readiness accepted",          order: 3 },
      { eventCode: "FREE_PRATIQUE",       eventName: "Free pratique granted",                 order: 4 },
      { eventCode: "BERTH_ORDERED",       eventName: "Berth ordered",                         order: 5 },
      { eventCode: "BERTHED",             eventName: "All fast / Vessel berthed",             order: 6 },
      { eventCode: "HATCH_OPEN",          eventName: "Hatches opened",                        order: 7 },
      { eventCode: "DISCHARGE_COMMENCED", eventName: "Discharge commenced",                   order: 8 },
      { eventCode: "DISCHARGE_COMPLETED", eventName: "Discharge completed",                   order: 9 },
      { eventCode: "HATCH_CLOSED",        eventName: "Hatches closed / sealed",               order: 10 },
      { eventCode: "DOCS_ON_BOARD",       eventName: "Documents on board",                    order: 11 },
      { eventCode: "PILOT_ON_BOARD",      eventName: "Pilot on board",                        order: 12 },
      { eventCode: "UNBERTHED",           eventName: "Vessel unberthed",                      order: 13 },
      { eventCode: "VESSEL_SAILED",       eventName: "Vessel sailed",                         order: 14 },
    ];
    const bunkeringEvents = [
      { eventCode: "VESSEL_ARRIVED",  eventName: "Vessel arrived at port / anchorage", order: 1 },
      { eventCode: "NOR_TENDERED",    eventName: "Notice of Readiness tendered",         order: 2 },
      { eventCode: "FREE_PRATIQUE",   eventName: "Free pratique granted",                 order: 3 },
      { eventCode: "BERTHED",         eventName: "All fast / Vessel berthed",             order: 4 },
      { eventCode: "BUNKER_START",    eventName: "Bunkering commenced",                   order: 5 },
      { eventCode: "BUNKER_END",      eventName: "Bunkering completed",                   order: 6 },
      { eventCode: "DOCS_ON_BOARD",   eventName: "Documents on board",                    order: 7 },
      { eventCode: "UNBERTHED",       eventName: "Vessel unberthed",                      order: 8 },
      { eventCode: "VESSEL_SAILED",   eventName: "Vessel sailed",                         order: 9 },
    ];

    await pool.query(
      `INSERT INTO sof_templates (name, port_call_type, events, is_default) VALUES ($1,$2,$3,true),($4,$5,$6,true),($7,$8,$9,true)`,
      [
        "Standard Loading SOF",    "loading",     JSON.stringify(loadingEvents),
        "Standard Discharge SOF",  "discharging", JSON.stringify(dischargingEvents),
        "Bunkering SOF",           "bunkering",   JSON.stringify(bunkeringEvents),
      ]
    );
    console.log("[sof] ✓ Default SOF templates seeded.");
  }

  console.log("[sof] ✓ SOF schema ready.");
}
