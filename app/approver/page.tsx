"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type Approval = {
  id: number;
  application_id: number;
  number: string;
  type: string;
  application_status: string;
  organization_name: string;
  zones: string | null;
  workers_count: number;
  vehicles_count: number;
  department: string;
  decision: string;
  decided_at: string | null;
  touched_by_you: boolean;
  can_decide: boolean;
  created_at: string;
};

type CurrentUser = {
  role: string;
  department: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Согласована",
  returned: "На доработке",
  rejected: "Отклонена",
};

export default function ApproverPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [response, meResponse] = await Promise.all([fetch("/api/approvals"), fetch("/api/me")]);
      const data = await response.json();
      const me = await meResponse.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить согласования");
      setApprovals(data.approvals ?? []);
      setCurrentUser(me.user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const approvalGroups = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const pending: Approval[] = [];
    const archive: Approval[] = [];
    let archiveTotal = 0;

    approvals.forEach((approval) => {
      if (approval.can_decide) {
        pending.push(approval);
        return;
      }

      archiveTotal += 1;
      if (statusFilter && approval.application_status !== statusFilter) return false;
      if (mineOnly && !approval.touched_by_you) return false;
      if (!tokens.length) {
        archive.push(approval);
        return;
      }

      const searchable = [
        approval.number,
        approval.organization_name,
        approval.zones,
        approval.department,
        STATUS_LABELS[approval.application_status],
        approval.decision,
      ].join(" ").toLowerCase();
      if (tokens.every((token) => searchable.includes(token))) {
        archive.push(approval);
      }
    });

    return { pending, archive, archiveTotal };
  }, [approvals, mineOnly, query, statusFilter]);
  const canCreateApplication = currentUser?.department === "ТБ";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#032c4f]">Согласование заявок</h1>
          <p className="mt-1 text-zinc-600">Материалы разделены на новые к действию и архив согласованных/измененных заявок.</p>
        </div>
        {canCreateApplication && (
          <div className="flex flex-wrap gap-2">
            <Link href="/approver/application/new?type=workers" className="rounded-lg bg-[#032c4f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#042a4a]">
              Новая заявка: работники
            </Link>
            <Link href="/approver/application/new?type=vehicles" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
              Новая заявка: автотранспорт
            </Link>
          </div>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>
      ) : (
        <>
          <ApprovalsTable title={`Новые к действию (${approvalGroups.pending.length})`} rows={approvalGroups.pending} emptyText="Нет новых заявок для вашего решения." />
          <ArchiveSection
            rows={approvalGroups.archive}
            total={approvalGroups.archiveTotal}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            mineOnly={mineOnly}
            setMineOnly={setMineOnly}
          />
        </>
      )}
    </div>
  );
}

function ApprovalsTable({ title, rows, emptyText }: { title: string; rows: Approval[]; emptyText: string }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="font-semibold text-[#032c4f]">{title}</h2>
      </div>
      <ApprovalsTableBody rows={rows} emptyText={emptyText} />
    </section>
  );
}

function ArchiveSection({
  rows,
  total,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  mineOnly,
  setMineOnly,
}: {
  rows: Approval[];
  total: number;
  query: string;
  setQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  mineOnly: boolean;
  setMineOnly: (value: boolean) => void;
}) {
  const hasFilters = Boolean(query.trim() || statusFilter || mineOnly);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <h2 className="font-semibold text-[#032c4f]">Архив и история ({hasFilters ? `${rows.length} из ${total}` : total})</h2>
          <p className="mt-1 text-sm text-zinc-500">Поиск работает по части номера, организации, территории или этапа.</p>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("");
              setMineOnly(false);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="border-b border-zinc-100 bg-zinc-50/70 px-5 py-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="input" placeholder="Часть номера, организации или зоны" />
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
            <input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />
            Только мои изменения
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Фильтр статуса">
          <StatusButton active={!statusFilter} onClick={() => setStatusFilter("")}>Все</StatusButton>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <StatusButton key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</StatusButton>
          ))}
        </div>
      </div>

      <ApprovalsTableBody rows={rows} emptyText={hasFilters ? "По фильтру ничего не найдено." : "Архив пуст."} />
    </section>
  );
}

function StatusButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-2 text-sm font-medium transition-all",
        active ? "border-[#032c4f] bg-[#032c4f] text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ApprovalsTableBody({ rows, emptyText }: { rows: Approval[]; emptyText: string }) {
  return (
    <>
      <div className="grid gap-3 p-4 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-5 text-center text-sm text-zinc-500">{emptyText}</div>
        ) : rows.map((approval) => (
          <Link
            key={`${approval.application_id}-${approval.id || "card"}`}
            href={`/approver/application/${approval.application_id}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors active:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#032c4f]">{approval.number}</p>
                <p className="mt-1 truncate text-sm text-zinc-600">{approval.organization_name || "—"}</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                {STATUS_LABELS[approval.application_status] ?? approval.application_status}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm text-zinc-600">
              <div><dt className="text-xs text-zinc-400">Территория</dt><dd>{approval.zones || "—"}</dd></div>
              <div><dt className="text-xs text-zinc-400">Состав</dt><dd>Работники: {approval.workers_count}; ТС: {approval.vehicles_count}</dd></div>
              <div className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-zinc-400">Ваш этап</dt><dd>{approval.department || "—"}</dd></div>
                <div><dt className="text-xs text-zinc-400">Дата</dt><dd>{approval.decided_at ? new Date(approval.decided_at).toLocaleString("ru-RU") : "—"}</dd></div>
              </div>
            </dl>
          </Link>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-medium">Заявка</th>
            <th className="px-5 py-3 font-medium">Организация</th>
            <th className="px-5 py-3 font-medium">Территория</th>
            <th className="px-5 py-3 font-medium">Состав</th>
            <th className="px-5 py-3 font-medium">Статус</th>
            <th className="px-5 py-3 font-medium">Ваш этап</th>
            <th className="px-5 py-3 font-medium">Дата</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">{emptyText}</td></tr>
          ) : rows.map((approval) => (
            <tr key={`${approval.application_id}-${approval.id || "view"}`} className="transition-colors hover:bg-zinc-50">
              <td className="px-5 py-3">
                <Link href={`/approver/application/${approval.application_id}`} className="font-medium text-[#032c4f] transition-colors hover:text-[#064a83] hover:underline">{approval.number}</Link>
              </td>
              <td className="px-5 py-3 text-zinc-700">{approval.organization_name || "—"}</td>
              <td className="px-5 py-3 text-zinc-700">{approval.zones || "—"}</td>
              <td className="px-5 py-3 text-zinc-700">Работники: {approval.workers_count}; ТС: {approval.vehicles_count}</td>
              <td className="px-5 py-3 text-zinc-700">{STATUS_LABELS[approval.application_status] ?? approval.application_status}</td>
              <td className="px-5 py-3 text-zinc-700">{approval.department || "—"}</td>
              <td className="px-5 py-3 text-zinc-500">{approval.decided_at ? new Date(approval.decided_at).toLocaleString("ru-RU") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
