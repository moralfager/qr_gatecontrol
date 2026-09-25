"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STATUS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Согласована",
  rejected: "Отклонена",
  returned: "На доработке",
};

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/applications/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Заявка не найдена");
        setData(body);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>;
  if (!data) return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>;

  const { application, zones, workers, vehicles, documents, approvals, passes } = data;

  return (
    <div className="space-y-8">
      <Link href="/contractor" className="text-sm font-medium text-[#032c4f] hover:underline">← Кабинет подрядчика</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#032c4f]">{application.number}</h1>
          <p className="mt-1 text-zinc-600">{application.organization_name} · {zones.map((z: any) => z.name).join(", ")}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">{STATUS[application.status] ?? application.status}</span>
      </div>

      <Section title="Работники">
        {workers.length === 0 ? <Empty /> : workers.map((worker: any) => (
          <div key={worker.id} className="rounded-lg border border-zinc-100 p-4">
            <p className="font-medium text-zinc-900">{worker.full_name}</p>
            <p className="text-sm text-zinc-500">{worker.profession_name} · ИИН {worker.iin} · {date(worker.validity_from)} - {date(worker.validity_to)}</p>
            <Docs docs={documents.filter((d: any) => d.subject_type === "worker" && d.subject_id === worker.id)} />
          </div>
        ))}
      </Section>

      <Section title="Автотранспорт">
        {vehicles.length === 0 ? <Empty /> : vehicles.map((vehicle: any) => (
          <div key={vehicle.id} className="rounded-lg border border-zinc-100 p-4">
            <p className="font-medium text-zinc-900">{vehicle.make} · {vehicle.plate}</p>
            <p className="text-sm text-zinc-500">{vehicle.vehicle_type_name} · прицеп {vehicle.trailer || "—"} · {date(vehicle.validity_from)} - {date(vehicle.validity_to)}</p>
            <Docs docs={documents.filter((d: any) => d.subject_type === "vehicle" && d.subject_id === vehicle.id)} />
          </div>
        ))}
      </Section>

      <Section title="Согласование">
        {approvals.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-3">Подразделение</th><th className="px-4 py-3">Решение</th><th className="px-4 py-3">Комментарий</th><th className="px-4 py-3">Дата</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {approvals.map((a: any) => <tr key={a.id}><td className="px-4 py-3">{a.department}</td><td className="px-4 py-3">{a.decision}</td><td className="px-4 py-3">{a.comment || "—"}</td><td className="px-4 py-3">{a.decided_at ? dateTime(a.decided_at) : "—"}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Пропуска">
        {passes.length === 0 ? <Empty /> : passes.map((pass: any) => (
          <Link key={pass.id} href={`/contractor/passes/${pass.id}`} className="block rounded-lg border border-zinc-100 p-4 hover:bg-zinc-50">
            <p className="font-medium text-[#032c4f]">{pass.number}</p>
            <p className="text-sm text-zinc-500">{pass.subject_type === "worker" ? "Работник" : "Автотранспорт"} · {date(pass.valid_from)} - {date(pass.valid_to)}</p>
          </Link>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4"><h2 className="font-semibold text-[#032c4f]">{title}</h2></div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

function Docs({ docs }: { docs: any[] }) {
  if (!docs.length) return <p className="mt-2 text-sm text-zinc-400">Документы не загружены.</p>;
  return <ul className="mt-3 grid gap-1 text-sm text-zinc-600">{docs.map((doc) => <li key={doc.id}>✓ {doc.document_name}: {doc.original_name}</li>)}</ul>;
}

function Empty() {
  return <p className="text-sm text-zinc-500">Нет записей.</p>;
}

function date(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}
