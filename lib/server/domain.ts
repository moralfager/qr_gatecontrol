import crypto from "node:crypto";
import type pg from "pg";
import { query } from "./db";
import type { CurrentUser } from "./auth";

export type AppClient = {
  query: (text: string, params?: unknown[]) => Promise<pg.QueryResult<pg.QueryResultRow>>;
};

export function appBaseUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

export async function audit(
  client: AppClient,
  userId: number | null,
  action: string,
  entityType: string,
  entityId?: number | null,
  details: Record<string, unknown> = {},
) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, action, entityType, entityId ?? null, JSON.stringify(details)],
  );
}

export async function applicationHistory(
  client: AppClient,
  applicationId: number,
  cycle: number,
  action: string,
  actorUserId: number | null,
  statusFrom: string | null,
  statusTo: string | null,
  comment = "",
  details: Record<string, unknown> = {},
) {
  await client.query(
    `INSERT INTO application_history (application_id, cycle, action, actor_user_id, status_from, status_to, comment, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [applicationId, cycle, action, actorUserId, statusFrom, statusTo, comment, JSON.stringify(details)],
  );
}

export async function queueNotification(
  client: AppClient,
  userId: number | null,
  email: string,
  subject: string,
  body: string,
) {
  await client.query(
    `INSERT INTO notifications (user_id, email, subject, body)
     VALUES ($1, $2, $3, $4)`,
    [userId, email, subject, body],
  );
}

export async function nextApplicationNumber(client: AppClient) {
  const year = new Date().getFullYear();
  const result = await client.query(
    "SELECT COUNT(*)::int AS count FROM applications WHERE number LIKE $1",
    [`З-${year}-%`],
  );
  return `З-${year}-${String((result.rows[0]?.count ?? 0) + 1).padStart(4, "0")}`;
}

export async function nextPassNumber(client: AppClient, subjectType: "worker" | "vehicle") {
  const year = new Date().getFullYear();
  const prefix = subjectType === "worker" ? "Р" : "ATC";
  const result = await client.query(
    "SELECT COUNT(*)::int AS count FROM passes WHERE number LIKE $1",
    [`${prefix}-${year}-%`],
  );
  return `${prefix}-${year}-${String((result.rows[0]?.count ?? 0) + 1).padStart(5, "0")}`;
}

export function makeToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function getDictionaries() {
  const [professions, vehicleTypes, zones, documentTypes, organizations, posts] = await Promise.all([
    query(
      `SELECT p.id, p.name, p.active, COUNT(rd.id)::int AS doc_count
       FROM professions p
       LEFT JOIN required_documents rd ON rd.target_type = 'profession' AND rd.target_id = p.id
       GROUP BY p.id
       ORDER BY p.name`,
    ),
    query(
      `SELECT vt.id, vt.name, vt.active, COUNT(rd.id)::int AS doc_count
       FROM vehicle_types vt
       LEFT JOIN required_documents rd ON rd.target_type = 'vehicle_type' AND rd.target_id = vt.id
       GROUP BY vt.id
       ORDER BY vt.name`,
    ),
    query("SELECT id, name, code, active FROM zones ORDER BY name"),
    query("SELECT id, code, name, category, active FROM document_types ORDER BY category, name"),
    query("SELECT id, name, bin, org_type, active FROM organizations ORDER BY name"),
    query(
      `SELECT gp.id, gp.name, gp.zone_id, z.name AS zone_name, gp.active
       FROM guard_posts gp
       LEFT JOIN zones z ON z.id = gp.zone_id
       ORDER BY gp.name`,
    ),
  ]);

  const docRules = await query(
    `SELECT rd.target_type, rd.target_id, dt.id, dt.code, dt.name
     FROM required_documents rd
     JOIN document_types dt ON dt.id = rd.document_type_id
     WHERE dt.active = true
     ORDER BY rd.id`,
  );

  return {
    professions: professions.rows,
    vehicleTypes: vehicleTypes.rows,
    zones: zones.rows,
    documentTypes: documentTypes.rows,
    organizations: organizations.rows,
    posts: posts.rows,
    requiredDocuments: docRules.rows,
  };
}

export async function getRequiredDocuments(
  client: AppClient,
  targetType: "profession" | "vehicle_type",
  targetId: number,
) {
  const result = await client.query(
    `SELECT dt.id, dt.code, dt.name
     FROM required_documents rd
     JOIN document_types dt ON dt.id = rd.document_type_id
     WHERE rd.target_type = $1 AND rd.target_id = $2 AND rd.required = true AND dt.active = true
     ORDER BY rd.id`,
    [targetType, targetId],
  );
  return result.rows;
}

export async function defaultRoute(client: AppClient) {
  const result = await client.query(
    `SELECT * FROM approval_routes WHERE active = true ORDER BY CASE mode WHEN 'parallel' THEN 0 ELSE 1 END, id LIMIT 1`,
  );
  return result.rows[0] ?? null;
}

export async function createApprovals(client: AppClient, applicationId: number, routeId: number, cycle: number) {
  const steps = await client.query(
    "SELECT * FROM approval_route_steps WHERE route_id = $1 AND required = true ORDER BY step_order, id",
    [routeId],
  );
  for (const step of steps.rows) {
    await client.query(
      `INSERT INTO approvals (application_id, route_step_id, approver_user_id, department, cycle)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (application_id, route_step_id, cycle) DO NOTHING`,
      [applicationId, step.id, step.approver_user_id, step.department, cycle],
    );
  }
}

export async function notifyPendingApprovers(client: AppClient, applicationId: number) {
  const approvals = await currentPendingApprovals(client, applicationId);
  const app = await client.query("SELECT number FROM applications WHERE id = $1", [applicationId]);
  for (const approval of approvals) {
    const users = await client.query(
      `SELECT id, email FROM users
       WHERE active = true AND role = 'approver' AND (id = $1 OR department = $2)`,
      [approval.approver_user_id, approval.department],
    );
    for (const user of users.rows) {
      await queueNotification(
        client,
        user.id,
        user.email,
        `Заявка ${app.rows[0]?.number ?? applicationId} ожидает согласования`,
        `Поступила заявка на согласование по направлению ${approval.department}.`,
      );
    }
  }
}

export async function currentPendingApprovals(client: AppClient, applicationId: number) {
  const routeResult = await client.query(
    `SELECT r.mode, a.approval_cycle
     FROM applications a
     JOIN approval_routes r ON r.id = a.route_id
     WHERE a.id = $1`,
    [applicationId],
  );
  const mode = routeResult.rows[0]?.mode ?? "parallel";
  const cycle = routeResult.rows[0]?.approval_cycle ?? 0;
  if (mode === "parallel") {
    const result = await client.query(
      "SELECT * FROM approvals WHERE application_id = $1 AND cycle = $2 AND decision = 'pending' ORDER BY id",
      [applicationId, cycle],
    );
    return result.rows;
  }
  const orderResult = await client.query(
    "SELECT MIN(ars.step_order) AS step_order FROM approvals ap JOIN approval_route_steps ars ON ars.id = ap.route_step_id WHERE ap.application_id = $1 AND ap.cycle = $2 AND ap.decision = 'pending'",
    [applicationId, cycle],
  );
  if (!orderResult.rows[0]?.step_order) return [];
  const result = await client.query(
    `SELECT ap.*
     FROM approvals ap
     JOIN approval_route_steps ars ON ars.id = ap.route_step_id
     WHERE ap.application_id = $1 AND ap.cycle = $2 AND ap.decision = 'pending' AND ars.step_order = $3`,
    [applicationId, cycle, orderResult.rows[0].step_order],
  );
  return result.rows;
}

export async function canDecideApproval(client: AppClient, user: CurrentUser, approvalId: number) {
  const approvalResult = await client.query(
    `SELECT ap.*, a.status AS application_status, a.approval_cycle, r.mode, ars.step_order
     FROM approvals ap
     JOIN applications a ON a.id = ap.application_id
     JOIN approval_route_steps ars ON ars.id = ap.route_step_id
     JOIN approval_routes r ON r.id = a.route_id
     WHERE ap.id = $1`,
    [approvalId],
  );
  const approval = approvalResult.rows[0];
  if (!approval || approval.decision !== "pending" || approval.application_status !== "submitted" || approval.cycle !== approval.approval_cycle) {
    return { ok: false, approval };
  }
  if (user.role !== "admin") {
    const ownStep = approval.approver_user_id === user.id || approval.department === user.department;
    if (!ownStep) return { ok: false, approval };
  }
  if (approval.mode !== "parallel") {
    const earlier = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM approvals ap
       JOIN approval_route_steps ars ON ars.id = ap.route_step_id
       WHERE ap.application_id = $1 AND ap.cycle = $2 AND ap.decision = 'pending' AND ars.step_order < $3`,
      [approval.application_id, approval.cycle, approval.step_order],
    );
    if (earlier.rows[0]?.count) return { ok: false, approval };
  }
  return { ok: true, approval };
}

