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
    const context = await query<{ pass: string | null; default_post: string | null; final_post: string | null }>(
      `SELECT p.number AS pass, dp.name AS default_post, fp.name AS final_post
       FROM passes p
       LEFT JOIN guard_posts dp ON dp.id = $2
       LEFT JOIN guard_posts fp ON fp.id = $3
       WHERE p.id = $1
       LIMIT 1`,
      [passId, defaultPostId, finalPostId],
    );
    await audit(queryClient, user.id, `guard.${eventType}`, "pass", passId, {
      pass: context.rows[0]?.pass,
      defaultPost: context.rows[0]?.default_post,
      finalPost: context.rows[0]?.final_post,
      defaultPostId,
      finalPostId,
      postChanged: defaultPostId !== finalPostId,
      result,
      comment,
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
