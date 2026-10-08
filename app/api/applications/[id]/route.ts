import { NextRequest } from "next/server";
import type pg from "pg";
import { requireUser } from "../../../../lib/server/auth";
import { withTransaction } from "../../../../lib/server/db";
import {
  applicationHistory,
  audit,
  createApprovals,
  defaultRoute,
  getApplicationDetails,
  notifyPendingApprovers,
} from "../../../../lib/server/domain";
import { saveUpload } from "../../../../lib/server/files";
import { errorResponse, json } from "../../../../lib/server/http";

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

function numericId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const details = await getApplicationDetails(Number(id), user);
    if (!details) return json({ error: "Заявка не найдена" }, 404);
    return json(details);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, ["admin", "approver", "contractor"]);
    const { id } = await context.params;
    const applicationId = Number(id);
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
    if (payload.type === "workers" && payload.vehicles?.length) {
      errors.push("В заявке на работников нельзя добавлять автотранспорт.");
    }
    if (payload.type === "vehicles" && payload.workers?.length) {
      errors.push("В заявке на автотранспорт нельзя добавлять работников.");
    }
    const canChooseOrganization = user.role === "admin" || (user.role === "approver" && user.department === "ТБ");
    if (user.role === "approver" && user.department !== "ТБ") {
      return json({ error: "Редактирование заявки доступно только согласующему ТБ" }, 403);
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
      const appResult = await client.query(
        "SELECT * FROM applications WHERE id = $1 FOR UPDATE",
        [applicationId],
      );
      const application = appResult.rows[0];
      if (!application) {
        throw Object.assign(new Error("Заявка не найдена"), { status: 404 });
      }
      const canEdit =
        user.role === "admin" ||
        (user.role === "approver" && user.department === "ТБ") ||
        application.created_by === user.id ||
        (user.role === "contractor" && application.organization_id === user.organization_id);
      if (!canEdit) {
        throw Object.assign(new Error("Недостаточно прав для изменения заявки"), { status: 403 });
      }
      if (!["draft", "returned"].includes(application.status)) {
        throw Object.assign(new Error("Заявку можно менять только в статусе Черновик или На доработке"), { status: 400 });
      }
      if (payload.type !== application.type) {
        throw Object.assign(new Error("Тип заявки нельзя менять при редактировании. Создайте отдельную заявку для другого типа пропуска."), { status: 400 });
      }

      const organization = await client.query("SELECT id FROM organizations WHERE id = $1 AND active = true", [organizationId]);
      if (!organization.rowCount) {
        throw Object.assign(new Error("Организация не найдена или отключена"), { status: 400 });
      }
      const route = payload.action === "submit" ? await defaultRoute(client) : null;
      if (payload.action === "submit" && !route) {
        throw Object.assign(new Error("Не настроен маршрут согласования"), { status: 400 });
      }

      await client.query("DELETE FROM application_zones WHERE application_id = $1", [applicationId]);
      for (const zoneId of payload.zoneIds) {
        await client.query(
          "INSERT INTO application_zones (application_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [applicationId, zoneId],
        );
      }

      const missingDocs: string[] = [];
      const keptWorkerIds = await syncWorkers(client, applicationId, application.number, payload.workers, formData, user.id, payload.action, missingDocs);
      const keptVehicleIds = await syncVehicles(client, applicationId, application.number, payload.vehicles, formData, user.id, payload.action, missingDocs);
      await deleteRemovedSubjects(client, applicationId, "worker", "application_workers", keptWorkerIds);
      await deleteRemovedSubjects(client, applicationId, "vehicle", "application_vehicles", keptVehicleIds);
      if (missingDocs.length) {
        throw Object.assign(new Error(`Не хватает документов:\n${missingDocs.join("\n")}`), { status: 400 });
      }

      const nextCycle = payload.action === "submit" ? Number(application.approval_cycle ?? 0) + 1 : Number(application.approval_cycle ?? 0);
      const nextStatus = payload.action === "submit" ? "submitted" : "draft";
      const updated = await client.query(
        `UPDATE applications
         SET type = $1,
             status = $2,
             organization_id = $3,
             route_id = COALESCE($4, route_id),
             approval_cycle = $5,
             comment = $6,
             submitted_at = CASE WHEN $7 = 'submit' THEN now() ELSE submitted_at END,
             decided_at = CASE WHEN $7 = 'submit' THEN NULL ELSE decided_at END,
             updated_at = now()
         WHERE id = $8
         RETURNING *`,
        [
          payload.type,
          nextStatus,
          organizationId,
          route?.id ?? null,
          nextCycle,
          payload.comment ?? "",
          payload.action,
          applicationId,
        ],
      );

      if (payload.action === "submit" && route) {
        await createApprovals(client, applicationId, route.id, nextCycle);
        await notifyPendingApprovers(client, applicationId);
      }

      const action = payload.action === "submit" && application.status === "returned" ? "application.resubmit" : `application.${payload.action}`;
      await applicationHistory(
        client,
        applicationId,
        nextCycle,
        action,
        user.id,
        application.status,
        nextStatus,
        payload.comment ?? "",
        { number: application.number },
      );
      await audit(client, user.id, action, "application", applicationId, {
        number: application.number,
        type: payload.type,
        previousStatus: application.status,
        status: nextStatus,
        cycle: nextCycle,
        organizationId,
        zones: payload.zoneIds,
        workersCount: payload.workers.length,
        vehiclesCount: payload.vehicles.length,
        comment: payload.comment ?? "",
      });

      return updated.rows[0];
    });
    return json({ application: result });
  } catch (error) {
    return errorResponse(error);
  }
}

