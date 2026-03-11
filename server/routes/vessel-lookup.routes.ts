import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

const DATALASTIC_KEY = process.env.DATALASTIC_API_KEY;
const BASE = "https://api.datalastic.com/api/v0";

async function fetchDatalastic(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ "api-key": DATALASTIC_KEY || "", ...params }).toString();
  const url = `${BASE}/${endpoint}?${qs}`;
  console.log(`[vessel-lookup] Fetching: ${endpoint}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Datalastic ${endpoint}: ${res.status}`);
  return res.json();
}

router.get("/:imo", isAuthenticated, async (req: any, res) => {
  try {
    const imo = req.params.imo.trim();
    if (!/^\d{7}$/.test(imo)) return res.status(400).json({ error: "Invalid IMO number. Must be 7 digits." });

    const [vesselPro, vesselInfo, vesselHistory] = await Promise.allSettled([
      fetchDatalastic("vessel_pro", { imo }),
      fetchDatalastic("vessel_info", { imo }),
      fetchDatalastic("vessel_history", { imo }),
    ]);

    const proData = vesselPro.status === "fulfilled" ? vesselPro.value?.data : null;
    const infoData = vesselInfo.status === "fulfilled" ? vesselInfo.value?.data : null;
    const historyData = vesselHistory.status === "fulfilled" ? vesselHistory.value?.data : null;

    if (!proData && !infoData) {
      return res.status(404).json({ error: "Vessel not found" });
    }

    const vessel = {
      imo: proData?.imo || infoData?.imo || imo,
      mmsi: proData?.mmsi || infoData?.mmsi,
      name: proData?.vessel_name || infoData?.vessel_name,
      callSign: proData?.call_sign || infoData?.call_sign,
      flag: proData?.flag || infoData?.flag,
      flagCode: proData?.flag_code || infoData?.flag_code,
      vesselType: proData?.vessel_type || infoData?.vessel_type,
      vesselTypeCode: proData?.vessel_type_code,
      status: proData?.vessel_status || infoData?.vessel_status,

      grossTonnage: proData?.gross_tonnage || infoData?.gross_tonnage,
      netTonnage: proData?.net_tonnage,
      deadweight: proData?.deadweight || infoData?.deadweight,
      displacement: proData?.displacement,
      length: proData?.length_overall || infoData?.length,
      breadth: proData?.breadth || infoData?.breadth,
      depth: proData?.depth,
      draught: proData?.draught || infoData?.draught,
      maxDraught: proData?.max_draught,
      airDraught: proData?.air_draught,

      yearBuilt: proData?.year_built || infoData?.year_built,
      builder: proData?.builder,
      buildCountry: proData?.build_country,
      yardNumber: proData?.yard_number,
      hullNumber: proData?.hull_number,

      mainEngine: proData?.main_engine,
      enginePower: proData?.engine_power,
      engineRpm: proData?.engine_rpm,
      propellerType: proData?.propeller_type,
      speed: proData?.speed || infoData?.speed,
      fuelConsumption: proData?.fuel_consumption,
      fuelType: proData?.fuel_type,

      teu: proData?.teu,
      teu14: proData?.teu_14,
      holdCount: proData?.hold_count,
      hatchCount: proData?.hatch_count,
      tankCount: proData?.tank_count,
      grainCapacity: proData?.grain_capacity,
      baleCapacity: proData?.bale_capacity,
      liquidCapacity: proData?.liquid_capacity,
      gasCapacity: proData?.gas_capacity,
      reefer: proData?.reefer,
      craneCount: proData?.crane_count,
      craneCapacity: proData?.crane_capacity,

      classificationSociety: proData?.classification_society,
      classNotation: proData?.class_notation,
      iceClass: proData?.ice_class,
      pAndIClub: proData?.p_and_i_club,

      owner: proData?.owner,
      operator: proData?.operator || infoData?.operator,
      manager: proData?.manager || infoData?.manager,
      managementCompany: proData?.management_company,
      beneficialOwner: proData?.beneficial_owner,
      registeredOwner: proData?.registered_owner,
      technicalManager: proData?.technical_manager,
      commercialManager: proData?.commercial_manager,
      dismantler: proData?.dismantler,
      groupOwner: proData?.group_owner,
      insurancer: proData?.insurancer,

      lat: proData?.lat || infoData?.lat,
      lon: proData?.lon || infoData?.lon,
      course: proData?.course || infoData?.course,
      heading: proData?.heading || infoData?.heading,
      speedKnots: proData?.current_speed || infoData?.speed,
      navStatus: proData?.nav_status || infoData?.nav_status,
      destination: proData?.destination || infoData?.destination,
      eta: proData?.eta || infoData?.eta,
      lastPositionUpdate: proData?.last_position_UTC || infoData?.last_position_UTC,
      currentPort: proData?.current_port || infoData?.current_port,
      currentPortCountry: proData?.current_port_country,
      departurePort: proData?.departure_port,
      departureDate: proData?.departure_date,

      keelLaidDate: proData?.keel_laid_date,
      deliveryDate: proData?.delivery_date,
      lastDrydock: proData?.last_drydock,
      nextDrydock: proData?.next_drydock,
      lastSurvey: proData?.last_survey,

      _rawPro: proData,
      _rawInfo: infoData,
      _rawHistory: historyData,
    };

    res.json({ vessel, history: historyData });
  } catch (err: any) {
    console.error("[vessel-lookup] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
