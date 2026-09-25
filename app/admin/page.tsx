import Link from "next/link";
import { query } from "../../lib/server/db";
import {
  AdminCard,
  AdminSectionCard,
  AdminTable,
  AdminTableHead,
  AdminTableBody,
  AdminTh,
  AdminTd,
} from "./lib";

export const dynamic = "force-dynamic";

type StatRow = {
  submitted_count: string;
  active_pass_count: string;
  user_count: string;
  today_event_count: string;
  active_post_count: string;
};

type AuditRow = {
  id: number;
  created_at: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export default async function AdminOverviewPage() {
  const [statsResult, auditResult] = await Promise.all([
    query<StatRow>(
      `SELECT
         (SELECT COUNT(*) FROM applications WHERE status = 'submitted') AS submitted_count,
         (SELECT COUNT(*) FROM passes WHERE status = 'active' AND valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE) AS active_pass_count,
         (SELECT COUNT(*) FROM users WHERE active = true) AS user_count,
         (SELECT COUNT(*) FROM access_events WHERE created_at::date = CURRENT_DATE) AS today_event_count,
         (SELECT COUNT(*) FROM guard_posts WHERE active = true) AS active_post_count`,
    ),
    query<AuditRow>(
      `SELECT al.id, al.created_at, u.name AS user_name, al.action, al.entity_type, al.entity_id
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 5`,
    ),
  ]);

  const stats = statsResult.rows[0];
  const cards = [
    { label: "Заявок на согласовании", value: stats.submitted_count, sub: "ожидают решения согласующих" },
    { label: "Действующих пропусков", value: stats.active_pass_count, sub: "по текущей дате PostgreSQL" },
    { label: "Пользователей", value: stats.user_count, sub: "активные учетные записи" },
    { label: "Событий сегодня", value: stats.today_event_count, sub: "сканирования и решения КПП" },
    { label: "Постов охраны", value: stats.active_post_count, sub: "активные посты" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Сводка</h1>
        <p className="mt-1 text-zinc-600">Основные показатели системы пропусков.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <AdminCard key={card.label} label={card.label} value={card.value} sub={card.sub} />
        ))}
      </div>

      <AdminSectionCard
        title="Последние события в журнале"
        action={<Link href="/admin/audit" className="text-sm font-medium text-[#032c4f] hover:underline">Весь журнал</Link>}
      >
        <AdminTable>
          <AdminTableHead>
            <AdminTh>Время</AdminTh>
            <AdminTh>Пользователь</AdminTh>
            <AdminTh>Действие</AdminTh>
            <AdminTh>Объект</AdminTh>
          </AdminTableHead>
          <AdminTableBody>
            {auditResult.rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Журнал пока пуст</td></tr>
            ) : auditResult.rows.map((row) => (
              <tr key={row.id}>
                <AdminTd>{formatDate(row.created_at)}</AdminTd>
                <AdminTd>{row.user_name || "-"}</AdminTd>
                <AdminTd>{row.action}</AdminTd>
                <AdminTd className="text-zinc-500">{row.entity_type}{row.entity_id ? ` #${row.entity_id}` : ""}</AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
      </AdminSectionCard>
    </div>
  );
}
