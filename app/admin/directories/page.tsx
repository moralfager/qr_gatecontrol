"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminBadge,
  AdminSectionCard,
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh,
} from "../lib";

type Kind = "organization" | "profession" | "vehicle_type" | "document_type" | "zone" | "post" | "routes" | "status";

type DirectoryItem = {
  id: number;
  name: string;
  code?: string;
  bin?: string;
  org_type?: string;
  category?: string;
  zone_id?: number;
  zone_name?: string | null;
  active: boolean;
  doc_count?: number;
};

type RequiredDocument = {
  target_type: "profession" | "vehicle_type";
  target_id: number;
  id: number;
  code: string;
  name: string;
};

type Dictionaries = {
  organizations: DirectoryItem[];
  professions: DirectoryItem[];
  vehicleTypes: DirectoryItem[];
  documentTypes: DirectoryItem[];
  zones: DirectoryItem[];
  posts: DirectoryItem[];
  requiredDocuments: RequiredDocument[];
};

const DIR_ITEMS: { id: Kind; label: string }[] = [
  { id: "organization", label: "Организации" },
  { id: "profession", label: "Профессии" },
  { id: "vehicle_type", label: "Автотранспорт" },
  { id: "document_type", label: "Документы" },
  { id: "post", label: "Посты" },
  { id: "zone", label: "Зоны" },
  { id: "routes", label: "Маршруты" },
  { id: "status", label: "Статусы" },
];

const TITLES: Record<Kind, string> = {
  organization: "Организации",
  profession: "Профессии работников",
  vehicle_type: "Виды автотранспорта",
  document_type: "Типы документов",
  post: "Посты охраны",
  zone: "Зоны и участки",
  routes: "Маршруты согласования",
  status: "Статусы заявок и пропусков",
};

const STATUS_TEXT = [
  { type: "Заявка", values: "Черновик, На согласовании, Согласована, Отклонена, На доработке" },
  { type: "Пропуск", values: "Действует, Истек, Заблокирован, Аннулирован" },
];

const ROUTE_TEXT = [
  "Маршруты хранятся в базе в таблицах approval_routes и approval_route_steps.",
  "Скрипт инициализации создает два маршрута: АСС + ТБ параллельно и АСС затем ТБ.",
  "По умолчанию для новых заявок выбирается активный параллельный маршрут.",
];

function emptyDraft(kind: Kind): Record<string, string> {
  switch (kind) {
    case "organization":
      return { name: "", bin: "", org_type: "contractor" };
    case "document_type":
      return { code: "", name: "", category: "worker" };
    case "zone":
      return { name: "", code: "" };
    case "post":
      return { name: "", zone_id: "" };
    default:
      return { name: "" };
  }
}

