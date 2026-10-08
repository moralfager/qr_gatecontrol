"use client";

import { useEffect, useState } from "react";

type ApplicationRow = {
  id: number;
  number: string;
  type: string;
  status: string;
  organization_name: string | null;
  workers_count: number;
  vehicles_count: number;
  zones: string | null;
  created_at: string;
};

const STATUS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Согласована",
  rejected: "Отклонена",
  returned: "На доработке",
};

export default function DashboardRequestsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/applications")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить заявки");
        setApplications(data.applications ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Заявки</h1>
        <p className="mt-1 text-zinc-600">Заявки вашей организации.</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-zinc-500">Загрузка...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">Нет заявок.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Номер</th>
                  <th className="px-5 py-3 font-medium">Организация</th>
                  <th className="px-5 py-3 font-medium">Зоны</th>
                  <th className="px-5 py-3 font-medium">Состав</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">Создана</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td className="px-5 py-3 font-medium text-[#032c4f]">{application.number}</td>
                    <td className="px-5 py-3 text-zinc-600">{application.organization_name || "-"}</td>
                    <td className="px-5 py-3 text-zinc-600">{application.zones || "-"}</td>
                    <td className="px-5 py-3 text-zinc-600">Работники: {application.workers_count}; ТС: {application.vehicles_count}</td>
                    <td className="px-5 py-3 text-zinc-600">{STATUS[application.status] ?? application.status}</td>
                    <td className="px-5 py-3 text-zinc-600">{new Date(application.created_at).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
