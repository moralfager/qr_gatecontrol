import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { audit } from "../../../../lib/server/domain";
import { errorResponse, json } from "../../../../lib/server/http";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "guard"]);
    const body = await request.json();
    const passId = Number(body.passId || 0);
    const defaultPostId = Number(body.defaultPostId || 0);
    const finalPostId = Number(body.finalPostId || 0);
    const result = String(body.result || "");
    const comment = String(body.comment || "");
    if (!passId || !defaultPostId || !finalPostId || !["allowed", "denied", "invalid"].includes(result)) {
      return json({ error: "Некорректные данные события" }, 400);
    }
    const eventType = result === "allowed" ? "passage_confirmed" : result === "denied" ? "passage_denied" : "invalid_attempt";
    await query(
      `INSERT INTO access_events
         (pass_id, guard_id, default_post_id, final_post_id, post_changed, event_type, result, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [passId, user.id, defaultPostId, finalPostId, defaultPostId !== finalPostId, eventType, result, comment],
    );
    await audit(queryClient, user.id, `guard.${eventType}`, "pass", passId, {
      defaultPostId,
      finalPostId,
      postChanged: defaultPostId !== finalPostId,
      result,
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
