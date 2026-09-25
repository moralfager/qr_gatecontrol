import { query } from "../../../lib/server/db";
import {
  AdminSectionCard,
  AdminTable,
  AdminTableHead,
  AdminTableBody,
  AdminTh,
  AdminTd,
  AdminBadge,
} from "../lib";

export const dynamic = "force-dynamic";

type UserRow = {
  id: number;
  name: string;
  email: string;
  login: string;
  role: string;
  department: string | null;
  organization_name: string | null;
  active: boolean;
  last_active: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  approver: "Согласующий",
  contractor: "Подрядчик",
  guard: "Охранник",
  user: "Пользователь",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "-";
}

export default async function AdminUsersPage() {
  const result = await query<UserRow>(
    `SELECT u.id, u.name, u.email, u.login, u.role, u.department, o.name AS organization_name, u.active,
            (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.user_id = u.id) AS last_active
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     ORDER BY u.active DESC, u.role, u.name`,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Пользователи и роли</h1>
        <p className="mt-1 text-zinc-600">Учетные записи, роли и привязка к организации или подразделению.</p>
      </div>

      <AdminSectionCard title="Список пользователей">
        <AdminTable>
          <AdminTableHead>
            <AdminTh>ФИО</AdminTh>
            <AdminTh>Логин / Email</AdminTh>
            <AdminTh>Роль</AdminTh>
            <AdminTh>Организация / подразделение</AdminTh>
            <AdminTh>Последняя активность</AdminTh>
            <AdminTh>Статус</AdminTh>
          </AdminTableHead>
          <AdminTableBody>
            {result.rows.map((user) => (
              <tr key={user.id}>
                <AdminTd className="font-medium">{user.name}</AdminTd>
                <AdminTd>
                  <span className="font-mono text-xs text-zinc-500">{user.login}</span>
                  <br />
                  {user.email}
                </AdminTd>
                <AdminTd><AdminBadge green={user.role === "admin"}>{ROLE_LABELS[user.role] ?? user.role}</AdminBadge></AdminTd>
                <AdminTd>{user.organization_name || user.department || "-"}</AdminTd>
                <AdminTd className="text-zinc-500">{formatDate(user.last_active)}</AdminTd>
                <AdminTd>{user.active ? <AdminBadge green>Активен</AdminBadge> : <AdminBadge>Отключен</AdminBadge>}</AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
        <p className="mt-4 text-sm text-zinc-500">Всего пользователей: {result.rows.length}.</p>
      </AdminSectionCard>
    </div>
  );
}
