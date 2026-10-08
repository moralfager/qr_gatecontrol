import { NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/server/auth";
import { withTransaction } from "../../../../../lib/server/db";
import {
  audit,
  applicationHistory,
  canDecideApproval,
  issuePasses,
  notifyPendingApprovers,
  queueNotification,
} from "../../../../../lib/server/domain";
import { errorResponse, json } from "../../../../../lib/server/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, ["admin", "approver"]);
    const { id } = await context.params;
    const body = await request.json();
    const decision = String(body.decision ?? "");
    const comment = String(body.comment ?? "");
    if (!["approved", "returned", "rejected"].includes(decision)) {
      return json({ error: "Некорректное решение" }, 400);
    }
    const result = await withTransaction(async (client) => {
      const allowed = await canDecideApproval(client, user, Number(id));
      if (!allowed.ok || !allowed.approval) {
        throw Object.assign(new Error("Решение недоступно"), { status: 403 });
      }
      const approval = allowed.approval;
      await client.query(
        "UPDATE approvals SET decision = $1, comment = $2, decided_at = now(), approver_user_id = $4 WHERE id = $3",
        [decision, comment, Number(id), user.id],
      );
      const appResult = await client.query(
        `SELECT a.*, u.email AS creator_email, u.id AS creator_id
         FROM applications a
         JOIN users u ON u.id = a.created_by
         WHERE a.id = $1`,
        [approval.application_id],
      );
      const application = appResult.rows[0];
      if (decision === "returned" || decision === "rejected") {
        await client.query(
          "UPDATE applications SET status = $1, decided_at = now(), updated_at = now() WHERE id = $2",
          [decision, application.id],
        );
        await queueNotification(
          client,
          application.creator_id,
          application.creator_email,
          `Заявка ${application.number}: ${decision === "returned" ? "возврат на доработку" : "отклонена"}`,
          comment || "Решение принято без комментария.",
        );
      } else {
        const pending = await client.query(
          "SELECT COUNT(*)::int AS count FROM approvals WHERE application_id = $1 AND cycle = $2 AND decision = 'pending'",
          [application.id, approval.cycle],
        );
        if (pending.rows[0].count === 0) {
          await client.query(
            "UPDATE applications SET status = 'approved', decided_at = now(), updated_at = now() WHERE id = $1",
            [application.id],
          );
          await issuePasses(client, application.id, `${user.name}, ${new Date().toLocaleString("ru-RU")}`);
          await applicationHistory(
            client,
            application.id,
            approval.cycle,
            "application.approved",
            user.id,
            application.status,
            "approved",
            "",
            { number: application.number },
          );
          await queueNotification(
            client,
            application.creator_id,
            application.creator_email,
            `Заявка ${application.number} согласована`,
            "Согласование завершено, пропуска сформированы.",
          );
        } else {
          await notifyPendingApprovers(client, application.id);
        }
      }
      await applicationHistory(
        client,
        application.id,
        approval.cycle,
        `approval.${decision}`,
        user.id,
        application.status,
        decision === "approved" ? application.status : decision,
        comment,
        { approvalId: Number(id), department: approval.department },
      );
      await audit(client, user.id, `approval.${decision}`, "application", application.id, {
        applicationNumber: application.number,
        approvalId: Number(id),
        department: approval.department,
        decision,
        comment,
      });
      return application.id;
    });
    return json({ ok: true, applicationId: result });
  } catch (error) {
    return errorResponse(error);
  }
}
