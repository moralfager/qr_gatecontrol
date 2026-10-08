import { NextRequest } from "next/server";
import { requireUser, hashPassword } from "../../../../lib/server/auth";
import { query, withTransaction } from "../../../../lib/server/db";
import { audit } from "../../../../lib/server/domain";
import { errorResponse, json } from "../../../../lib/server/http";

const ROLES = new Set(["admin", "approver", "contractor", "guard"]);
const APPROVER_DEPARTMENTS = new Set(["АСС", "ТБ"]);

type UserRow = {
  id: number;
  name: string;
  email: string;
  login: string;
  role: string;
  department: string | null;
  organization_id: number | null;
  organization_name: string | null;
  allowed_post_ids: number[];
  active: boolean;
  last_active: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanLogin(value: unknown) {
  return cleanText(value).toLowerCase();
}

function intArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
}

async function listData() {
  const [users, organizations, posts] = await Promise.all([
    query<UserRow>(
      `SELECT u.id, u.name, u.email, u.login, u.role, u.department, u.organization_id,
              o.name AS organization_name, u.allowed_post_ids, u.active,
              (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.user_id = u.id) AS last_active
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       ORDER BY u.active DESC, u.role, u.name`,
    ),
    query("SELECT id, name, org_type, active FROM organizations ORDER BY active DESC, name"),
    query(
      `SELECT gp.id, gp.name, z.name AS zone_name, gp.active
       FROM guard_posts gp
       LEFT JOIN zones z ON z.id = gp.zone_id
       ORDER BY gp.active DESC, gp.name`,
    ),
  ]);

  return { users: users.rows, organizations: organizations.rows, posts: posts.rows };
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, ["admin"]);
    return json(await listData());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUser(request, ["admin"]);
    const body = await request.json();

    const login = cleanLogin(body.login);
    const email = cleanLogin(body.email);
    const name = cleanText(body.name);
    const password = String(body.password ?? "");
    const role = cleanText(body.role);
    const organizationName = cleanText(body.organizationName);
    const organizationBin = cleanText(body.organizationBin);
    let organizationId = Number(body.organizationId || 0) || null;
    const department = role === "approver" ? cleanText(body.department) : null;
    const allowedPostIds = role === "guard" ? intArray(body.allowedPostIds) : [];

    if (!login || !email || !name || !password || !role) {
      return json({ error: "Заполните ФИО, логин, email, пароль и роль" }, 400);
    }
    if (!ROLES.has(role)) {
      return json({ error: "Некорректная роль" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Пароль должен быть не короче 6 символов" }, 400);
    }
    if (role === "approver" && (!department || !APPROVER_DEPARTMENTS.has(department))) {
      return json({ error: "Для согласующего выберите подразделение АСС или ТБ" }, 400);
    }
    if (role === "contractor" && !organizationName) {
      return json({ error: "Для подрядчика укажите название организации" }, 400);
    }
    const created = await withTransaction(async (client) => {
      let organizationForAudit: string | null = null;
      if (role === "contractor") {
        const existingOrg = await client.query(
          "SELECT id, name FROM organizations WHERE lower(name) = lower($1) LIMIT 1",
          [organizationName],
        );
        if (existingOrg.rows[0]) {
          const contractor = await client.query(
            "SELECT id, login FROM users WHERE organization_id = $1 AND role = 'contractor' AND active = true LIMIT 1",
            [existingOrg.rows[0].id],
          );
          if (contractor.rows[0]) {
            throw Object.assign(new Error(`У организации уже есть активный подрядчик: ${contractor.rows[0].login}`), { status: 409 });
          }
        }
        const org = await client.query(
          `INSERT INTO organizations (name, bin, org_type, active)
           VALUES ($1, $2, 'contractor', true)
           ON CONFLICT (name) DO UPDATE SET
             bin = EXCLUDED.bin,
             org_type = 'contractor',
             active = true
           RETURNING id, name`,
          [organizationName, organizationBin],
        );
        organizationId = org.rows[0].id;
        organizationForAudit = org.rows[0].name;
      } else if (organizationId) {
        const org = await client.query("SELECT id, name FROM organizations WHERE id = $1 AND active = true", [organizationId]);
        if (!org.rowCount) {
          throw Object.assign(new Error("Организация не найдена или отключена"), { status: 400 });
        }
        organizationForAudit = org.rows[0].name;
      }
      if (allowedPostIds.length) {
        const posts = await client.query("SELECT COUNT(*)::int AS count FROM guard_posts WHERE id = ANY($1::int[]) AND active = true", [allowedPostIds]);
        if (posts.rows[0]?.count !== allowedPostIds.length) {
          throw Object.assign(new Error("Один из постов охраны не найден или отключен"), { status: 400 });
        }
      }

      const result = await client.query(
        `INSERT INTO users (login, email, name, password_hash, role, organization_id, department, allowed_post_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [login, email, name, hashPassword(password), role, organizationId, department, allowedPostIds],
      );
      const userId = result.rows[0].id as number;
      await audit(client, admin.id, "admin.user.create", "user", userId, {
        name,
        login,
        email,
        role,
        department,
        organization: organizationForAudit,
        allowedPostIds,
      });
      return userId;
    });

    return json({ id: created }, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      return json({ error: "Логин или email уже занят" }, 409);
    }
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireUser(request, ["admin"]);
    const body = await request.json();
    const id = Number(body.id || 0);
    const active = Boolean(body.active);
    if (!id) return json({ error: "Некорректный пользователь" }, 400);
    if (id === admin.id && !active) {
      return json({ error: "Нельзя отключить свою учетную запись" }, 400);
    }
    const target = await query<{ login: string; name: string; role: string; organization_id: number | null }>(
      "SELECT login, name, role, organization_id FROM users WHERE id = $1",
      [id],
    );
    await query("UPDATE users SET active = $1 WHERE id = $2", [active, id]);
    if (target.rows[0]?.role === "contractor" && target.rows[0].organization_id) {
      await query("UPDATE organizations SET active = $1 WHERE id = $2", [active, target.rows[0].organization_id]);
    }
    await audit(queryClient, admin.id, `admin.user.${active ? "restore" : "disable"}`, "user", id, {
      login: target.rows[0]?.login,
      name: target.rows[0]?.name,
      role: target.rows[0]?.role,
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
