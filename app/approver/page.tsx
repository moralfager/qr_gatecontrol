"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Approval = {
  id: number;
  application_id: number;
  number: string;
  type: string;
  organization_name: string;
  zones: string | null;
  workers_count: number;
  vehicles_count: number;
  department: string;
  can_decide: boolean;
  created_at: string;
};

export default function ApproverPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [comment, setComment] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/approvals");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить согласования");
      setApprovals(data.approvals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: number, decision: "approved" | "returned" | "rejected") {
    setError("");
    const response = await fetch(`/api/approvals/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment: comment[id] ?? "" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Решение не принято");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Согласование заявок</h1>
        <p className="mt-1 text-zinc-600">Параллельные и последовательные этапы поддерживаются настройками маршрута.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Заявка</th>
                  <th className="px-5 py-3 font-medium">Организация</th>
                  <th className="px-5 py-3 font-medium">Территория</th>
                  <th className="px-5 py-3 font-medium">Состав</th>
                  <th className="px-5 py-3 font-medium">Этап</th>
                  <th className="px-5 py-3 font-medium">Комментарий</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {approvals.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">Нет заявок на согласование.</td></tr>
                ) : approvals.map((approval) => (
                  <tr key={approval.id}>
                    <td className="px-5 py-3">
                      <Link href={`/contractor/application/${approval.application_id}`} className="font-medium text-[#032c4f] hover:underline">{approval.number}</Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-700">{approval.organization_name}</td>
                    <td className="px-5 py-3 text-zinc-700">{approval.zones || "—"}</td>
                    <td className="px-5 py-3 text-zinc-700">Работники: {approval.workers_count}; ТС: {approval.vehicles_count}</td>
                    <td className="px-5 py-3 text-zinc-700">{approval.department}</td>
                    <td className="px-5 py-3">
                      <input value={comment[approval.id] ?? ""} onChange={(e) => setComment((prev) => ({ ...prev, [approval.id]: e.target.value }))} className="input" placeholder="Комментарий" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={!approval.can_decide} onClick={() => decide(approval.id, "approved")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40">Согласовать</button>
                        <button type="button" disabled={!approval.can_decide} onClick={() => decide(approval.id, "returned")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 disabled:opacity-40">Доработка</button>
                        <button type="button" disabled={!approval.can_decide} onClick={() => decide(approval.id, "rejected")} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-40">Отклонить</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
