import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { audit } from "../../../../lib/server/domain";
import { errorResponse, json } from "../../../../lib/server/http";

function extractToken(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.searchParams.get("token") || value;
  } catch {
    if (value.includes("token=")) return value.split("token=", 2)[1].split("&", 1)[0];
    return value;
  }
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "guard"]);
    const body = await request.json();
    const raw = String(body.tokenOrNumber ?? "");
    const tokenOrNumber = extractToken(raw);
    const defaultPostId = Number(body.defaultPostId || 0) || null;
    const result = await query(
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
       WHERE p.token = $1 OR p.number = $1
       GROUP BY p.id, a.id, o.name, aw.id, av.id
       LIMIT 1`,
      [tokenOrNumber],
    );
    const pass = result.rows[0];
    if (!pass) {
      await query(
        `INSERT INTO access_events (guard_id, default_post_id, final_post_id, event_type, result, comment)
         VALUES ($1, $2, $2, 'scan', 'invalid', $3)`,
        [user.id, defaultPostId, `Неизвестный QR/номер: ${raw}`],
      );
      await audit(queryClient, user.id, "guard.scan.invalid", "pass", null, { raw });
      return json({ valid: false, reason: "Пропуск не найден" }, 404);
    }
    const today = new Date().toISOString().slice(0, 10);
    let valid = true;
    let reason = "Пропуск действителен";
    if (pass.status !== "active") {
      valid = false;
      reason = `Статус пропуска: ${pass.status}`;
    } else if (dateOnly(pass.valid_from) > today) {
      valid = false;
      reason = "Срок действия еще не начался";
    } else if (dateOnly(pass.valid_to) < today) {
      valid = false;
      reason = "Срок действия истек";
    }
    await query(
      `INSERT INTO access_events (pass_id, guard_id, default_post_id, final_post_id, event_type, result)
       VALUES ($1, $2, $3, $3, 'scan', $4)`,
      [pass.id, user.id, defaultPostId, valid ? "valid" : "invalid"],
    );
    return json({ valid, reason, pass });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
