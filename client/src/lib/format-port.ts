export function formatPortName(raw?: string | null): string | null {
  if (!raw || raw.trim() === "" || raw === "null" || raw === "undefined") return null;

  let name = raw.trim();

  name = name.replace(/^>+/, "").trim();

  if (name.includes(">")) {
    const parts = name.split(">");
    name = parts[parts.length - 1].trim();
  }

  if (/^[A-Z]{2}\s[A-Z]{3,}$/.test(name)) {
    name = name.substring(3);
  }

  if (/^[A-Z]{5}$/.test(name)) {
    name = name.substring(2);
  }

  return name
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getDeparturePort(voyage: any, posOrVessel: any): string | null {
  if (voyage?.originPortName) return formatPortName(voyage.originPortName);
  if (voyage?.departurePort)  return formatPortName(voyage.departurePort);
  if (voyage?.loadPort)       return formatPortName(voyage.loadPort);

  if (posOrVessel?.last_port_name)    return formatPortName(posOrVessel.last_port_name);
  if (posOrVessel?.last_port?.name)   return formatPortName(posOrVessel.last_port.name);
  if (posOrVessel?.ais?.last_port)    return formatPortName(posOrVessel.ais.last_port);
  if (posOrVessel?.port_name)         return formatPortName(posOrVessel.port_name);

  return null;
}

export function getDestinationPort(voyage: any, posOrVessel: any): string | null {
  if (voyage?.portName)         return formatPortName(voyage.portName);
  if (voyage?.dischargePort)    return formatPortName(voyage.dischargePort);
  if (voyage?.destinationPort)  return formatPortName(voyage.destinationPort);

  if (posOrVessel?.destination)         return formatPortName(posOrVessel.destination);
  if (posOrVessel?.ais?.destination)    return formatPortName(posOrVessel.ais.destination);
  if (posOrVessel?.next_port_name)      return formatPortName(posOrVessel.next_port_name);

  return null;
}

export function formatCoord(value: number, type: "lat" | "lon"): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(1);
  const dir = type === "lat" ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  return `${deg}°${min}'${dir}`;
}

export const NAV_STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  "Under way using engine":     { icon: "🚢", color: "text-emerald-400", label: "Underway" },
  "Under way sailing":          { icon: "⛵", color: "text-emerald-400", label: "Sailing" },
  "Moored":                     { icon: "⚓", color: "text-blue-400",    label: "Moored" },
  "At anchor":                  { icon: "⚓", color: "text-amber-400",   label: "At Anchor" },
  "At Anchor":                  { icon: "⚓", color: "text-amber-400",   label: "At Anchor" },
  "Not under command":          { icon: "⚠️", color: "text-red-400",     label: "Not Under Command" },
  "Restricted maneuverability": { icon: "⚠️", color: "text-amber-400",   label: "Restricted" },
  "Constrained by draught":     { icon: "⚠️", color: "text-amber-400",   label: "Constrained" },
  "Engaged in fishing":         { icon: "🎣", color: "text-blue-400",    label: "Fishing" },
  "Aground":                    { icon: "🔴", color: "text-red-500",     label: "Aground" },
};