export async function issuePasses(client: AppClient, applicationId: number, approvedBy: string) {
  const workers = await client.query(
    "SELECT * FROM application_workers WHERE application_id = $1 ORDER BY id",
    [applicationId],
  );
  const vehicles = await client.query(
    "SELECT * FROM application_vehicles WHERE application_id = $1 ORDER BY id",
    [applicationId],
  );
  const zones = await client.query(
    "SELECT zone_id FROM application_zones WHERE application_id = $1 ORDER BY zone_id",
    [applicationId],
  );
  const passZones = zones.rows as { zone_id: number }[];
  const approvedBySummary = await approvalSummary(client, applicationId, approvedBy);

  for (const worker of workers.rows) {
    await issueOnePass(client, applicationId, "worker", worker.id, worker.validity_from, worker.validity_to, approvedBySummary, passZones);
  }
  for (const vehicle of vehicles.rows) {
    await issueOnePass(client, applicationId, "vehicle", vehicle.id, vehicle.validity_from, vehicle.validity_to, approvedBySummary, passZones);
  }
}

async function approvalSummary(client: AppClient, applicationId: number, fallback: string) {
  const result = await client.query(
    `SELECT ap.department, COALESCE(u.name, ap.department) AS approver_name, ap.decided_at
     FROM approvals ap
     JOIN applications a ON a.id = ap.application_id AND a.approval_cycle = ap.cycle
     LEFT JOIN users u ON u.id = ap.approver_user_id
     WHERE ap.application_id = $1 AND ap.decision = 'approved'
     ORDER BY ap.decided_at, ap.id`,
    [applicationId],
  );
  const values = result.rows.map((row) => {
    const decidedAt = row.decided_at ? new Date(row.decided_at as string | Date).toLocaleString("ru-RU") : "";
    return `${row.department}: ${row.approver_name}${decidedAt ? `, ${decidedAt}` : ""}`;
  });
  return values.length ? values.join("; ") : fallback;
}

