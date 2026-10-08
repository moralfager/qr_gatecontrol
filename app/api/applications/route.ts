import { NextRequest } from "next/server";
import type pg from "pg";
import { withTransaction, query } from "../../../lib/server/db";
import { requireUser } from "../../../lib/server/auth";
import {
  audit,
  applicationHistory,
  createApprovals,
  defaultRoute,
  nextApplicationNumber,
  notifyPendingApprovers,
} from "../../../lib/server/domain";
import { errorResponse, json } from "../../../lib/server/http";
import { saveUpload } from "../../../lib/server/files";

export const runtime = "nodejs";

type Payload = {
  type: "workers" | "vehicles";
  action: "draft" | "submit";
  organizationId?: number | null;
  zoneIds: number[];
  comment?: string;
  workers: {
    id: string;
    fullName: string;
    position: string;
    iin: string;
    validityFrom: string;
    validityTo: string;
    professionId: number;
  }[];
  vehicles: {
    id: string;
    make: string;
    plate: string;
    trailer: string;
    validityFrom: string;
    validityTo: string;
    typeId: number;
  }[];
};

function asFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === "string") return null;
  return value.size > 0 ? value : null;
}

function required(value: unknown, label: string, errors: string[]) {
  if (value === null || value === undefined || String(value).trim() === "") {
    errors.push(label);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "approver", "contractor"]);
    const params: unknown[] = [];
    let where = "true";
    if (user.role === "contractor") {
      params.push(user.id, user.organization_id);
      where = "(a.created_by = $1 OR a.organization_id = $2)";
    }
    const result = await query(
      `SELECT a.*, o.name AS organization_name,
              COUNT(DISTINCT aw.id)::int AS workers_count,
              COUNT(DISTINCT av.id)::int AS vehicles_count,
              string_agg(DISTINCT z.name, ', ' ORDER BY z.name) AS zones
       FROM applications a
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN application_workers aw ON aw.application_id = a.id
       LEFT JOIN application_vehicles av ON av.application_id = a.id
       LEFT JOIN application_zones az ON az.application_id = a.id
       LEFT JOIN zones z ON z.id = az.zone_id
       WHERE ${where}
       GROUP BY a.id, o.name
       ORDER BY a.id DESC`,
      params,
    );
    return json({ applications: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, ["admin", "approver", "contractor"]);
    const formData = await request.formData();
    const rawPayload = formData.get("payload");
    if (typeof rawPayload !== "string") {
      return json({ error: "Не переданы данные заявки" }, 400);
    }
    const payload = JSON.parse(rawPayload) as Payload;
    const errors: string[] = [];
    if (!Array.isArray(payload.workers)) payload.workers = [];
    if (!Array.isArray(payload.vehicles)) payload.vehicles = [];
    if (!["workers", "vehicles"].includes(payload.type)) {
      errors.push("Тип заявки должен быть: Работники или Автотранспорт.");
    }
    if (payload.type === "workers" && payload.vehicles.length) {
      errors.push("В заявке на работников нельзя добавлять автотранспорт.");
    }
    if (payload.type === "vehicles" && payload.workers.length) {
      errors.push("В заявке на автотранспорт нельзя добавлять работников.");
    }
    const canChooseOrganization = user.role === "admin" || (user.role === "approver" && user.department === "ТБ");
    if (user.role === "approver" && user.department !== "ТБ") {
      return json({ error: "Создание заявок доступно только согласующему ТБ" }, 403);
    }
    const organizationId = canChooseOrganization ? Number(payload.organizationId || 0) : user.organization_id;

    if (!organizationId) errors.push("Выберите организацию.");
    if (!payload.zoneIds?.length) errors.push("Выберите хотя бы одну территорию.");
    if (!payload.workers?.length && !payload.vehicles?.length) errors.push("Добавьте работников или автотранспорт.");
    for (const [index, worker] of payload.workers.entries()) {
      required(worker.fullName, `Работник ${index + 1}: ФИО обязательно.`, errors);
      required(worker.position, `Работник ${index + 1}: должность обязательна.`, errors);
      required(worker.iin, `Работник ${index + 1}: ИИН обязателен.`, errors);
      required(worker.validityFrom, `Работник ${index + 1}: дата начала обязательна.`, errors);
      required(worker.validityTo, `Работник ${index + 1}: дата окончания обязательна.`, errors);
    }
    for (const [index, vehicle] of payload.vehicles.entries()) {
      required(vehicle.make, `ТС ${index + 1}: марка обязательна.`, errors);
      required(vehicle.plate, `ТС ${index + 1}: госномер обязателен.`, errors);
      required(vehicle.validityFrom, `ТС ${index + 1}: дата начала обязательна.`, errors);
      required(vehicle.validityTo, `ТС ${index + 1}: дата окончания обязательна.`, errors);
    }
    if (errors.length) return json({ error: errors.join("\n") }, 400);

    const result = await withTransaction(async (client) => {
      const organization = await client.query("SELECT id FROM organizations WHERE id = $1 AND active = true", [organizationId]);
      if (!organization.rowCount) {
        throw Object.assign(new Error("Организация не найдена или отключена"), { status: 400 });
      }
      const route = payload.action === "submit" ? await defaultRoute(client) : null;
      if (payload.action === "submit" && !route) {
        throw Object.assign(new Error("Не настроен маршрут согласования"), { status: 400 });
      }
      const number = await nextApplicationNumber(client);
      const approvalCycle = payload.action === "submit" ? 1 : 0;
      const application = await client.query(
        `INSERT INTO applications (number, type, status, organization_id, created_by, route_id, approval_cycle, comment, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${payload.action === "submit" ? "now()" : "NULL"})
         RETURNING *`,
        [
          number,
          payload.type,
          payload.action === "submit" ? "submitted" : "draft",
          organizationId,
          user.id,
          route?.id ?? null,
          approvalCycle,
          payload.comment ?? "",
        ],
      );
      const applicationId = application.rows[0].id as number;

      for (const zoneId of payload.zoneIds) {
        await client.query(
          "INSERT INTO application_zones (application_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [applicationId, zoneId],
        );
      }

      const missingDocs: string[] = [];
      for (const worker of payload.workers) {
        const inserted = await client.query(
          `INSERT INTO application_workers
             (application_id, full_name, position, iin, validity_from, validity_to, profession_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            applicationId,
            worker.fullName.trim(),
            worker.position.trim(),
            worker.iin.trim(),
            worker.validityFrom,
            worker.validityTo,
            worker.professionId,
          ],
        );
        const subjectId = inserted.rows[0].id as number;
        const docs = await client.query(
          `SELECT dt.id, dt.code, dt.name
           FROM required_documents rd
           JOIN document_types dt ON dt.id = rd.document_type_id
           WHERE rd.target_type = 'profession' AND rd.target_id = $1 AND rd.required = true AND dt.active = true
           ORDER BY rd.id`,
          [worker.professionId],
        );
        for (const doc of docs.rows) {
          const file = asFile(formData.get(`worker:${worker.id}:${doc.code}`));
          if (!file) {
            if (payload.action === "submit") missingDocs.push(`${worker.fullName}: ${doc.name}`);
            continue;
          }
          await saveDocument(client, applicationId, "worker", subjectId, doc.id, file, user.id, {
            applicationNumber: number,
            documentName: doc.name,
            subjectLabel: worker.fullName,
          });
        }
      }

      for (const vehicle of payload.vehicles) {
        const inserted = await client.query(
          `INSERT INTO application_vehicles
             (application_id, vehicle_type_id, make, plate, trailer, validity_from, validity_to)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            applicationId,
            vehicle.typeId,
            vehicle.make.trim(),
            vehicle.plate.trim().toUpperCase(),
            vehicle.trailer?.trim() || "—",
            vehicle.validityFrom,
            vehicle.validityTo,
          ],
        );
        const subjectId = inserted.rows[0].id as number;
        const docs = await client.query(
          `SELECT dt.id, dt.code, dt.name
           FROM required_documents rd
           JOIN document_types dt ON dt.id = rd.document_type_id
           WHERE rd.target_type = 'vehicle_type' AND rd.target_id = $1 AND rd.required = true AND dt.active = true
           ORDER BY rd.id`,
          [vehicle.typeId],
        );
        for (const doc of docs.rows) {
          const file = asFile(formData.get(`vehicle:${vehicle.id}:${doc.code}`));
          if (!file) {
            if (payload.action === "submit") missingDocs.push(`${vehicle.plate}: ${doc.name}`);
            continue;
          }
          await saveDocument(client, applicationId, "vehicle", subjectId, doc.id, file, user.id, {
            applicationNumber: number,
            documentName: doc.name,
            subjectLabel: vehicle.plate,
          });
        }
      }

      if (missingDocs.length) {
        throw Object.assign(new Error(`Не хватает документов:\n${missingDocs.join("\n")}`), { status: 400 });
      }
      if (payload.action === "submit" && route) {
        await createApprovals(client, applicationId, route.id, approvalCycle);
        await notifyPendingApprovers(client, applicationId);
      }
      await applicationHistory(
        client,
        applicationId,
        approvalCycle,
        payload.action === "submit" ? "application.submit" : "application.draft",
        user.id,
        null,
        payload.action === "submit" ? "submitted" : "draft",
        payload.comment ?? "",
        { number },
      );
      await audit(client, user.id, payload.action === "submit" ? "application.submit" : "application.draft", "application", applicationId, {
        number,
        type: payload.type,
        status: payload.action === "submit" ? "submitted" : "draft",
        cycle: approvalCycle,
        organizationId,
        zones: payload.zoneIds,
        workersCount: payload.workers.length,
        vehiclesCount: payload.vehicles.length,
        comment: payload.comment ?? "",
      });
      return application.rows[0];
    });
    return json({ application: result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

async function saveDocument(
  client: pg.PoolClient,
  applicationId: number,
  subjectType: "worker" | "vehicle",
  subjectId: number,
  documentTypeId: number,
  file: File,
  userId: number,
  context: {
    applicationNumber: string;
    documentName: string;
    subjectLabel: string;
  },
) {
  const existing = await client.query<{ id: number; original_name: string; size_bytes: number }>(
    `SELECT id, original_name, size_bytes
     FROM documents
     WHERE application_id = $1 AND subject_type = $2 AND subject_id = $3 AND document_type_id = $4
     FOR UPDATE`,
    [applicationId, subjectType, subjectId, documentTypeId],
  );
  const saved = await saveUpload(applicationId, file);
  const document = await client.query<{ id: number }>(
    `INSERT INTO documents
       (application_id, subject_type, subject_id, document_type_id, original_name, stored_path, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (subject_type, subject_id, document_type_id)
     DO UPDATE SET original_name = EXCLUDED.original_name,
                   stored_path = EXCLUDED.stored_path,
                   mime_type = EXCLUDED.mime_type,
                   size_bytes = EXCLUDED.size_bytes,
                   uploaded_by = EXCLUDED.uploaded_by,
                   created_at = now()
     RETURNING id`,
    [
      applicationId,
      subjectType,
      subjectId,
      documentTypeId,
      saved.originalName,
      saved.storedPath,
      saved.mimeType,
      saved.sizeBytes,
      userId,
    ],
  );
  const previous = existing.rows[0];
  await audit(client, userId, previous ? "document.replace" : "document.upload", "document", document.rows[0]?.id ?? previous?.id, {
    applicationId,
    applicationNumber: context.applicationNumber,
    subjectType,
    subjectLabel: context.subjectLabel,
    documentTypeId,
    documentName: context.documentName,
    fileName: saved.originalName,
    sizeBytes: saved.sizeBytes,
    previousFileName: previous?.original_name,
    previousSizeBytes: previous?.size_bytes,
  });
}
