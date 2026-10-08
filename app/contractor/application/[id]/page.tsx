"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Application = {
  id: number;
  number: string;
  status: string;
  approval_cycle: number;
  organization_name: string | null;
};

type Zone = { id: number; name: string };
type Worker = {
  id: number;
  full_name: string;
  profession_name: string;
  iin: string;
  validity_from: string;
  validity_to: string;
};
type Vehicle = {
  id: number;
  make: string;
  plate: string;
  trailer: string | null;
  vehicle_type_name: string;
  validity_from: string;
  validity_to: string;
};
type Document = {
  id: number;
  subject_type: "worker" | "vehicle";
  subject_id: number;
  document_code: string;
  document_name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
};
type Approval = {
  id: number;
  cycle: number;
  department: string;
  decision: string;
  comment: string | null;
  decided_at: string | null;
  approver_name: string | null;
  can_decide: boolean;
};
type Pass = {
  id: number;
  number: string;
  subject_type: "worker" | "vehicle";
  valid_from: string;
  valid_to: string;
};
type CurrentUser = {
  role: string;
  department: string | null;
};
type HistoryEvent = {
  id: number;
  cycle: number;
  action: string;
  actor_name: string | null;
  status_from: string | null;
  status_to: string | null;
  comment: string | null;
  created_at: string;
};
type ApplicationDetails = {
  application: Application;
  zones: Zone[];
  workers: Worker[];
  vehicles: Vehicle[];
  documents: Document[];
  approvals: Approval[];
  passes: Pass[];
  history: HistoryEvent[];
};

