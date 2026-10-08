import { query } from "../../../lib/server/db";
import {
  AdminSectionCard,
  AdminTable,
  AdminTableHead,
  AdminTableBody,
  AdminTh,
  AdminTd,
} from "../lib";

export const dynamic = "force-dynamic";

type AuditRow = {
  row_id: string;
  created_at: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
};

type SearchParams = {
  user?: string;
  action?: string;
  q?: string;
};

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Вход в систему",
  "admin.user.create": "Создание пользователя",
  "admin.user.restore": "Включение пользователя",
  "admin.user.disable": "Отключение пользователя",
  "admin.profession.save": "Сохранение профессии",
  "admin.vehicle_type.save": "Сохранение вида автотранспорта",
  "admin.document_type.save": "Сохранение типа документа",
  "admin.zone.save": "Сохранение зоны",
  "admin.post.save": "Сохранение поста охраны",
  "admin.profession.restore": "Включение профессии",
  "admin.profession.disable": "Отключение профессии",
  "admin.vehicle_type.restore": "Включение вида автотранспорта",
  "admin.vehicle_type.disable": "Отключение вида автотранспорта",
  "admin.document_type.restore": "Включение типа документа",
  "admin.document_type.disable": "Отключение типа документа",
  "admin.zone.restore": "Включение зоны",
  "admin.zone.disable": "Отключение зоны",
  "admin.post.restore": "Включение поста охраны",
  "admin.post.disable": "Отключение поста охраны",
  "application.submit": "Отправка заявки",
  "application.draft": "Сохранение черновика",
  "application.resubmit": "Повторная отправка заявки",
  "application.approved": "Заявка согласована",
  "document.upload": "Загрузка документа",
  "document.replace": "Замена документа",
  "approval.approved": "Согласование заявки",
  "approval.returned": "Возврат на доработку",
  "approval.rejected": "Отклонение заявки",
  "guard.scan.invalid": "Неуспешное сканирование",
  "guard.passage_confirmed": "Подтверждение прохода",
  "guard.passage_denied": "Отказ в проходе",
  "guard.invalid_attempt": "Недействительная попытка",
  "access.scan": "Сканирование пропуска",
  "access.passage_confirmed": "Проход через пост",
  "access.passage_denied": "Отказ на посту",
  "access.invalid_attempt": "Недействительная попытка на посту",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  approver: "Согласующий",
  contractor: "Подрядчик",
  guard: "Охранник",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Согласована",
  returned: "На доработке",
  rejected: "Отклонена",
};

const SUBJECT_LABELS: Record<string, string> = {
  worker: "Работник",
  vehicle: "Автотранспорт",
};

const RESULT_LABELS: Record<string, string> = {
  valid: "Действителен",
  invalid: "Недействителен",
  allowed: "Проход разрешен",
  denied: "Отказ",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function formatBytes(value: unknown) {
  const size = Number(value || 0);
  if (!size) return "";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function asText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value);
}

function statusText(value: unknown) {
  const text = asText(value);
  return text ? STATUS_LABELS[text] ?? text : "—";
}

type DetailItem = {
  label: string;
  value: string;
};

function detailItems(row: AuditRow) {
  const details = row.details ?? {};
  const items: DetailItem[] = [];
  const add = (label: string, value: unknown, mapper?: Record<string, string>) => {
    const raw = asText(value);
    if (!raw) return;
    items.push({ label, value: mapper?.[raw] ?? raw });
  };

  if (row.action.startsWith("admin.user.")) {
    add("Аккаунт", details.name);
    add("Логин", details.login);
    add("Роль", details.role, ROLE_LABELS);
    add("Организация", details.organization);
    add("Подразделение", details.department);
    add("Посты", details.allowedPostIds);
    add("Активен", details.active);
  } else if (row.action.startsWith("admin.")) {
    add("Операция", details.operation === "create" ? "Создание" : details.operation === "update" ? "Изменение" : "");
    add("Название", details.name);
    add("Код", details.code);
    add("Категория", details.category);
    add("Зона", details.zone);
    add("Документы", details.documentNames);
    add("Новые документы", details.newDocuments);
  } else if (row.action.startsWith("application.")) {
    add("Заявка", details.number);
    add("Тип", details.type === "workers" ? "Работники" : details.type === "vehicles" ? "Автотранспорт" : details.type);
    add("Статус", details.previousStatus || details.status ? `${statusText(details.previousStatus)} → ${statusText(details.status)}` : "");
    add("Цикл", details.cycle);
    add("Состав", [
      details.workersCount !== undefined ? `работники: ${details.workersCount}` : "",
      details.vehiclesCount !== undefined ? `ТС: ${details.vehiclesCount}` : "",
    ]);
    add("Комментарий", details.comment);
  } else if (row.action.startsWith("document.")) {
    add("Заявка", details.applicationNumber);
    add("Объект", details.subjectLabel);
    add("Тип", details.subjectType, SUBJECT_LABELS);
    add("Документ", details.documentName);
    add("Файл", details.fileName);
    add("Размер", formatBytes(details.sizeBytes));
    add("Предыдущий файл", details.previousFileName);
  } else if (row.action.startsWith("approval.")) {
    add("Заявка", details.applicationNumber);
    add("Этап", details.department);
    add("Решение", details.decision === "approved" ? "Согласовано" : details.decision === "returned" ? "Доработка" : details.decision === "rejected" ? "Отклонено" : details.decision);
    add("Комментарий", details.comment);
  } else if (row.action.startsWith("guard.") || row.action.startsWith("access.")) {
    add("Пропуск", details.pass);
    add("Пост", details.finalPost ?? details.post);
    add("Пост по умолчанию", details.defaultPost);
    add("Результат", details.result, RESULT_LABELS);
    add("Комментарий", details.comment);
    add("QR/номер", details.raw);
  } else if (row.action === "auth.login") {
    add("Логин", details.login);
    add("ФИО", details.name);
    add("Роль", details.role, ROLE_LABELS);
    add("Организация", details.organization);
    add("Подразделение", details.department);
  }

  if (items.length) return items;
  if (Object.keys(details).length) return Object.entries(details).map(([label, value]) => ({ label, value: asText(value) })).filter((item) => item.value);
  return [{ label: "Объект", value: row.entity_id ? `${row.entity_type} #${row.entity_id}` : row.entity_type }];
}

