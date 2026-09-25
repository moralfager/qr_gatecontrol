import { query } from "../../../lib/server/db";

export const dynamic = "force-dynamic";

type ReportStats = {
  active_passes: string;
  expired_passes: string;
  total_events: string;
  changed_posts: string;
  denied_events: string;
  submitted_apps: string;
};

type PostRow = {
  post_name: string;
  events_count: string;
  allowed_count: string;
  denied_count: string;
};

export default async function AdminReportsPage() {
  const [statsResult, postsResult] = await Promise.all([
    query<ReportStats>(
      `SELECT
         (SELECT COUNT(*) FROM passes WHERE status = 'active' AND valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE) AS active_passes,
         (SELECT COUNT(*) FROM passes WHERE valid_to < CURRENT_DATE) AS expired_passes,
         (SELECT COUNT(*) FROM access_events) AS total_events,
         (SELECT COUNT(*) FROM access_events WHERE post_changed = true) AS changed_posts,
         (SELECT COUNT(*) FROM access_events WHERE result IN ('denied', 'invalid')) AS denied_events,
         (SELECT COUNT(*) FROM applications WHERE status = 'submitted') AS submitted_apps`,
    ),
    query<PostRow>(
      `SELECT gp.name AS post_name,
              COUNT(ae.id)::text AS events_count,
              COUNT(ae.id) FILTER (WHERE ae.result = 'allowed')::text AS allowed_count,
              COUNT(ae.id) FILTER (WHERE ae.result IN ('denied', 'invalid'))::text AS denied_count
       FROM guard_posts gp
       LEFT JOIN access_events ae ON ae.final_post_id = gp.id
       GROUP BY gp.id
       ORDER BY gp.name`,
    ),
  ]);

  const stats = statsResult.rows[0];
  const reports = [
    { name: "Действующие пропуска", desc: "Активные пропуска в текущем диапазоне дат", count: stats.active_passes },
    { name: "Просроченные пропуска", desc: "Пропуска с истекшим сроком действия", count: stats.expired_passes },
    { name: "История проходов", desc: "Все события сканирования и решений КПП", count: stats.total_events },
    { name: "Смена поста", desc: "События, где охранник изменил фактический пост", count: stats.changed_posts },
    { name: "Отказы и недействительные попытки", desc: "Отказанные проходы и невалидные QR/номера", count: stats.denied_events },
    { name: "Заявки на согласовании", desc: "Текущая нагрузка на согласующих", count: stats.submitted_apps },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Отчеты</h1>
        <p className="mt-1 text-zinc-600">Операционные показатели по пропускам, заявкам и проходам.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <div key={report.name} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-[#032c4f]">{report.name}</h3>
            <p className="mt-1 text-sm text-zinc-500">{report.desc}</p>
            <p className="mt-4 text-2xl font-semibold text-zinc-900">{report.count}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[#032c4f]">Проходы по постам</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Пост</th>
                <th className="px-4 py-3 font-medium">Всего событий</th>
                <th className="px-4 py-3 font-medium">Разрешено</th>
                <th className="px-4 py-3 font-medium">Отказы/невалидные</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {postsResult.rows.map((post) => (
                <tr key={post.post_name}>
                  <td className="px-4 py-3 text-zinc-800">{post.post_name}</td>
                  <td className="px-4 py-3 text-zinc-700">{post.events_count}</td>
                  <td className="px-4 py-3 text-zinc-700">{post.allowed_count}</td>
                  <td className="px-4 py-3 text-zinc-700">{post.denied_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
