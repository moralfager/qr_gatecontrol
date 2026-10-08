import crypto from "node:crypto";
import process from "node:process";
import { Client } from "pg";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:123@127.0.0.1:5432/gatecontrol";

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return DEFAULT_DATABASE_URL;
}

const databaseUrl = resolveDatabaseUrl();
const parsedUrl = new URL(databaseUrl);
const databaseName = parsedUrl.pathname.replace(/^\//, "") || "gatecontrol";

function adminUrl() {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

function hashPassword(password) {
  const iterations = 260000;
  const salt = crypto.randomBytes(16);
  const digest = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return [
    "pbkdf2_sha256",
    iterations,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

function seedPassword(name, fallback) {
  if (process.env.NODE_ENV === "production" && !process.env[`SEED_${name.toUpperCase()}_PASSWORD`]) {
    throw new Error(`SEED_${name.toUpperCase()}_PASSWORD is required in production`);
  }
  return process.env[`SEED_${name.toUpperCase()}_PASSWORD`] || fallback;
}

const ADMIN_USER = {
  login: process.env.SEED_ADMIN_LOGIN || "admin",
  email: process.env.SEED_ADMIN_EMAIL || "admin@example.local",
  name: process.env.SEED_ADMIN_NAME || "Администратор",
  password: seedPassword("admin", "admin123"),
};
const RESET_ADMIN_PASSWORD = process.env.RESET_ADMIN_PASSWORD === "true";

const DOC_TYPES = [
  ["LETTER", "Письмо", "common"],
  ["PTM", "Удостоверение ПТМ", "employee"],
  ["PB", "Удостоверение по ПБ", "employee"],
  ["PB_OT", "Удостоверение по Б и ОТ", "employee"],
  ["ELEC", "Удостоверение по электробезопасности", "employee"],
  ["HEIGHT", "Удостоверение на верхолазные работы (работы на высоте)", "employee"],
  ["DRIVER_B", "Водительское удостоверение В", "employee"],
  ["DRIVER_C", "Водительское удостоверение С", "employee"],
  ["DRIVER_CE", "Водительское удостоверение СЕ", "employee"],
  ["DRIVER_D", "Водительское удостоверение Д", "employee"],
  ["CRANE", "Удостоверение машиниста крана (крановщика)", "employee"],
  ["DOPOG", "Свидетельство ДОПОГ", "employee"],
  ["CEMENT", "Удостоверение машинист ЦА", "employee"],
  ["PPU", "Удостоверение машинист ППУ", "employee"],
  ["TRACTOR", "Удостоверение тракторист-машинист", "employee"],
  ["TURNER", "Удостоверение токарь", "employee"],
  ["WELDER", "Удостоверение газоэлектросварщика (электросварка, газовая, аргоновая и др.)", "employee"],
  ["DRILLER", "Удостоверение сверловщика", "employee"],
  ["SANITARY", "Санитарная книжка", "employee"],
  ["TECH_CRANE", "Технический паспорт крана", "vehicle"],
  ["DIAG", "Диагностическая карта техосмотра", "vehicle"],
  ["FACTORY_DOCS", "Заводская документация, модель, грузоподъёмность (ПТО и ЧТО)", "vehicle"],
  ["TECH_PASSPORT", "Технический паспорт", "vehicle"],
  ["TANK_PASSPORT", "Паспорт на цистерну", "vehicle"],
  ["DOPOG_VEHICLE", "Свидетельство ДОПОГ на транспортное средство", "vehicle"],
  ["CEMENT_PASSPORT", "Паспорт завода-изготовителя на цементировочный агрегат", "vehicle"],
  ["PPU_PASSPORT", "Паспорт завода-изготовителя на установку", "vehicle"],
  ["BOILER_PASSPORT", "Паспорт на паровой котёл", "vehicle"],
  ["HYDRAULIC", "Протокол гидравлических испытаний", "vehicle"],
];

const PROFESSIONS = [
  ["Электромонтер", ["LETTER", "PTM", "PB", "PB_OT", "ELEC", "HEIGHT"]],
  ["Слесарь КИП и А", ["LETTER", "PTM", "PB", "PB_OT", "ELEC", "HEIGHT"]],
  ["Водитель легкового автомобиля", ["LETTER", "PTM", "PB", "PB_OT", "DRIVER_B"]],
  ["Водитель Автокран", ["LETTER", "PTM", "PB", "PB_OT", "CRANE", "DRIVER_C"]],
  ["Водитель Манипулятор", ["LETTER", "PTM", "PB", "PB_OT", "CRANE", "DRIVER_C"]],
  ["Оператор АЦН", ["LETTER", "PTM", "PB", "PB_OT", "DOPOG", "DRIVER_CE"]],
  ["Машинист ЦА", ["LETTER", "PTM", "PB", "PB_OT", "CEMENT", "DRIVER_C"]],
  ["Машинист ППУ", ["LETTER", "PTM", "PB", "PB_OT", "PPU", "DRIVER_C"]],
  ["Машинист Погрузчика", ["LETTER", "PTM", "PB", "PB_OT", "TRACTOR", "DRIVER_C"]],
  ["Машинист Автогрейдер", ["LETTER", "PTM", "PB", "PB_OT", "TRACTOR", "DRIVER_C"]],
  ["Машинист УДС", ["LETTER", "PTM", "PB", "PB_OT", "TRACTOR", "DRIVER_C"]],
  ["Тягач с площадкой", ["LETTER", "PTM", "PB", "PB_OT", "DRIVER_CE"]],
  ["Метаноловоз", ["LETTER", "PTM", "PB", "PB_OT", "DOPOG", "DRIVER_CE"]],
  ["Водитель автобус", ["LETTER", "PTM", "PB", "PB_OT", "DRIVER_D"]],
  ["Водитель самосвал", ["LETTER", "PTM", "PB", "PB_OT", "DRIVER_C"]],
  ["Водитель Водовоз", ["LETTER", "PTM", "PB", "PB_OT", "DRIVER_CE"]],
  ["Слесарь по ремонту автотранспортных средств", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Механик", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Техник-механика", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Начальник БПО", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Инженер по ОТ и ТБ", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Механик БПО", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Слесарь по ремонту НПО", ["LETTER", "PTM", "PB", "PB_OT"]],
  ["Токарь", ["LETTER", "PTM", "PB", "PB_OT", "TURNER"]],
  ["Плотник", ["LETTER", "PTM", "PB", "PB_OT", "HEIGHT"]],
  ["Разнорабочий", ["LETTER", "PTM", "PB", "PB_OT", "HEIGHT"]],
  ["Газоэлектросварщик", ["LETTER", "PTM", "PB", "PB_OT", "ELEC", "WELDER"]],
  ["Сверловщик", ["LETTER", "PTM", "PB", "PB_OT", "DRILLER"]],
  ["Уборщик помещений", ["LETTER", "PTM", "PB", "PB_OT", "SANITARY"]],
];

const VEHICLE_TYPES = [
  ["Автокран", ["LETTER", "TECH_CRANE", "DIAG", "FACTORY_DOCS"]],
  ["Автобус", ["LETTER", "TECH_PASSPORT", "DIAG"]],
  ["Цементировочный агрегат", ["LETTER", "TECH_PASSPORT", "DIAG", "CEMENT_PASSPORT"]],
  ["АЦН автоцистерна", ["LETTER", "TECH_PASSPORT", "TANK_PASSPORT", "DOPOG_VEHICLE", "DIAG"]],
  ["Метаноловоз", ["LETTER", "TECH_PASSPORT", "TANK_PASSPORT", "DOPOG_VEHICLE", "DIAG"]],
  ["ППУ", ["LETTER", "TECH_CRANE", "DIAG", "PPU_PASSPORT", "BOILER_PASSPORT", "HYDRAULIC"]],
  ["Легковой автомобиль", ["LETTER", "TECH_PASSPORT", "DIAG"]],
  ["Грузовой автомобиль", ["LETTER", "TECH_PASSPORT", "DIAG"]],
];

const LEGACY_SEED_ORGANIZATIONS = [
  "ТОО «ЕмбіМұнайГаз»",
  "ТОО «Varro Operating Group»",
  "АО «Жылыоймунайгаз»",
];

const ZONES = [
  ["Толқын", "TOLQYN"],
  ["Боранкөл", "BORANKOL"],
  ["Прорва", "PRORVA"],
];

const POSTS = [
  ["КПП №1 — Главный въезд", "TOLQYN"],
  ["КПП №2 — Въезд со стороны Нуржанова", "BORANKOL"],
  ["КПП №3 — Складская зона", "PRORVA"],
];

const LEGACY_SEED_LOGINS = ["user", "contractor", "ass", "tb", "guard"];

const APPLICATION_STATUSES = [
  ["draft", "Черновик", 10, false],
  ["submitted", "На согласовании", 20, false],
  ["approved", "Согласована", 30, true],
  ["returned", "На доработке", 40, true],
  ["rejected", "Отклонена", 50, true],
];

const PASS_STATUSES = [
  ["active", "Действует", 10, false],
  ["expired", "Истек", 20, true],
  ["blocked", "Заблокирован", 30, true],
  ["revoked", "Аннулирован", 40, true],
];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  bin TEXT NOT NULL DEFAULT '',
  org_type TEXT NOT NULL DEFAULT 'contractor',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  organization_id INTEGER REFERENCES organizations(id),
  allowed_post_ids INTEGER[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guard_posts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  zone_id INTEGER REFERENCES zones(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'common',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS required_documents (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  document_type_id INTEGER NOT NULL REFERENCES document_types(id),
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id, document_type_id)
);

CREATE TABLE IF NOT EXISTS approval_routes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'parallel',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_route_steps (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES approval_routes(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  department TEXT NOT NULL,
  approver_user_id INTEGER REFERENCES users(id),
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_id, step_order, department)
);

CREATE TABLE IF NOT EXISTS application_statuses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  terminal BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pass_statuses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  terminal BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  organization_id INTEGER REFERENCES organizations(id),
  created_by INTEGER REFERENCES users(id),
  route_id INTEGER REFERENCES approval_routes(id),
  approval_cycle INTEGER NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_zones (
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES zones(id),
  PRIMARY KEY(application_id, zone_id)
);

CREATE TABLE IF NOT EXISTS application_workers (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  iin TEXT NOT NULL,
  validity_from DATE NOT NULL,
  validity_to DATE NOT NULL,
  profession_id INTEGER NOT NULL REFERENCES professions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_vehicles (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  vehicle_type_id INTEGER NOT NULL REFERENCES vehicle_types(id),
  make TEXT NOT NULL,
  plate TEXT NOT NULL,
  trailer TEXT NOT NULL DEFAULT '—',
  validity_from DATE NOT NULL,
  validity_to DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  document_type_id INTEGER NOT NULL REFERENCES document_types(id),
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  expires_at DATE,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_type, subject_id, document_type_id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  route_step_id INTEGER NOT NULL REFERENCES approval_route_steps(id),
  approver_user_id INTEGER REFERENCES users(id),
  department TEXT NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 1,
  decision TEXT NOT NULL DEFAULT 'pending',
  comment TEXT NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id, route_step_id, cycle)
);

CREATE TABLE IF NOT EXISTS application_history (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL DEFAULT 0,
  action TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id),
  status_from TEXT,
  status_to TEXT,
  comment TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passes (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  number TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  approved_by TEXT NOT NULL DEFAULT '',
  qr_payload TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS pass_zones (
  pass_id INTEGER NOT NULL REFERENCES passes(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES zones(id),
  PRIMARY KEY(pass_id, zone_id)
);

CREATE TABLE IF NOT EXISTS access_events (
  id SERIAL PRIMARY KEY,
  pass_id INTEGER REFERENCES passes(id),
  guard_id INTEGER REFERENCES users(id),
  default_post_id INTEGER REFERENCES guard_posts(id),
  final_post_id INTEGER REFERENCES guard_posts(id),
  post_changed BOOLEAN NOT NULL DEFAULT false,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approvals(decision, department);
CREATE INDEX IF NOT EXISTS idx_application_history_application ON application_history(application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_passes_token ON passes(token);
CREATE INDEX IF NOT EXISTS idx_access_events_created ON access_events(created_at);
`;

async function ensureDatabase() {
  const client = new Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (!exists.rowCount) {
      if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
        throw new Error(`Unsafe database name: ${databaseName}`);
      }
      await client.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Created database ${databaseName}`);
    }
  } finally {
    await client.end();
  }
}

async function upsertName(client, table, name, extra = {}) {
  const keys = ["name", ...Object.keys(extra)];
  const values = [name, ...Object.values(extra)];
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const updates = Object.keys(extra).map((key, i) => `${key} = $${i + 2}`).join(", ");
  const updateClause = updates ? `DO UPDATE SET ${updates}, active = true` : "DO UPDATE SET active = true";
  const result = await client.query(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})
     ON CONFLICT (name) ${updateClause}
     RETURNING id`,
    values,
  );
  return result.rows[0].id;
}

async function upsertDocType(client, [code, name, category]) {
  const result = await client.query(
    `INSERT INTO document_types (code, name, category)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, active = true
     RETURNING id`,
    [code, name, category],
  );
  return result.rows[0].id;
}

async function upsertStatus(client, table, [code, name, sortOrder, terminal]) {
  await client.query(
    `INSERT INTO ${table} (code, name, sort_order, terminal)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       sort_order = EXCLUDED.sort_order,
       terminal = EXCLUDED.terminal,
       active = true`,
    [code, name, sortOrder, terminal],
  );
}

async function seed(client) {
  const docIds = new Map();
  for (const doc of DOC_TYPES) {
    docIds.set(doc[0], await upsertDocType(client, doc));
  }

  for (const status of APPLICATION_STATUSES) {
    await upsertStatus(client, "application_statuses", status);
  }

  for (const status of PASS_STATUSES) {
    await upsertStatus(client, "pass_statuses", status);
  }

  const zoneIds = new Map();
  for (const [name, code] of ZONES) {
    const result = await client.query(
      `INSERT INTO zones (name, code) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = true
       RETURNING id`,
      [name, code],
    );
    zoneIds.set(code, result.rows[0].id);
  }

  for (const [name, zoneCode] of POSTS) {
    await upsertName(client, "guard_posts", name, { zone_id: zoneIds.get(zoneCode) });
  }

  for (const [name, docs] of PROFESSIONS) {
    const professionId = await upsertName(client, "professions", name);
    for (const code of docs) {
      await client.query(
        `INSERT INTO required_documents (target_type, target_id, document_type_id)
         VALUES ('profession', $1, $2)
         ON CONFLICT (target_type, target_id, document_type_id) DO UPDATE SET required = true`,
        [professionId, docIds.get(code)],
      );
    }
  }

  for (const [name, docs] of VEHICLE_TYPES) {
    const typeId = await upsertName(client, "vehicle_types", name);
    for (const code of docs) {
      await client.query(
        `INSERT INTO required_documents (target_type, target_id, document_type_id)
         VALUES ('vehicle_type', $1, $2)
         ON CONFLICT (target_type, target_id, document_type_id) DO UPDATE SET required = true`,
        [typeId, docIds.get(code)],
      );
    }
  }

  const legacyUsers = await client.query(
    "SELECT id FROM users WHERE login = ANY($1::text[]) AND email LIKE '%@example.local'",
    [LEGACY_SEED_LOGINS],
  );
  const legacyUserIds = legacyUsers.rows.map((row) => row.id);
  if (legacyUserIds.length) {
    await client.query("UPDATE applications SET created_by = NULL WHERE created_by = ANY($1::int[])", [legacyUserIds]);
    await client.query("UPDATE approvals SET approver_user_id = NULL WHERE approver_user_id = ANY($1::int[])", [legacyUserIds]);
    await client.query("UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = ANY($1::int[])", [legacyUserIds]);
    await client.query("DELETE FROM audit_logs WHERE user_id = ANY($1::int[])", [legacyUserIds]);
    await client.query("DELETE FROM access_events WHERE guard_id = ANY($1::int[])", [legacyUserIds]);
    await client.query("DELETE FROM notifications WHERE user_id = ANY($1::int[])", [legacyUserIds]);
    await client.query("DELETE FROM users WHERE id = ANY($1::int[])", [legacyUserIds]);
  }

  const adminResult = await client.query(
    `INSERT INTO users (login, email, name, password_hash, role, organization_id, department, allowed_post_ids)
     VALUES ($1, $2, $3, $4, 'admin', NULL, NULL, '{}')
     ON CONFLICT (login) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       password_hash = CASE WHEN $5::boolean THEN EXCLUDED.password_hash ELSE users.password_hash END,
       role = 'admin',
       organization_id = NULL,
       department = NULL,
       allowed_post_ids = '{}',
       active = true
     RETURNING id`,
    [
      ADMIN_USER.login,
      ADMIN_USER.email,
      ADMIN_USER.name,
      hashPassword(ADMIN_USER.password),
      RESET_ADMIN_PASSWORD,
    ],
  );
  await client.query(
    `DELETE FROM organizations o
     WHERE o.name = ANY($1::text[])
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id)
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.organization_id = o.id)`,
    [LEGACY_SEED_ORGANIZATIONS],
  );

  const route = await client.query(
    `INSERT INTO approval_routes (name, mode)
     VALUES ('АСС + ТБ параллельно', 'parallel')
     ON CONFLICT (name) DO UPDATE SET mode = 'parallel', active = true
     RETURNING id`,
  );
  const routeId = route.rows[0].id;
  const steps = [
    [1, "АСС"],
    [1, "ТБ"],
  ];
  for (const [order, department] of steps) {
    await client.query(
      `INSERT INTO approval_route_steps (route_id, step_order, department, approver_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (route_id, step_order, department)
       DO UPDATE SET approver_user_id = EXCLUDED.approver_user_id, required = true`,
      [routeId, order, department, null],
    );
  }

  const sequentialRoute = await client.query(
    `INSERT INTO approval_routes (name, mode)
     VALUES ('АСС затем ТБ', 'sequential')
     ON CONFLICT (name) DO UPDATE SET mode = 'sequential', active = true
     RETURNING id`,
  );
  const sequentialRouteId = sequentialRoute.rows[0].id;
  const sequentialSteps = [
    [1, "АСС"],
    [2, "ТБ"],
  ];
  for (const [order, department] of sequentialSteps) {
    await client.query(
      `INSERT INTO approval_route_steps (route_id, step_order, department, approver_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (route_id, step_order, department)
       DO UPDATE SET approver_user_id = EXCLUDED.approver_user_id, required = true`,
      [sequentialRouteId, order, department, null],
    );
  }
  return adminResult.rows[0].id;
}

async function main() {
  await ensureDatabase();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(SCHEMA_SQL);
    await client.query("ALTER TABLE applications ADD COLUMN IF NOT EXISTS approval_cycle INTEGER NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE approvals ADD COLUMN IF NOT EXISTS cycle INTEGER NOT NULL DEFAULT 1");
    await client.query("CREATE INDEX IF NOT EXISTS idx_approvals_application_cycle ON approvals(application_id, cycle)");
    await client.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approvals_application_id_route_step_id_key'
  ) THEN
    ALTER TABLE approvals DROP CONSTRAINT approvals_application_id_route_step_id_key;
  END IF;
END $$;
`);
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS approvals_application_route_step_cycle_idx ON approvals(application_id, route_step_id, cycle)");
    await client.query("UPDATE applications SET approval_cycle = 1 WHERE approval_cycle = 0 AND EXISTS (SELECT 1 FROM approvals WHERE approvals.application_id = applications.id)");
    await client.query(`
INSERT INTO application_history (application_id, cycle, action, actor_user_id, status_from, status_to, comment, details, created_at)
SELECT a.id, a.approval_cycle, 'application.submit', a.created_by, NULL, 'submitted', a.comment,
       jsonb_build_object('number', a.number, 'backfilled', true),
       COALESCE(a.submitted_at, a.created_at)
FROM applications a
WHERE a.approval_cycle > 0
  AND NOT EXISTS (
    SELECT 1 FROM application_history ah
    WHERE ah.application_id = a.id AND ah.action IN ('application.submit', 'application.resubmit')
  )
`);
    await client.query(`
INSERT INTO application_history (application_id, cycle, action, actor_user_id, status_from, status_to, comment, details, created_at)
SELECT ap.application_id, ap.cycle, 'approval.' || ap.decision, ap.approver_user_id, 'submitted',
       CASE WHEN ap.decision IN ('returned', 'rejected') THEN ap.decision ELSE 'submitted' END,
       ap.comment,
       jsonb_build_object('approvalId', ap.id, 'department', ap.department, 'backfilled', true),
       COALESCE(ap.decided_at, ap.created_at)
FROM approvals ap
WHERE ap.decision <> 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM application_history ah
    WHERE ah.application_id = ap.application_id
      AND ah.details ->> 'approvalId' = ap.id::text
  )
`);
    await client.query(`
INSERT INTO application_history (application_id, cycle, action, actor_user_id, status_from, status_to, comment, details, created_at)
SELECT a.id, a.approval_cycle, 'application.approved', NULL, 'submitted', 'approved', '',
       jsonb_build_object('number', a.number, 'backfilled', true),
       COALESCE(a.decided_at, a.updated_at)
FROM applications a
WHERE a.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM application_history ah
    WHERE ah.application_id = a.id AND ah.action = 'application.approved'
  )
`);
    await seed(client);
    await client.query("COMMIT");
    console.log(`Database ${databaseName} is ready`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
