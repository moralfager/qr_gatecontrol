"use client";

import { useEffect, useState } from "react";

type PassRow = {
  id: number;
  number: string;
  subject_type: "worker" | "vehicle";
  status: string;
  application_number: string;
  organization_name: string | null;
  full_name: string | null;
  make: string | null;
  plate: string | null;
  valid_from: string;
  valid_to: string;
  zones: string | null;
};

export default function DashboardPassesPage() {
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/passes")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить пропуска");
        setPasses(data.passes ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Пропуски</h1>
        <p className="mt-1 text-zinc-600">Выданные пропуски работников и автотранспорта.</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-zinc-500">Загрузка...</div>
        ) : passes.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">Нет выданных пропусков.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Пропуск</th>
                  <th className="px-5 py-3 font-medium">Владелец</th>
                  <th className="px-5 py-3 font-medium">Организация</th>
                  <th className="px-5 py-3 font-medium">Заявка</th>
                  <th className="px-5 py-3 font-medium">Зоны</th>
                  <th className="px-5 py-3 font-medium">Срок</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {passes.map((pass) => (
                  <tr key={pass.id}>
                    <td className="px-5 py-3 font-mono text-xs text-[#032c4f]">{pass.number}</td>
                    <td className="px-5 py-3">{pass.subject_type === "worker" ? pass.full_name : [pass.make, pass.plate].filter(Boolean).join(" / ")}</td>
                    <td className="px-5 py-3 text-zinc-600">{pass.organization_name || "-"}</td>
                    <td className="px-5 py-3 text-zinc-600">{pass.application_number}</td>
                    <td className="px-5 py-3 text-zinc-600">{pass.zones || "-"}</td>
                    <td className="px-5 py-3 text-zinc-600">{date(pass.valid_from)} - {date(pass.valid_to)}</td>
                    <td className="px-5 py-3 text-zinc-600">{pass.status}</td>
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

function date(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}
