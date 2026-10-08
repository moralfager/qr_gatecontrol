"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminSectionCard,
  AdminTable,
  AdminTableHead,
  AdminTableBody,
  AdminTh,
  AdminTd,
  AdminBadge,
} from "../lib";

type Organization = {
  id: number;
  name: string;
  org_type: string;
  active: boolean;
};

type Post = {
  id: number;
  name: string;
  zone_name: string | null;
  active: boolean;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  login: string;
  role: string;
  department: string | null;
  organization_id: number | null;
  organization_name: string | null;
  allowed_post_ids: number[];
  active: boolean;
  last_active: string | null;
};

type UsersPayload = {
  users: UserRow[];
  organizations: Organization[];
  posts: Post[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  approver: "Согласующий",
  contractor: "Подрядчик",
  guard: "Охранник",
};

const ROLE_OPTIONS = [
  ["contractor", "Подрядчик"],
  ["approver", "Согласующий"],
  ["guard", "Охранник"],
  ["admin", "Администратор"],
] as const;

const DEPARTMENTS = ["АСС", "ТБ"];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "-";
}

const initialForm = {
  name: "",
  login: "",
  email: "",
  password: "",
  role: "contractor",
  department: "ТБ",
  organizationId: "",
  organizationName: "",
  organizationBin: "",
  allowedPostIds: [] as number[],
};

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersPayload>({ users: [], organizations: [], posts: [] });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activePosts = useMemo(() => data.posts.filter((post) => post.active), [data.posts]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось загрузить пользователей");
      setData(payload);
      setForm((prev) => ({ ...prev, organizationId: prev.organizationId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function togglePost(id: number) {
    setForm((prev) => ({
      ...prev,
      allowedPostIds: prev.allowedPostIds.includes(id)
        ? prev.allowedPostIds.filter((postId) => postId !== id)
        : [...prev.allowedPostIds, id],
    }));
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organizationId: form.organizationId ? Number(form.organizationId) : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Пользователь не создан");
      setMessage("Пользователь создан.");
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания пользователя");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(user: UserRow, active: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, active }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Статус не изменен");
      setMessage(active ? "Пользователь включен." : "Пользователь отключен.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения статуса");
    } finally {
      setBusy(false);
    }
  }

  function postNames(ids: number[]) {
    if (!ids?.length) return "-";
    return ids
      .map((id) => data.posts.find((post) => post.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">Пользователи и роли</h1>
        <p className="mt-1 text-zinc-600">Создание учетных записей, назначение роли, подразделения, организации и постов охраны.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

      <AdminSectionCard title="Создать пользователя">
        <form onSubmit={createUser} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="ФИО"><input className="input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></Field>
            <Field label="Логин"><input className="input" value={form.login} onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))} /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} /></Field>
            <Field label="Пароль"><input className="input" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} /></Field>
            <Field label="Роль">
              <select className="input" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
                {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            {form.role === "approver" && (
              <Field label="Подразделение">
                <select className="input" value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}>
                  {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </Field>
            )}
            {form.role === "contractor" && (
              <>
                <Field label="Организация подрядчика">
                  <input className="input" value={form.organizationName} onChange={(e) => setForm((prev) => ({ ...prev, organizationName: e.target.value }))} />
                </Field>
                <Field label="БИН организации">
                  <input className="input" value={form.organizationBin} onChange={(e) => setForm((prev) => ({ ...prev, organizationBin: e.target.value }))} />
                </Field>
              </>
            )}
          </div>

          {form.role === "guard" && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-700">Посты охраны</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {activePosts.map((post) => (
                  <label key={post.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm has-[:checked]:border-[#032c4f] has-[:checked]:bg-[#032c4f]/5">
                    <input type="checkbox" checked={form.allowedPostIds.includes(post.id)} onChange={() => togglePost(post.id)} />
                    <span>{post.name}{post.zone_name ? ` (${post.zone_name})` : ""}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <button type="submit" disabled={busy} className="rounded-lg bg-[#032c4f] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#042a4a] disabled:opacity-50">
              Создать аккаунт
            </button>
          </div>
        </form>
      </AdminSectionCard>

      <AdminSectionCard title="Список пользователей">
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>
        ) : (
          <>
            <AdminTable>
              <AdminTableHead>
                <AdminTh>ФИО</AdminTh>
                <AdminTh>Логин / Email</AdminTh>
                <AdminTh>Роль</AdminTh>
                <AdminTh>Организация / подразделение</AdminTh>
                <AdminTh>Посты</AdminTh>
                <AdminTh>Последняя активность</AdminTh>
                <AdminTh>Статус</AdminTh>
                <AdminTh />
              </AdminTableHead>
              <AdminTableBody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <AdminTd className="font-medium">{user.name}</AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-zinc-500">{user.login}</span>
                      <br />
                      {user.email}
                    </AdminTd>
                    <AdminTd><AdminBadge green={user.role === "admin"}>{ROLE_LABELS[user.role] ?? user.role}</AdminBadge></AdminTd>
                    <AdminTd>{user.department || user.organization_name || "-"}</AdminTd>
                    <AdminTd>{postNames(user.allowed_post_ids)}</AdminTd>
                    <AdminTd className="text-zinc-500">{formatDate(user.last_active)}</AdminTd>
                    <AdminTd>{user.active ? <AdminBadge green>Активен</AdminBadge> : <AdminBadge>Отключен</AdminBadge>}</AdminTd>
                    <AdminTd>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setActive(user, !user.active)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {user.active ? "Отключить" : "Включить"}
                      </button>
                    </AdminTd>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
            <p className="mt-4 text-sm text-zinc-500">Всего пользователей: {data.users.length}.</p>
          </>
        )}
      </AdminSectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
