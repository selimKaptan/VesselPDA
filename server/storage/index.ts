import { userStorage } from "./user.storage";
import { vesselStorage } from "./vessel.storage";
import { portStorage } from "./port.storage";
import { proformaStorage } from "./proforma.storage";
import { companyStorage } from "./company.storage";
import { forumStorage } from "./forum.storage";
import { tenderStorage } from "./tender.storage";
import { notificationStorage } from "./notification.storage";
import { voyageStorage } from "./voyage.storage";
import { messageStorage } from "./message.storage";
import { nominationStorage } from "./nomination.storage";
import { crewStorage } from "./crew.storage";
import { invoiceStorage } from "./invoice.storage";
import { bunkerStorage } from "./bunker.storage";
import { charterPartyStorage } from "./charter-party.storage";
import { maintenanceStorage } from "./maintenance.storage";
import { husbandryStorage } from "./husbandry.storage";
import { miscStorage } from "./misc.storage";

export const storage = {
  ...userStorage,
  ...vesselStorage,
  ...portStorage,
  ...proformaStorage,
  ...companyStorage,
  ...forumStorage,
  ...tenderStorage,
  ...notificationStorage,
  ...voyageStorage,
  ...messageStorage,
  ...nominationStorage,
  ...crewStorage,
  ...invoiceStorage,
  ...bunkerStorage,
  ...charterPartyStorage,
  ...maintenanceStorage,
  ...husbandryStorage,
  ...miscStorage,
};

export type IStorage = typeof storage;
