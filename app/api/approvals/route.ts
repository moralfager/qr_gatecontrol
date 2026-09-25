import { NextRequest } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { query } from "../../../lib/server/db";
import { canDecideApproval } from "../../../lib/server/domain";
import { errorResponse, json } from "../../../lib/server/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "approver"]);
    const result = await query(
      `SELECT ap.*, a.number, a.type, a.status AS application_status, a.created_at,
              o.name AS organization_name,
              string_agg(DISTINCT z.name, ', ' ORDER BY z.name) AS zones,
              COUNT(DISTINCT aw.id)::int AS workers_count,
              COUNT(DISTINCT av.id)::int AS vehicles_count
       FROM approvals ap
       JOIN applications a ON a.id = ap.application_id
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN application_zones az ON az.application_id = a.id
       LEFT JOIN zones z ON z.id = az.zone_id
       LEFT JOIN application_workers aw ON aw.application_id = a.id
       LEFT JOIN application_vehicles av ON av.application_id = a.id
       WHERE a.status = 'submitted'
         AND ap.decision = 'pending'
         AND ($1 = 'admin' OR ap.approver_user_id = $2 OR ap.department = $3)
       GROUP BY ap.id, a.id, o.name
       ORDER BY a.id DESC, ap.id`,
      [user.role, user.id, user.department],
    );
    const decorated = [];
    for (const row of result.rows) {
      const decision = await canDecideApproval(queryClient, user, row.id);
      decorated.push({ ...row, can_decide: decision.ok });
    }
    return json({ approvals: decorated });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
