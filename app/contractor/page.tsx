"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const APP_STATUS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Согласована",
  rejected: "Отклонена",
  returned: "На доработке",
};

const PASS_STATUS: Record<string, string> = {
  active: "Действует",
  expired: "Просрочен",
  revoked: "Аннулирован",
};

type ApplicationRow = {
  id: number;
  number: string;
  type: string;
  status: string;
  created_at: string;
  zones: string | null;
  workers_count: number;
  vehicles_count: number;
};

type PassRow = {
  id: number;
  number: string;
  subject_type: "worker" | "vehicle";
  status: string;
  full_name?: string;
  position?: string;
  make?: string;
  plate?: string;
  valid_from: string;
  valid_to: string;
  zones: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}

function badge(status: string) {
  const tone =
    status === "approved" || status === "active"
      ? "bg-green-100 text-green-800"
      : status === "rejected" || status === "revoked"
        ? "bg-red-100 text-red-800"
        : status === "returned"
          ? "bg-amber-100 text-amber-800"
          : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {APP_STATUS[status] ?? PASS_STATUS[status] ?? status}
    </span>
  );
}

export default function ContractorPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/contractor/overview")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить данные");
        setApplications(data.applications ?? []);
        setPasses(data.passes ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    return {
      draft: applications.filter((a) => a.status === "draft").length,
      approval: applications.filter((a) => a.status === "submitted").length,
      activePasses: passes.filter((p) => p.status === "active").length,
    };
  }, [applications, passes]);

  if (loading) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#032c4f]">Кабинет подрядчика</h1>
          <p className="mt-1 text-zinc-600">Заявки, документы и выданные пропуска.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contractor/application/new?type=workers" className="rounded-lg bg-[#032c4f] px-4 py-2 text-sm font-medium text-white hover:bg-[#042a4a]">
            + Заявка на работников
          </Link>
          <Link href="/contractor/application/new?type=vehicles" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            + Заявка на ТС
          </Link>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Черновики" value={stats.draft} />
        <Metric label="На согласовании" value={stats.approval} />
        <Metric label="Действующие пропуска" value={stats.activePasses} />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="font-semibold text-[#032c4f]">Заявки</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Номер</th>
                <th className="px-5 py-3 font-medium">Объекты</th>
                <th className="px-5 py-3 font-medium">Состав</th>
                <th className="px-5 py-3 font-medium">Дата</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {applications.length === 0 ? (
                <tr><td className="px-5 py-6 text-center text-zinc-500" colSpan={6}>Заявок пока нет.</td></tr>
              ) : applications.map((app) => (
                <tr key={app.id}>
                  <td className="px-5 py-3 font-medium text-[#032c4f]">{app.number}</td>
                  <td className="px-5 py-3 text-zinc-700">{app.zones || "—"}</td>
                  <td className="px-5 py-3 text-zinc-700">Работники: {app.workers_count}; ТС: {app.vehicles_count}</td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(app.created_at)}</td>
                  <td className="px-5 py-3">{badge(app.status)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/contractor/application/${app.id}`} className="text-[#032c4f] hover:underline">Открыть</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="font-semibold text-[#032c4f]">Пропуска</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Номер</th>
                <th className="px-5 py-3 font-medium">Кому / ТС</th>
                <th className="px-5 py-3 font-medium">Период</th>
                <th className="px-5 py-3 font-medium">Объект</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {passes.length === 0 ? (
                <tr><td className="px-5 py-6 text-center text-zinc-500" colSpan={6}>Пропусков пока нет.</td></tr>
              ) : passes.map((pass) => (
                <tr key={pass.id}>
                  <td className="px-5 py-3 font-medium text-[#032c4f]">{pass.number}</td>
                  <td className="px-5 py-3 text-zinc-700">{pass.subject_type === "worker" ? pass.full_name : `${pass.make} ${pass.plate}`}</td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(pass.valid_from)} - {formatDate(pass.valid_to)}</td>
                  <td className="px-5 py-3 text-zinc-700">{pass.zones || "—"}</td>
                  <td className="px-5 py-3">{badge(pass.status)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/contractor/passes/${pass.id}`} className="text-[#032c4f] hover:underline">Открыть</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#032c4f]">{value}</p>
    </div>
  );
}
