import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { errorResponse, json } from "../../../../lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, ["admin", "approver", "contractor"]);
    const { id } = await context.params;
    const params: unknown[] = [Number(id)];
    let scope = "true";
    if (user.role === "contractor") {
      params.push(user.id, user.organization_id);
      scope = "(a.created_by = $2 OR a.organization_id = $3)";
    }
    const result = await query(
      `SELECT p.*, a.number AS application_number, o.name AS organization_name,
              COALESCE(
                (
                  SELECT string_agg(ap.department || ': ' || COALESCE(u.name, ap.department) || COALESCE(', ' || to_char(ap.decided_at, 'DD.MM.YYYY, HH24:MI:SS'), ''), '; ' ORDER BY ap.decided_at, ap.id)
                  FROM approvals ap
                  LEFT JOIN users u ON u.id = ap.approver_user_id
                  WHERE ap.application_id = a.id AND ap.decision = 'approved'
                ),
                p.approved_by
              ) AS approved_by,
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
       WHERE p.id = $1 AND ${scope}
       GROUP BY p.id, a.id, o.name, aw.id, av.id`,
      params,
    );
    if (!result.rows[0]) return json({ error: "Пропуск не найден" }, 404);
    return json({ pass: result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}
