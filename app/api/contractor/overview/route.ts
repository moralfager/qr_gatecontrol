import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { errorResponse, json } from "../../../../lib/server/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "contractor", "user"]);
    const params: unknown[] = [];
    let where = "true";
    if (user.role === "contractor" || user.role === "user") {
      params.push(user.id, user.organization_id);
      where = "(a.created_by = $1 OR a.organization_id = $2)";
    }
    const applications = await query(
      `SELECT a.*, o.name AS organization_name,
              COUNT(DISTINCT aw.id)::int AS workers_count,
              COUNT(DISTINCT av.id)::int AS vehicles_count,
              string_agg(DISTINCT z.name, ', ' ORDER BY z.name) AS zones
       FROM applications a
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN application_workers aw ON aw.application_id = a.id
       LEFT JOIN application_vehicles av ON av.application_id = a.id
       LEFT JOIN application_zones az ON az.application_id = a.id
       LEFT JOIN zones z ON z.id = az.zone_id
       WHERE ${where}
       GROUP BY a.id, o.name
       ORDER BY a.id DESC
       LIMIT 20`,
      params,
    );
    const passes = await query(
      `SELECT p.*, a.number AS application_number, o.name AS organization_name,
              aw.full_name, aw.position, aw.iin,
              av.make, av.plate, av.trailer,
              string_agg(DISTINCT z.name, ', ' ORDER BY z.name) AS zones
       FROM passes p
       JOIN applications a ON a.id = p.application_id
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN application_workers aw ON p.subject_type = 'worker' AND aw.id = p.subject_id
       LEFT JOIN application_vehicles av ON p.subject_type = 'vehicle' AND av.id = p.subject_id
       LEFT JOIN pass_zones pz ON pz.pass_id = p.id
       LEFT JOIN zones z ON z.id = pz.zone_id
       WHERE ${where}
       GROUP BY p.id, a.id, o.name, aw.id, av.id
       ORDER BY p.id DESC
       LIMIT 20`,
      params,
    );
    return json({ applications: applications.rows, passes: passes.rows });
  } catch (error) {
    return errorResponse(error);
  }
}