const STATUS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Согласована",
  rejected: "Отклонена",
  returned: "На доработке",
};

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const pathname = usePathname();
  const isApproverPath = pathname?.startsWith("/approver");
  const backHref = isApproverPath ? "/approver" : "/contractor";
  const backLabel = isApproverPath ? "Кабинет согласующего" : "Кабинет подрядчика";
  const [id, setId] = useState<string>("");
  const [data, setData] = useState<ApplicationDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [decisionComment, setDecisionComment] = useState<Record<number, string>>({});
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  async function loadDetails(applicationId: string) {
    setError("");
    const response = await fetch(`/api/applications/${applicationId}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Заявка не найдена");
    setData(body);
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([fetch(`/api/applications/${id}`), fetch("/api/me")])
      .then(async ([response, meResponse]) => {
        const body = await response.json();
        const me = await meResponse.json();
        if (!response.ok) throw new Error(body.error || "Заявка не найдена");
        setData(body);
        setCurrentUser(me.user ?? null);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function decide(approvalId: number, decision: "approved" | "returned" | "rejected") {
    setError("");
    const response = await fetch(`/api/approvals/${approvalId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment: decisionComment[approvalId] ?? "" }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Решение не принято");
      return;
    }
    if (id) await loadDetails(id);
  }

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>;
  if (!data) return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>;

  const { application, zones, workers, vehicles, documents, approvals, passes } = data;
  const canEdit =
    ["draft", "returned"].includes(application.status) &&
    (!isApproverPath || currentUser?.role === "admin" || (currentUser?.role === "approver" && currentUser.department === "ТБ"));
  const editHref = `${isApproverPath ? "/approver" : "/contractor"}/application/${application.id}/edit`;

  return (
    <div className="space-y-8">
      <Link href={backHref} className="text-sm font-medium text-[#032c4f] hover:underline">← {backLabel}</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#032c4f]">{application.number}</h1>
          <p className="mt-1 text-zinc-600">{application.organization_name} · {zones.map((z) => z.name).join(", ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Link href={editHref} className="rounded-lg bg-[#032c4f] px-4 py-2 text-sm font-medium text-white hover:bg-[#042a4a]">
              Изменить
            </Link>
          )}
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">{STATUS[application.status] ?? application.status}</span>
        </div>
      </div>

      <Section title="Работники">
        {workers.length === 0 ? <Empty /> : workers.map((worker) => (
          <div key={worker.id} className="rounded-lg border border-zinc-100 p-4">
            <p className="font-medium text-zinc-900">{worker.full_name}</p>
            <p className="text-sm text-zinc-500">{worker.profession_name} · ИИН {worker.iin} · {date(worker.validity_from)} - {date(worker.validity_to)}</p>
            <Docs docs={documents.filter((d) => d.subject_type === "worker" && d.subject_id === worker.id)} onPreview={setPreviewDoc} />
          </div>
        ))}
      </Section>

      <Section
        title="Автотранспорт"
        action={canEdit ? (
          <Link href={editHref} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Изменить
          </Link>
        ) : null}
      >
        {vehicles.length === 0 ? <Empty /> : vehicles.map((vehicle) => (
          <div key={vehicle.id} className="rounded-lg border border-zinc-100 p-4">
            <p className="font-medium text-zinc-900">{vehicle.make} · {vehicle.plate}</p>
            <p className="text-sm text-zinc-500">{vehicle.vehicle_type_name} · прицеп {vehicle.trailer || "—"} · {date(vehicle.validity_from)} - {date(vehicle.validity_to)}</p>
            <Docs docs={documents.filter((d) => d.subject_type === "vehicle" && d.subject_id === vehicle.id)} onPreview={setPreviewDoc} />
          </div>
        ))}
      </Section>

      <Section title="Согласование">
        {approvals.length === 0 ? <Empty /> : (
          <>
          <div className="grid gap-3 md:hidden">
            {approvals.map((a) => (
              <div
                key={`mobile-${a.id}`}
                className={`rounded-lg border p-4 text-sm ${
                  isApproverPath && a.can_decide
                    ? "border-[#032c4f]/30 bg-[#032c4f]/5"
                    : "border-zinc-100 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900">{a.department}</p>
                    <p className="mt-1 text-xs text-zinc-500">Цикл {a.cycle}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {decisionLabel(a.decision)}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-zinc-600">
                  <div>
                    <dt className="text-xs text-zinc-400">Согласующий</dt>
                    <dd>{a.approver_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-400">Комментарий</dt>
                    <dd className="whitespace-pre-wrap">{a.comment || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-400">Дата</dt>
                    <dd>{a.decided_at ? dateTime(a.decided_at) : "—"}</dd>
                  </div>
                </dl>
                {isApproverPath && a.can_decide && (
                  <DecisionControls
                    approvalId={a.id}
                    comment={decisionComment[a.id] ?? ""}
                    onCommentChange={(value) => setDecisionComment((prev) => ({ ...prev, [a.id]: value }))}
                    onDecide={decide}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-3">Цикл</th><th className="px-4 py-3">Подразделение</th><th className="px-4 py-3">Решение</th><th className="px-4 py-3">Согласующий</th><th className="px-4 py-3">Комментарий</th><th className="px-4 py-3">Дата</th><th className="px-4 py-3 print:hidden">Действия</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {approvals.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">{a.cycle}</td>
                    <td className="px-4 py-3">{a.department}</td>
                    <td className="px-4 py-3">{decisionLabel(a.decision)}</td>
                    <td className="px-4 py-3">{a.approver_name || "—"}</td>
                    <td className="px-4 py-3">{a.comment || "—"}</td>
                    <td className="px-4 py-3">{a.decided_at ? dateTime(a.decided_at) : "—"}</td>
                    <td className="px-4 py-3 print:hidden">
                      {isApproverPath && a.can_decide ? (
                        <DecisionControls
                          approvalId={a.id}
                          comment={decisionComment[a.id] ?? ""}
                          onCommentChange={(value) => setDecisionComment((prev) => ({ ...prev, [a.id]: value }))}
                          onDecide={decide}
                        />
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Section>

      <Section title="История заявки">
        {data.history.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {data.history.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-zinc-900">{historyLabel(event.action)} · цикл {event.cycle || "—"}</p>
                  <span className="text-zinc-500">{dateTime(event.created_at)}</span>
                </div>
                <p className="mt-1 text-zinc-600">
                  {event.actor_name || "Система"}
                  {event.status_from || event.status_to ? ` · ${event.status_from ? STATUS[event.status_from] ?? event.status_from : "—"} → ${event.status_to ? STATUS[event.status_to] ?? event.status_to : "—"}` : ""}
                </p>
                {event.comment && <p className="mt-2 whitespace-pre-wrap text-zinc-700">{event.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Пропуска">
        {passes.length === 0 ? <Empty /> : passes.map((pass) => (
          <Link key={pass.id} href={`${isApproverPath ? "/approver" : "/contractor"}/passes/${pass.id}`} className="block rounded-lg border border-zinc-100 p-4 hover:bg-zinc-50">
            <p className="font-medium text-[#032c4f]">{pass.number}</p>
            <p className="text-sm text-zinc-500">{pass.subject_type === "worker" ? "Работник" : "Автотранспорт"} · {date(pass.valid_from)} - {date(pass.valid_to)}</p>
          </Link>
        ))}
      </Section>
      {previewDoc && <DocumentPreview document={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <h2 className="font-semibold text-[#032c4f]">{title}</h2>
        {action}
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

function Docs({ docs, onPreview }: { docs: Document[]; onPreview: (doc: Document) => void }) {
  if (!docs.length) return <p className="mt-2 text-sm text-zinc-400">Документы не загружены.</p>;
  return (
    <ul className="mt-3 grid gap-2 text-sm text-zinc-600">
      {docs.map((doc) => (
        <li key={doc.id} className="grid gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-zinc-500">✓ {doc.document_name}</p>
            <p className="break-words font-medium text-zinc-800">{doc.original_name}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <button type="button" onClick={() => onPreview(doc)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Предпросмотр</button>
            <a href={`/api/documents/${doc.id}?download=1`} className="rounded-lg bg-[#032c4f] px-3 py-2 text-center text-xs font-medium text-white hover:bg-[#042a4a]">Скачать</a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DecisionControls({
  approvalId,
  comment,
  onCommentChange,
  onDecide,
}: {
  approvalId: number;
  comment: string;
  onCommentChange: (value: string) => void;
  onDecide: (approvalId: number, decision: "approved" | "returned" | "rejected") => void;
}) {
  return (
    <div className="mt-3 grid min-w-[260px] gap-2">
      <input
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        className="input"
        placeholder="Комментарий"
      />
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={() => onDecide(approvalId, "approved")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700">
          Согласовать
        </button>
        <button type="button" onClick={() => onDecide(approvalId, "returned")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">
          Доработка
        </button>
        <button type="button" onClick={() => onDecide(approvalId, "rejected")} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">
          Отклонить
        </button>
      </div>
    </div>
  );
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

function decisionLabel(value: string) {
  if (value === "approved") return "Согласовано";
  if (value === "returned") return "Доработка";
  if (value === "rejected") return "Отклонено";
  return "Ожидает";
}

function historyLabel(value: string) {
  if (value === "application.draft") return "Сохранен черновик";
  if (value === "application.submit") return "Отправлено на согласование";
  if (value === "application.resubmit") return "Повторно отправлено на согласование";
  if (value === "application.approved") return "Заявка согласована";
  if (value === "approval.approved") return "Согласовано";
  if (value === "approval.returned") return "Возвращено на доработку";
  if (value === "approval.rejected") return "Отклонено";
  return value;
}

function DocumentPreview({ document, onClose }: { document: Document; onClose: () => void }) {
  const canPreview = document.mime_type.startsWith("image/") || document.mime_type === "application/pdf" || document.mime_type.startsWith("text/");
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 print:hidden">
      <div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <p className="font-semibold text-[#032c4f]">{document.document_name}</p>
            <p className="truncate text-sm text-zinc-500">{document.original_name}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a href={`/api/documents/${document.id}?download=1`} className="rounded-lg bg-[#032c4f] px-3 py-2 text-sm font-medium text-white">Скачать</a>
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700">Закрыть</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-zinc-100 p-4">
          {canPreview ? (
            <iframe src={`/api/documents/${document.id}`} title={document.original_name} className="h-[72dvh] w-full rounded-lg border border-zinc-200 bg-white" />
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-lg border border-zinc-200 bg-white text-center text-sm text-zinc-600">
              Для этого формата браузерный предпросмотр может быть недоступен. Скачайте файл для просмотра.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
