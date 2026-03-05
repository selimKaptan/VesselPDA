import { db } from "./db";
import { voyageActivities } from "@shared/schema";

export async function logVoyageActivity(params: {
  voyageId: number;
  userId?: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await db.insert(voyageActivities).values(params);
  } catch (e) {
    console.error("Failed to log voyage activity:", e);
  }
}
