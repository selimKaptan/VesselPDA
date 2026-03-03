import { pool } from "../db";

interface ActivityParams {
  organizationId: number;
  userId: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  description: string;
}

/**
 * logOrgActivity — async, non-blocking activity feed logger.
 * Call without await to avoid slowing down API responses.
 */
export function logOrgActivity(params: ActivityParams): void {
  const { organizationId, userId, action, entityType, entityId, description } = params;
  pool.query(
    `INSERT INTO organization_activity_feed (organization_id, user_id, action, entity_type, entity_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, userId, action, entityType, entityId ?? null, description]
  ).catch((err: any) => {
    console.error("[orgActivity] failed to log:", err.message);
  });
}

/**
 * getOrgActivityFeed — returns recent activity for an org (default: last 50 entries)
 */
export async function getOrgActivityFeed(organizationId: number, limit = 50): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT f.*, u.first_name, u.last_name, u.email
     FROM organization_activity_feed f
     LEFT JOIN users u ON u.id = f.user_id
     WHERE f.organization_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2`,
    [organizationId, limit]
  );
  return rows;
}