export default function AdminDirectoriesPage() {
  const [activeKind, setActiveKind] = useState<Kind>("organization");
  const [dict, setDict] = useState<Dictionaries | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(emptyDraft("organization"));
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/directories");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить справочники");
      setDict(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    if (!dict) return [];
    if (activeKind === "organization") return dict.organizations;
    if (activeKind === "profession") return dict.professions;
    if (activeKind === "vehicle_type") return dict.vehicleTypes;
    if (activeKind === "document_type") return dict.documentTypes;
    if (activeKind === "zone") return dict.zones;
    if (activeKind === "post") return dict.posts;
    return [];
  }, [activeKind, dict]);

  function selectKind(kind: Kind) {
    setActiveKind(kind);
    setDraft(emptyDraft(kind));
    setSelectedDocumentIds([]);
    setError("");
    setMessage("");
  }

  function docsForTarget(targetType: "profession" | "vehicle_type", targetId: number) {
    return dict?.requiredDocuments.filter((doc) => doc.target_type === targetType && doc.target_id === targetId) ?? [];
  }

  function toggleDocument(id: number) {
    setSelectedDocumentIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeKind === "routes" || activeKind === "status") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = { kind: activeKind, ...draft };
      if (activeKind === "profession" || activeKind === "vehicle_type") {
        body.documentTypeIds = selectedDocumentIds;
      }
      if (activeKind === "post") body.zone_id = Number(draft.zone_id);
      const response = await fetch("/api/admin/directories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить запись");
      setMessage("Справочник обновлен");
      setDraft(emptyDraft(activeKind));
      setSelectedDocumentIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(kind: Kind, id: number, active: boolean) {
    if (kind === "routes" || kind === "status") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/directories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось изменить статус");
      setMessage(active ? "Запись восстановлена" : "Запись отключена");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения статуса");
    } finally {
      setBusy(false);
    }
  }

  function editRow(row: DirectoryItem) {
    setDraft({ ...emptyDraft(activeKind), name: row.name });
    if (activeKind === "profession") {
      setSelectedDocumentIds(docsForTarget("profession", row.id).map((doc) => doc.id));
    } else if (activeKind === "vehicle_type") {
      setSelectedDocumentIds(docsForTarget("vehicle_type", row.id).map((doc) => doc.id));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderForm() {
    if (activeKind === "routes" || activeKind === "status") return null;
    if (activeKind === "organization") {
      return (
        <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Организации создаются через создание аккаунта подрядчика. У одной организации может быть только один активный подрядчик.
        </div>
      );
    }
    if (activeKind === "profession" || activeKind === "vehicle_type") {
      const category = activeKind === "profession" ? "employee" : "vehicle";
      const docs = dict?.documentTypes.filter((doc) => doc.active && (doc.category === category || doc.category === "common")) ?? [];
      return (
        <form onSubmit={submit} className="mb-5 grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <input
            value={draft.name ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            className="input"
            placeholder={activeKind === "profession" ? "Название профессии" : "Вид автотранспорта"}
          />
          <div>
            <p className="text-sm font-medium text-zinc-700">Обязательные документы</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {docs.map((doc) => (
                <label key={doc.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm has-[:checked]:border-[#032c4f] has-[:checked]:bg-[#032c4f]/5">
                  <input type="checkbox" checked={selectedDocumentIds.includes(doc.id)} onChange={() => toggleDocument(doc.id)} />
                  <span>{doc.name}</span>
                </label>
              ))}
            </div>
          </div>
          <input
            value={draft.newDocuments ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, newDocuments: event.target.value }))}
            className="input"
            placeholder="Новые документы через запятую"
          />
          <div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#032c4f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042a4a] disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </form>
      );
    }
    return (
      <form onSubmit={submit} className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 lg:grid-cols-[1fr_1fr_auto]">
        {activeKind === "document_type" && (
          <input
            value={draft.code ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
            className="input"
            placeholder="Код документа"
          />
        )}
        <input
          value={draft.name ?? ""}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          className="input"
          placeholder={activeKind === "post" ? "Название поста" : "Название"}
        />
        {activeKind === "document_type" && (
          <select
            value={draft.category ?? "worker"}
            onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
            className="input"
          >
            <option value="worker">Работник</option>
            <option value="vehicle">Автотранспорт</option>
            <option value="common">Общий</option>
          </select>
        )}
        {activeKind === "zone" && (
          <input
            value={draft.code ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
            className="input"
            placeholder="Код зоны"
          />
        )}
        {activeKind === "post" && (
          <>
            <select
              value={draft.zone_id ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, zone_id: event.target.value, zone_name: event.target.value ? "" : prev.zone_name ?? "" }))}
              className="input"
            >
              <option value="">Создать новую зону</option>
              {dict?.zones.filter((zone) => zone.active).map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
            {!draft.zone_id && (
              <>
                <input
                  value={draft.zone_name ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, zone_name: event.target.value }))}
                  className="input"
                  placeholder="Название новой зоны"
                />
                <input
                  value={draft.zone_code ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, zone_code: event.target.value }))}
                  className="input"
                  placeholder="Код новой зоны (можно пустым)"
                />
              </>
            )}
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#032c4f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#042a4a] disabled:opacity-50"
        >
          Добавить
        </button>
      </form>
    );
  }

  function renderTable() {
    if (activeKind === "routes") {
      return (
        <div className="space-y-3">
          {ROUTE_TEXT.map((line) => (
            <p key={line} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700">{line}</p>
          ))}
        </div>
      );
    }
    if (activeKind === "status") {
      return (
        <div className="space-y-3">
          {STATUS_TEXT.map((status) => (
            <div key={status.type} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-800">{status.type}</p>
              <p className="mt-1 text-sm text-zinc-600">{status.values}</p>
            </div>
          ))}
        </div>
      );
    }
    if (loading) return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>;

    return (
      <AdminTable>
        <AdminTableHead>
          <AdminTh>Название</AdminTh>
          {(activeKind === "document_type" || activeKind === "zone") && <AdminTh>Код</AdminTh>}
          {activeKind === "organization" && <AdminTh>БИН/ИИН</AdminTh>}
          {activeKind === "organization" && <AdminTh>Тип</AdminTh>}
          {(activeKind === "profession" || activeKind === "vehicle_type") && <AdminTh>Документы</AdminTh>}
          {activeKind === "document_type" && <AdminTh>Категория</AdminTh>}
          {activeKind === "post" && <AdminTh>Зона</AdminTh>}
          <AdminTh>Статус</AdminTh>
          <AdminTh></AdminTh>
        </AdminTableHead>
        <AdminTableBody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Нет записей</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id}>
              <AdminTd>{row.name}</AdminTd>
              {(activeKind === "document_type" || activeKind === "zone") && <AdminTd className="font-mono text-zinc-500">{row.code}</AdminTd>}
              {activeKind === "organization" && <AdminTd className="font-mono text-zinc-500">{row.bin}</AdminTd>}
              {activeKind === "organization" && <AdminTd>{row.org_type === "enterprise" ? "Предприятие" : "Подрядчик"}</AdminTd>}
              {activeKind === "profession" && (
                <AdminTd>{docsForTarget("profession", row.id).map((doc) => doc.name).join(", ") || "-"}</AdminTd>
              )}
              {activeKind === "vehicle_type" && (
                <AdminTd>{docsForTarget("vehicle_type", row.id).map((doc) => doc.name).join(", ") || "-"}</AdminTd>
              )}
              {activeKind === "document_type" && <AdminTd>{row.category}</AdminTd>}
              {activeKind === "post" && <AdminTd>{row.zone_name || "-"}</AdminTd>}
              <AdminTd>{row.active ? <AdminBadge green>Активна</AdminBadge> : <AdminBadge>Отключена</AdminBadge>}</AdminTd>
              <AdminTd>
                <div className="flex flex-wrap gap-2">
                  {(activeKind === "profession" || activeKind === "vehicle_type") && (
                    <button
                      type="button"
                      onClick={() => editRow(row)}
                      className="text-sm font-medium text-[#032c4f] hover:underline"
                    >
                      Изменить
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(activeKind, row.id, !row.active)}
                    className="text-sm font-medium text-[#032c4f] hover:underline disabled:opacity-50"
                  >
                    {row.active ? "Отключить" : "Восстановить"}
                  </button>
                </div>
              </AdminTd>
            </tr>
          ))}
        </AdminTableBody>
      </AdminTable>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Справочники</h1>
        <p className="mt-1 text-zinc-600">Базовые профессии, документы, транспорт, зоны и посты загружаются из PostgreSQL.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DIR_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectKind(id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              activeKind === id
                ? "border-[#032c4f] bg-[#032c4f] text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

      <AdminSectionCard title={TITLES[activeKind]}>
        {renderForm()}
        {renderTable()}
      </AdminSectionCard>
    </div>
  );
}
