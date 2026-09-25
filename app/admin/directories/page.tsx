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

type Dictionaries = {
  organizations: DirectoryItem[];
  professions: DirectoryItem[];
  vehicleTypes: DirectoryItem[];
  documentTypes: DirectoryItem[];
  zones: DirectoryItem[];
  posts: DirectoryItem[];
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
  { type: "Пропуск", values: "Активен, Аннулирован, Просрочен по сроку действия" },
];

const ROUTE_TEXT = [
  "Маршруты хранятся в базе в таблицах approval_routes и approval_route_steps.",
  "Сейчас создан маршрут по умолчанию: АСС + ТБ параллельно.",
  "Последовательный режим уже поддержан на уровне API согласований и включается сменой mode на sequential.",
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
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeKind === "routes" || activeKind === "status") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, string | number> = { kind: activeKind, ...draft };
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

  function renderForm() {
    if (activeKind === "routes" || activeKind === "status") return null;
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
        {activeKind === "organization" && (
          <>
            <input
              value={draft.bin ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, bin: event.target.value }))}
              className="input"
              placeholder="БИН/ИИН"
            />
            <select
              value={draft.org_type ?? "contractor"}
              onChange={(event) => setDraft((prev) => ({ ...prev, org_type: event.target.value }))}
              className="input"
            >
              <option value="contractor">Подрядчик</option>
              <option value="enterprise">Предприятие</option>
            </select>
          </>
        )}
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
          <select
            value={draft.zone_id ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, zone_id: event.target.value }))}
            className="input"
          >
            <option value="">Зона</option>
            {dict?.zones.filter((zone) => zone.active).map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
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
          {(activeKind === "profession" || activeKind === "vehicle_type") && <AdminTh>Документов</AdminTh>}
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
              {(activeKind === "profession" || activeKind === "vehicle_type") && <AdminTd>{row.doc_count ?? 0}</AdminTd>}
              {activeKind === "document_type" && <AdminTd>{row.category}</AdminTd>}
              {activeKind === "post" && <AdminTd>{row.zone_name || "-"}</AdminTd>}
              <AdminTd>{row.active ? <AdminBadge green>Активна</AdminBadge> : <AdminBadge>Отключена</AdminBadge>}</AdminTd>
              <AdminTd>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(activeKind, row.id, !row.active)}
                  className="text-sm font-medium text-[#032c4f] hover:underline disabled:opacity-50"
                >
                  {row.active ? "Отключить" : "Восстановить"}
                </button>
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
