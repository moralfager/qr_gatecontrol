import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { audit, getDictionaries } from "../../../../lib/server/domain";
import { errorResponse, json } from "../../../../lib/server/http";

const TABLES: Record<string, { table: string; fields: string[] }> = {
  organization: { table: "organizations", fields: ["name", "bin", "org_type"] },
  profession: { table: "professions", fields: ["name"] },
  vehicle_type: { table: "vehicle_types", fields: ["name"] },
  document_type: { table: "document_types", fields: ["code", "name", "category"] },
  zone: { table: "zones", fields: ["name", "code"] },
  post: { table: "guard_posts", fields: ["name", "zone_id"] },
};

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, ["admin"]);
    return json(await getDictionaries());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin"]);
    const body = await request.json();
    const kind = String(body.kind || "");
    const meta = TABLES[kind];
    if (!meta) return json({ error: "Неизвестный справочник" }, 400);
    const values = meta.fields.map((field) => body[field] ?? null);
    if (values.some((value) => value === null || String(value).trim() === "")) {
      return json({ error: "Заполните все поля" }, 400);
    }
    const placeholders = meta.fields.map((_, index) => `$${index + 1}`).join(", ");
    const updates = meta.fields.map((field) => `${field} = EXCLUDED.${field}`).join(", ");
    const conflict = kind === "document_type" ? "code" : kind === "zone" ? "code" : "name";
    const result = await query(
      `INSERT INTO ${meta.table} (${meta.fields.join(", ")})
       VALUES (${placeholders})
       ON CONFLICT (${conflict}) DO UPDATE SET ${updates}, active = true
       RETURNING id`,
      values,
    );
    await audit(queryClient, user.id, `admin.${kind}.save`, meta.table, result.rows[0]?.id ?? null);
    return json({ id: result.rows[0]?.id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin"]);
    const body = await request.json();
    const kind = String(body.kind || "");
    const id = Number(body.id || 0);
    const active = Boolean(body.active);
    const meta = TABLES[kind];
    if (!meta || !id) return json({ error: "Некорректные данные" }, 400);
    await query(`UPDATE ${meta.table} SET active = $1 WHERE id = $2`, [active, id]);
    await audit(queryClient, user.id, `admin.${kind}.${active ? "restore" : "disable"}`, meta.table, id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
