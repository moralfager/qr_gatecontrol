import { NextRequest } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { query } from "../../../lib/server/db";
import { canDecideApproval } from "../../../lib/server/domain";
import { errorResponse, json } from "../../../lib/server/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "approver"]);
    const result = await query(
      `SELECT a.id AS application_id, a.number, a.type, a.status AS application_status, a.approval_cycle, a.created_at, a.updated_at,
              a.created_by,
              o.name AS organization_name,
              string_agg(DISTINCT z.name, ', ' ORDER BY z.name) AS zones,
              COUNT(DISTINCT aw.id)::int AS workers_count,
              COUNT(DISTINCT av.id)::int AS vehicles_count,
              COALESCE(
                jsonb_agg(
                  DISTINCT jsonb_build_object(
                    'id', ap.id,
                    'department', ap.department,
                    'decision', ap.decision,
                    'comment', ap.comment,
                    'decided_at', ap.decided_at,
                    'approver_user_id', ap.approver_user_id,
                    'approver_name', u.name,
                    'cycle', ap.cycle
                  )
                ) FILTER (WHERE ap.id IS NOT NULL),
                '[]'::jsonb
              ) AS approvals
       FROM applications a
       LEFT JOIN approvals ap ON ap.application_id = a.id
       LEFT JOIN users u ON u.id = ap.approver_user_id
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN application_zones az ON az.application_id = a.id
       LEFT JOIN zones z ON z.id = az.zone_id
       LEFT JOIN application_workers aw ON aw.application_id = a.id
       LEFT JOIN application_vehicles av ON av.application_id = a.id
       GROUP BY a.id, o.name
       ORDER BY a.id DESC`,
    );
    const decorated = [];
    for (const row of result.rows) {
      const approvals = Array.isArray(row.approvals) ? row.approvals : [];
      const currentApprovals = approvals.filter((approval) => Number(approval.cycle) === Number(row.approval_cycle));
      const ownApproval =
        currentApprovals.find((approval) => approval.decision === "pending" && (user.role === "admin" || approval.approver_user_id === user.id || approval.department === user.department)) ??
        currentApprovals.find((approval) => user.role === "admin" || approval.approver_user_id === user.id || approval.department === user.department) ??
        approvals.find((approval) => user.role === "admin" || approval.approver_user_id === user.id || approval.department === user.department) ??
        null;
      const decision = ownApproval ? await canDecideApproval(queryClient, user, ownApproval.id) : { ok: false };
      const touchedByYou = row.created_by === user.id || approvals.some((approval) => approval.approver_user_id === user.id && approval.decision !== "pending");
      decorated.push({
        ...row,
        id: ownApproval?.id ?? 0,
        department: ownApproval?.department ?? user.department ?? "",
        decision: ownApproval?.decision ?? "",
        decided_at: ownApproval?.decided_at ?? null,
        comment: ownApproval?.comment ?? "",
        can_decide: decision.ok,
        touched_by_you: touchedByYou,
      });
    }
    return json({ approvals: decorated });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
