import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query, withTransaction } from "../../../../lib/server/db";
import { audit, getDictionaries } from "../../../../lib/server/domain";
import { errorResponse, json } from "../../../../lib/server/http";
import crypto from "node:crypto";

const TABLES: Record<string, { table: string; fields: string[] }> = {
  organization: { table: "organizations", fields: ["name", "bin", "org_type"] },
  profession: { table: "professions", fields: ["name"] },
  vehicle_type: { table: "vehicle_types", fields: ["name"] },
  document_type: { table: "document_types", fields: ["code", "name", "category"] },
  zone: { table: "zones", fields: ["name", "code"] },
  post: { table: "guard_posts", fields: ["name", "zone_id"] },
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function intArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
}

function textArray(value: unknown) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return cleanText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function generatedCode(prefix: string, name: string) {
  const hash = crypto.createHash("sha1").update(`${prefix}:${name}`).digest("hex").slice(0, 10).toUpperCase();
  return `${prefix}_${hash}`;
}

async function ensureDocument(client: { query: (text: string, params?: unknown[]) => Promise<{ rows: { id: number }[] }> }, name: string, category: string) {
  const code = generatedCode(`CUSTOM_${category.toUpperCase()}`, name);
  const result = await client.query(
    `INSERT INTO document_types (code, name, category)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, active = true
     RETURNING id`,
    [code, name, category],
  );
  return result.rows[0].id;
}

async function syncRequiredDocuments(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  targetType: "profession" | "vehicle_type",
  targetId: number,
  documentTypeIds: number[],
) {
  await client.query("UPDATE required_documents SET required = false WHERE target_type = $1 AND target_id = $2", [targetType, targetId]);
  for (const documentTypeId of documentTypeIds) {
    await client.query(
      `INSERT INTO required_documents (target_type, target_id, document_type_id, required)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (target_type, target_id, document_type_id) DO UPDATE SET required = true`,
      [targetType, targetId, documentTypeId],
    );
  }
}

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
    if (kind === "organization") {
      return json({ error: "Организации создаются только при создании аккаунта подрядчика" }, 400);
    }

    const result = await withTransaction(async (client) => {
      let values = meta.fields.map((field) => body[field] ?? null);

      if (kind === "post") {
        let zoneId = Number(body.zone_id || 0);
        const zoneName = cleanText(body.zone_name);
        if (!zoneId && zoneName) {
          const zoneCode = cleanText(body.zone_code) || generatedCode("ZONE", zoneName);
          const zone = await client.query(
            `INSERT INTO zones (name, code)
             VALUES ($1, $2)
             ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = true
             RETURNING id`,
            [zoneName, zoneCode],
          );
          zoneId = zone.rows[0].id;
        }
        values = [cleanText(body.name), zoneId || null];
      }

      if (values.some((value) => value === null || String(value).trim() === "")) {
        throw Object.assign(new Error("Заполните все поля"), { status: 400 });
      }

      const placeholders = meta.fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = meta.fields.map((field) => `${field} = EXCLUDED.${field}`).join(", ");
      const conflict = kind === "document_type" ? "code" : kind === "zone" ? "code" : "name";
      const conflictValue = values[meta.fields.indexOf(conflict)];
      const before = conflictValue
        ? await client.query(
            `SELECT id, ${meta.fields.join(", ")}
             FROM ${meta.table}
             WHERE ${conflict === "name" ? "lower(name) = lower($1)" : `${conflict} = $1`}
             LIMIT 1`,
            [conflictValue],
          )
        : { rows: [] };
      const saved = await client.query(
        `INSERT INTO ${meta.table} (${meta.fields.join(", ")})
         VALUES (${placeholders})
         ON CONFLICT (${conflict}) DO UPDATE SET ${updates}, active = true
         RETURNING id`,
        values,
      );
      const id = saved.rows[0]?.id as number;
      let documentTypeIds: number[] | undefined;

      if (kind === "profession" || kind === "vehicle_type") {
        const targetType = kind === "profession" ? "profession" : "vehicle_type";
        const category = kind === "profession" ? "employee" : "vehicle";
        documentTypeIds = intArray(body.documentTypeIds);
        for (const newDocumentName of textArray(body.newDocuments)) {
          documentTypeIds.push(await ensureDocument(client, newDocumentName, category));
        }
        documentTypeIds = [...new Set(documentTypeIds)];
        await syncRequiredDocuments(client, targetType, id, documentTypeIds);
      }

      const documentNames = documentTypeIds?.length
        ? await client.query<{ name: string }>("SELECT name FROM document_types WHERE id = ANY($1::int[]) ORDER BY name", [documentTypeIds])
        : { rows: [] };
      await audit(client, user.id, `admin.${kind}.save`, meta.table, id, {
        operation: before.rows[0] ? "update" : "create",
        before: before.rows[0] ?? null,
        name: cleanText(body.name),
        code: cleanText(body.code || body.zone_code),
        category: cleanText(body.category),
        documentTypeIds,
        documentNames: documentNames.rows.map((row) => row.name),
        newDocuments: kind === "profession" || kind === "vehicle_type" ? textArray(body.newDocuments) : undefined,
        zone: kind === "post" ? cleanText(body.zone_name) || body.zone_id : undefined,
      });
      return id;
    });

    return json({ id: result });
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
    const before = await query<{ name?: string; code?: string }>(
      `SELECT name, ${kind === "document_type" || kind === "zone" ? "code" : "NULL AS code"} FROM ${meta.table} WHERE id = $1`,
      [id],
    );
    await query(`UPDATE ${meta.table} SET active = $1 WHERE id = $2`, [active, id]);
    await audit(queryClient, user.id, `admin.${kind}.${active ? "restore" : "disable"}`, meta.table, id, {
      name: before.rows[0]?.name,
      code: before.rows[0]?.code,
      active,
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
