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
  detail: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export default async function AdminAuditPage() {
  const result = await query<AuditRow>(
    `SELECT *
     FROM (
       SELECT
         'audit-' || al.id AS row_id,
         al.created_at,
         u.name AS user_name,
         al.action,
         al.entity_type || COALESCE(' #' || al.entity_id::text, '') || ' ' || al.details::text AS detail
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       UNION ALL
       SELECT
         'access-' || ae.id AS row_id,
         ae.created_at,
         u.name AS user_name,
         'access.' || ae.event_type AS action,
         COALESCE(p.number, 'без пропуска') || ' / ' || COALESCE(gp.name, 'пост не выбран') ||
           CASE WHEN ae.comment <> '' THEN ' / ' || ae.comment ELSE '' END AS detail
       FROM access_events ae
       LEFT JOIN users u ON u.id = ae.guard_id
       LEFT JOIN passes p ON p.id = ae.pass_id
       LEFT JOIN guard_posts gp ON gp.id = ae.final_post_id
     ) events
     ORDER BY created_at DESC
     LIMIT 200`,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Журнал аудита</h1>
        <p className="mt-1 text-zinc-600">События в системе и проходы через посты охраны.</p>
      </div>

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
                <AdminTd>{row.action}</AdminTd>
                <AdminTd className="text-zinc-500">{row.detail || "-"}</AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
        <p className="mt-4 text-sm text-zinc-500">Показаны последние {result.rows.length} записей.</p>
      </AdminSectionCard>
    </div>
  );
}