async function issueOnePass(
  client: AppClient,
  applicationId: number,
  subjectType: "worker" | "vehicle",
  subjectId: number,
  validFrom: string,
  validTo: string,
  approvedBy: string,
  zones: { zone_id: number }[],
) {
  const exists = await client.query("SELECT id FROM passes WHERE subject_type = $1 AND subject_id = $2", [subjectType, subjectId]);
  if (exists.rowCount) {
    await client.query("UPDATE passes SET approved_by = $1 WHERE id = $2", [approvedBy, exists.rows[0].id]);
    return;
  }
  const number = await nextPassNumber(client, subjectType);
  const token = makeToken();
  const qrPayload = `${appBaseUrl()}/guard?token=${encodeURIComponent(token)}`;
  const pass = await client.query(
    `INSERT INTO passes (application_id, subject_type, subject_id, number, token, valid_from, valid_to, approved_by, qr_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [applicationId, subjectType, subjectId, number, token, validFrom, validTo, approvedBy, qrPayload],
  );
  for (const zone of zones) {
    await client.query(
      "INSERT INTO pass_zones (pass_id, zone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [pass.rows[0].id, zone.zone_id],
    );
  }
}

export async function applicationSummaryWhere(user: CurrentUser) {
  if (user.role === "admin" || user.role === "approver") {
    return { where: "true", params: [] as unknown[] };
  }
  if (user.role === "contractor") {
    return { where: "a.created_by = $1 OR a.organization_id = $2", params: [user.id, user.organization_id] as unknown[] };
  }
  return { where: "false", params: [] as unknown[] };
}

export async function getApplicationDetails(applicationId: number, user: CurrentUser) {
  const access = await applicationSummaryWhere(user);
  const appResult = await query(
    `SELECT a.*, o.name AS organization_name, r.name AS route_name, r.mode AS route_mode
     FROM applications a
     LEFT JOIN organizations o ON o.id = a.organization_id
     LEFT JOIN approval_routes r ON r.id = a.route_id
     WHERE a.id = $${access.params.length + 1} AND (${access.where})`,
    [...access.params, applicationId],
  );
  const application = appResult.rows[0];
  if (!application) return null;
  const [zones, workers, vehicles, documents, approvals, passes, history] = await Promise.all([
    query(
      `SELECT z.* FROM application_zones az JOIN zones z ON z.id = az.zone_id WHERE az.application_id = $1 ORDER BY z.name`,
      [applicationId],
    ),
    query(
      `SELECT aw.*, p.name AS profession_name
       FROM application_workers aw
       JOIN professions p ON p.id = aw.profession_id
       WHERE aw.application_id = $1 ORDER BY aw.id`,
      [applicationId],
    ),
    query(
      `SELECT av.*, vt.name AS vehicle_type_name
       FROM application_vehicles av
       JOIN vehicle_types vt ON vt.id = av.vehicle_type_id
       WHERE av.application_id = $1 ORDER BY av.id`,
      [applicationId],
    ),
    query(
      `SELECT d.*, dt.code AS document_code, dt.name AS document_name
       FROM documents d
       JOIN document_types dt ON dt.id = d.document_type_id
       WHERE d.application_id = $1 ORDER BY d.id`,
      [applicationId],
    ),
    query(
      `SELECT ap.*, u.name AS approver_name, ars.step_order
       FROM approvals ap
       JOIN approval_route_steps ars ON ars.id = ap.route_step_id
       LEFT JOIN users u ON u.id = ap.approver_user_id
       WHERE ap.application_id = $1 ORDER BY ap.cycle, ars.step_order, ap.id`,
      [applicationId],
    ),
    query(
      `SELECT p.*, string_agg(z.name, ', ' ORDER BY z.name) AS zones
       FROM passes p
       LEFT JOIN pass_zones pz ON pz.pass_id = p.id
       LEFT JOIN zones z ON z.id = pz.zone_id
       WHERE p.application_id = $1
       GROUP BY p.id
       ORDER BY p.id`,
      [applicationId],
    ),
    query(
      `SELECT ah.*, u.name AS actor_name
       FROM application_history ah
       LEFT JOIN users u ON u.id = ah.actor_user_id
       WHERE ah.application_id = $1
       ORDER BY ah.created_at, ah.id`,
      [applicationId],
    ),
  ]);
  const decoratedApprovals = [];
  const queryClient = { query: (text: string, params?: unknown[]) => query(text, params) };
  for (const approval of approvals.rows) {
    const decision = await canDecideApproval(queryClient, user, Number(approval.id));
    decoratedApprovals.push({ ...approval, can_decide: decision.ok });
  }

  return {
    application,
    zones: zones.rows,
    workers: workers.rows,
    vehicles: vehicles.rows,
    documents: documents.rows,
    approvals: decoratedApprovals,
    passes: passes.rows,
    history: history.rows,
  };
}