function DetailList({ row }: { row: AuditRow }) {
  return (
    <dl className="flex flex-wrap gap-2">
      {detailItems(row).map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
          <dt className="text-[11px] font-medium uppercase text-zinc-400">{item.label}</dt>
          <dd className="mt-0.5 max-w-[320px] break-words text-xs text-zinc-700">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function valueOf(params: Record<string, string | string[] | undefined>, key: keyof SearchParams) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const userFilter = valueOf(params, "user").trim();
  const actionFilter = valueOf(params, "action").trim();
  const queryFilter = valueOf(params, "q").trim();

  const where: string[] = [];
  const values: unknown[] = [];
  if (userFilter) {
    values.push(`%${userFilter}%`);
    where.push(`COALESCE(user_name, '') ILIKE $${values.length}`);
  }
  if (actionFilter) {
    values.push(actionFilter);
    where.push(`action = $${values.length}`);
  }
  if (queryFilter) {
    values.push(`%${queryFilter}%`);
    where.push(`(action ILIKE $${values.length} OR COALESCE(user_name, '') ILIKE $${values.length} OR COALESCE(details::text, '') ILIKE $${values.length})`);
  }

  const result = await query<AuditRow>(
    `SELECT *
     FROM (
       SELECT
         'audit-' || al.id AS row_id,
         al.created_at,
         u.name AS user_name,
         al.action,
         al.entity_type,
         al.entity_id,
         al.details
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       UNION ALL
       SELECT
         'access-' || ae.id AS row_id,
         ae.created_at,
         u.name AS user_name,
         'access.' || ae.event_type AS action,
         'access_event' AS entity_type,
         ae.id AS entity_id,
         jsonb_build_object(
           'pass', p.number,
           'defaultPost', dgp.name,
           'finalPost', gp.name,
           'postChanged', ae.post_changed,
           'result', ae.result,
           'comment', ae.comment
         ) AS details
       FROM access_events ae
       LEFT JOIN users u ON u.id = ae.guard_id
       LEFT JOIN passes p ON p.id = ae.pass_id
       LEFT JOIN guard_posts gp ON gp.id = ae.final_post_id
       LEFT JOIN guard_posts dgp ON dgp.id = ae.default_post_id
     ) events
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT 300`,
    values,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Журнал аудита</h1>
        <p className="mt-1 text-zinc-600">События системы, изменения справочников и проходы через посты охраны.</p>
      </div>

      <AdminSectionCard title="Фильтр">
        <form className="grid gap-3 md:grid-cols-4">
          <input name="user" defaultValue={userFilter} className="input" placeholder="Пользователь" />
          <select name="action" defaultValue={actionFilter} className="input">
            <option value="">Все действия</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input name="q" defaultValue={queryFilter} className="input" placeholder="Поиск по деталям" />
          <button type="submit" className="rounded-lg bg-[#032c4f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042a4a]">
            Найти
          </button>
        </form>
      </AdminSectionCard>

      <AdminSectionCard title="Записи журнала">
        <AdminTable>
          <AdminTableHead>
            <AdminTh>Время</AdminTh>
            <AdminTh>Пользователь</AdminTh>
            <AdminTh>Действие</AdminTh>
            <AdminTh>Детали</AdminTh>
          </AdminTableHead>
          <AdminTableBody>
            {result.rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Журнал пока пуст</td></tr>
            ) : result.rows.map((row) => (
              <tr key={row.row_id}>
                <AdminTd>{formatDate(row.created_at)}</AdminTd>
                <AdminTd>{row.user_name || "-"}</AdminTd>
                <AdminTd>{ACTION_LABELS[row.action] ?? row.action}</AdminTd>
                <AdminTd><DetailList row={row} /></AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
        <p className="mt-4 text-sm text-zinc-500">Показаны последние {result.rows.length} записей.</p>
      </AdminSectionCard>
    </div>
  );
}
