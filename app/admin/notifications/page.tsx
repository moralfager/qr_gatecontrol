import { query } from "../../../lib/server/db";
import {
  AdminBadge,
  AdminSectionCard,
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh,
} from "../lib";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: number;
  email: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  user_name: string | null;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "-";
}

export default async function AdminNotificationsPage() {
  const result = await query<NotificationRow>(
    `SELECT n.*, u.name AS user_name
     FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id
     ORDER BY n.created_at DESC
     LIMIT 100`,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Уведомления</h1>
        <p className="mt-1 text-zinc-600">Очередь уведомлений, созданных системой при заявках и согласованиях.</p>
      </div>

      <AdminSectionCard title="Очередь уведомлений">
        <AdminTable>
          <AdminTableHead>
            <AdminTh>Создано</AdminTh>
            <AdminTh>Получатель</AdminTh>
            <AdminTh>Тема</AdminTh>
            <AdminTh>Статус</AdminTh>
            <AdminTh>Отправлено</AdminTh>
          </AdminTableHead>
          <AdminTableBody>
            {result.rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Уведомлений пока нет</td></tr>
            ) : result.rows.map((notification) => (
              <tr key={notification.id}>
                <AdminTd>{formatDate(notification.created_at)}</AdminTd>
                <AdminTd>
                  {notification.user_name || "-"}
                  <br />
                  <span className="text-xs text-zinc-500">{notification.email}</span>
                </AdminTd>
                <AdminTd>
                  <span className="font-medium text-zinc-800">{notification.subject}</span>
                  <br />
                  <span className="text-xs text-zinc-500">{notification.body}</span>
                </AdminTd>
                <AdminTd><AdminBadge green={notification.status === "sent"}>{notification.status}</AdminBadge></AdminTd>
                <AdminTd>{formatDate(notification.sent_at)}</AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
      </AdminSectionCard>
    </div>
  );
}
