import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { errorResponse, json } from "../../../../lib/server/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "guard"]);
    const result =
      user.role === "admin" || !user.allowed_post_ids?.length
        ? await query(
            `SELECT gp.*, z.name AS zone_name
             FROM guard_posts gp
             LEFT JOIN zones z ON z.id = gp.zone_id
             WHERE gp.active = true
             ORDER BY gp.name`,
          )
        : await query(
            `SELECT gp.*, z.name AS zone_name
             FROM guard_posts gp
             LEFT JOIN zones z ON z.id = gp.zone_id
             WHERE gp.active = true AND gp.id = ANY($1::int[])
             ORDER BY gp.name`,
            [user.allowed_post_ids],
          );
    return json({ posts: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}