async function syncWorkers(
  client: pg.PoolClient,
  applicationId: number,
  applicationNumber: string,
  workers: Payload["workers"],
  formData: FormData,
  userId: number,
  action: "draft" | "submit",
  missingDocs: string[],
) {
  const keptIds: number[] = [];
  for (const worker of workers) {
    const existingId = numericId(worker.id);
    const subject =
      existingId
        ? await client.query(
            `UPDATE application_workers
             SET full_name = $1, position = $2, iin = $3, validity_from = $4, validity_to = $5, profession_id = $6
             WHERE id = $7 AND application_id = $8
             RETURNING id`,
            [worker.fullName.trim(), worker.position.trim(), worker.iin.trim(), worker.validityFrom, worker.validityTo, worker.professionId, existingId, applicationId],
          )
        : await client.query(
            `INSERT INTO application_workers
               (application_id, full_name, position, iin, validity_from, validity_to, profession_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [applicationId, worker.fullName.trim(), worker.position.trim(), worker.iin.trim(), worker.validityFrom, worker.validityTo, worker.professionId],
          );
    const subjectId = subject.rows[0]?.id as number | undefined;
    if (!subjectId) continue;
    keptIds.push(subjectId);
    await syncRequiredDocuments(client, applicationId, applicationNumber, "worker", subjectId, worker.id, worker.fullName, worker.professionId, formData, userId, action, missingDocs);
  }
  return keptIds;
}

async function syncVehicles(
  client: pg.PoolClient,
  applicationId: number,
  applicationNumber: string,
  vehicles: Payload["vehicles"],
  formData: FormData,
  userId: number,
  action: "draft" | "submit",
  missingDocs: string[],
) {
  const keptIds: number[] = [];
  for (const vehicle of vehicles) {
    const existingId = numericId(vehicle.id);
    const subject =
      existingId
        ? await client.query(
            `UPDATE application_vehicles
             SET vehicle_type_id = $1, make = $2, plate = $3, trailer = $4, validity_from = $5, validity_to = $6
             WHERE id = $7 AND application_id = $8
             RETURNING id`,
            [vehicle.typeId, vehicle.make.trim(), vehicle.plate.trim().toUpperCase(), vehicle.trailer?.trim() || "—", vehicle.validityFrom, vehicle.validityTo, existingId, applicationId],
          )
        : await client.query(
            `INSERT INTO application_vehicles
               (application_id, vehicle_type_id, make, plate, trailer, validity_from, validity_to)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [applicationId, vehicle.typeId, vehicle.make.trim(), vehicle.plate.trim().toUpperCase(), vehicle.trailer?.trim() || "—", vehicle.validityFrom, vehicle.validityTo],
          );
    const subjectId = subject.rows[0]?.id as number | undefined;
    if (!subjectId) continue;
    keptIds.push(subjectId);
    await syncRequiredDocuments(client, applicationId, applicationNumber, "vehicle", subjectId, vehicle.id, vehicle.plate, vehicle.typeId, formData, userId, action, missingDocs);
  }
  return keptIds;
}

async function syncRequiredDocuments(
  client: pg.PoolClient,
  applicationId: number,
  applicationNumber: string,
  subjectType: "worker" | "vehicle",
  subjectId: number,
  rowId: string,
  subjectLabel: string,
  targetId: number,
  formData: FormData,
  userId: number,
  action: "draft" | "submit",
  missingDocs: string[],
) {
  const docs = await client.query(
    `SELECT dt.id, dt.code, dt.name
     FROM required_documents rd
     JOIN document_types dt ON dt.id = rd.document_type_id
     WHERE rd.target_type = $1 AND rd.target_id = $2 AND rd.required = true AND dt.active = true
     ORDER BY rd.id`,
    [subjectType === "worker" ? "profession" : "vehicle_type", targetId],
  );
  for (const doc of docs.rows) {
    const file = asFile(formData.get(`${subjectType}:${rowId}:${doc.code}`));
    if (file) {
      await saveDocument(client, applicationId, subjectType, subjectId, doc.id, file, userId, {
        applicationNumber,
        documentName: doc.name,
        subjectLabel,
      });
      continue;
    }
    const existing = await client.query(
      "SELECT id FROM documents WHERE application_id = $1 AND subject_type = $2 AND subject_id = $3 AND document_type_id = $4",
      [applicationId, subjectType, subjectId, doc.id],
    );
    if (!existing.rowCount && action === "submit") {
      missingDocs.push(`${subjectLabel}: ${doc.name}`);
    }
  }
}

async function deleteRemovedSubjects(
  client: pg.PoolClient,
  applicationId: number,
  subjectType: "worker" | "vehicle",
  tableName: "application_workers" | "application_vehicles",
  keptIds: number[],
) {
  if (!keptIds.length) {
    await client.query("DELETE FROM documents WHERE application_id = $1 AND subject_type = $2", [applicationId, subjectType]);
    await client.query(`DELETE FROM ${tableName} WHERE application_id = $1`, [applicationId]);
    return;
  }
  await client.query(
    "DELETE FROM documents WHERE application_id = $1 AND subject_type = $2 AND NOT (subject_id = ANY($3::int[]))",
    [applicationId, subjectType, keptIds],
  );
  await client.query(
    `DELETE FROM ${tableName} WHERE application_id = $1 AND NOT (id = ANY($2::int[]))`,
    [applicationId, keptIds],
  );
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
