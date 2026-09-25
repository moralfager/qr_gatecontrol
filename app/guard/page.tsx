"use client";

import { useEffect, useMemo, useState } from "react";

type Post = {
  id: number;
  name: string;
  zone_name: string | null;
};

type ScannedPass = {
  id: number;
  number: string;
  subject_type: "worker" | "vehicle";
  status: string;
  application_number: string;
  organization_name: string | null;
  full_name: string | null;
  position: string | null;
  iin: string | null;
  make: string | null;
  plate: string | null;
  trailer: string | null;
  valid_from: string;
  valid_to: string;
  zones: string | null;
};

type ScanResult = {
  valid: boolean;
  reason: string;
  pass?: ScannedPass;
};

type Phase = "ready" | "scanned" | "saved";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ru-RU");
}

function holderName(pass: ScannedPass) {
  if (pass.subject_type === "worker") return pass.full_name || "-";
  return [pass.make, pass.plate].filter(Boolean).join(" / ") || "-";
}

export default function GuardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<number>(0);
  const [finalPost, setFinalPost] = useState<number>(0);
  const [postEntered, setPostEntered] = useState(false);
  const [tokenOrNumber, setTokenOrNumber] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/guard/posts");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить посты");
        setPosts(data.posts ?? []);
        if (data.posts?.[0]) {
          setSelectedPost(data.posts[0].id);
          setFinalPost(data.posts[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки постов");
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) setTokenOrNumber(token);
  }, []);

  const currentPost = useMemo(
    () => posts.find((post) => post.id === selectedPost),
    [posts, selectedPost],
  );

  async function scan() {
    if (!tokenOrNumber.trim() || !selectedPost) return;
    setBusy(true);
    setError("");
    setMessage("");
    setScanResult(null);
    try {
      const response = await fetch("/api/guard/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenOrNumber, defaultPostId: selectedPost }),
      });
      const data = await response.json();
      if (!response.ok && data.valid !== false) throw new Error(data.error || "Сканирование не выполнено");
      setScanResult(data);
      setFinalPost(selectedPost);
      setPhase("scanned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сканирования");
    } finally {
      setBusy(false);
    }
  }

  async function record(result: "allowed" | "denied" | "invalid") {
    if (!scanResult?.pass || !selectedPost || !finalPost) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/guard/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passId: scanResult.pass.id,
          defaultPostId: selectedPost,
          finalPostId: finalPost,
          result,
          comment,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Событие не записано");
      setMessage(result === "allowed" ? "Проход зафиксирован" : "Отказ зафиксирован");
      setPhase("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка записи события");
    } finally {
      setBusy(false);
    }
  }

  function resetScan() {
    setTokenOrNumber("");
    setScanResult(null);
    setComment("");
    setPhase("ready");
    setMessage("");
    setError("");
  }

  if (!postEntered) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-center text-xl font-semibold text-[#032c4f]">Пост охраны</h2>
          <div className="mt-5">
            <label htmlFor="guard-post-select" className="block text-sm font-medium text-zinc-700">
              Пост
            </label>
            <select
              id="guard-post-select"
              value={selectedPost}
              onChange={(event) => {
                const id = Number(event.target.value);
                setSelectedPost(id);
                setFinalPost(id);
              }}
              className="input mt-1.5"
              disabled={loading}
            >
              <option value={0}>{loading ? "Загрузка..." : "Выберите пост"}</option>
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.name}{post.zone_name ? ` (${post.zone_name})` : ""}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={!selectedPost || loading}
            onClick={() => setPostEntered(true)}
            className="mt-5 w-full rounded-xl bg-[#032c4f] px-4 py-3 font-medium text-white transition-colors hover:bg-[#042a4a] disabled:opacity-50"
          >
            Начать работу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#032c4f]">Контроль прохода</h1>
          <p className="text-sm text-zinc-600">{currentPost?.name ?? "Пост"}{currentPost?.zone_name ? `, ${currentPost.zone_name}` : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => setPostEntered(false)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Сменить пост
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label htmlFor="qr-input" className="block text-sm font-medium text-zinc-700">
          QR-ссылка, токен или номер пропуска
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="qr-input"
            value={tokenOrNumber}
            onChange={(event) => setTokenOrNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") scan();
            }}
            className="input"
            placeholder="Например: Р-2026-00001 или ссылка из QR"
          />
          <button
            type="button"
            disabled={busy || !tokenOrNumber.trim()}
            onClick={scan}
            className="rounded-xl bg-[#032c4f] px-6 py-3 font-medium text-white hover:bg-[#042a4a] disabled:opacity-50"
          >
            Проверить
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">QR на пропуске ведет на эту страницу с токеном; ручной ввод номера тоже поддерживается.</p>
      </section>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

      {scanResult && (
        <section className={`mt-5 rounded-xl border p-5 shadow-sm ${scanResult.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-500">Результат проверки</p>
              <h2 className={`mt-1 text-xl font-semibold ${scanResult.valid ? "text-green-800" : "text-red-800"}`}>
                {scanResult.reason}
              </h2>
            </div>
            {scanResult.pass && (
              <span className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-medium text-[#032c4f]">
                {scanResult.pass.number}
              </span>
            )}
          </div>

          {scanResult.pass ? (
            <div className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-zinc-500">Владелец</p>
                <p className="font-medium text-zinc-900">{holderName(scanResult.pass)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Тип</p>
                <p className="font-medium text-zinc-900">{scanResult.pass.subject_type === "worker" ? "Работник" : "Автотранспорт"}</p>
              </div>
              <div>
                <p className="text-zinc-500">Организация</p>
                <p className="font-medium text-zinc-900">{scanResult.pass.organization_name || "-"}</p>
              </div>
              <div>
                <p className="text-zinc-500">Заявка</p>
                <p className="font-medium text-zinc-900">{scanResult.pass.application_number}</p>
              </div>
              <div>
                <p className="text-zinc-500">Срок</p>
                <p className="font-medium text-zinc-900">{formatDate(scanResult.pass.valid_from)} - {formatDate(scanResult.pass.valid_to)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Зоны</p>
                <p className="font-medium text-zinc-900">{scanResult.pass.zones || "-"}</p>
              </div>
              {scanResult.pass.subject_type === "worker" ? (
                <>
                  <div>
                    <p className="text-zinc-500">Должность</p>
                    <p className="font-medium text-zinc-900">{scanResult.pass.position || "-"}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">ИИН</p>
                    <p className="font-medium text-zinc-900">{scanResult.pass.iin || "-"}</p>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <p className="text-zinc-500">Прицеп</p>
                  <p className="font-medium text-zinc-900">{scanResult.pass.trailer || "-"}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-white p-4 text-sm text-zinc-700">Номер или QR не найден. Недействительная попытка уже записана в журнал.</p>
          )}

          {scanResult.pass && phase !== "saved" && (
            <div className="mt-4 rounded-xl bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="final-post" className="block text-sm font-medium text-zinc-700">Фактический пост</label>
                  <select
                    id="final-post"
                    value={finalPost}
                    onChange={(event) => setFinalPost(Number(event.target.value))}
                    className="input mt-1.5"
                  >
                    {posts.map((post) => (
                      <option key={post.id} value={post.id}>{post.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="guard-comment" className="block text-sm font-medium text-zinc-700">Комментарий</label>
                  <input
                    id="guard-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    className="input mt-1.5"
                    placeholder="Необязательно"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={busy || !scanResult.valid}
                  onClick={() => record("allowed")}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Подтвердить проход
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => record(scanResult.valid ? "denied" : "invalid")}
                  className="flex-1 rounded-xl border border-red-300 bg-white px-4 py-3 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Отказать
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {(phase === "scanned" || phase === "saved") && (
        <button
          type="button"
          onClick={resetScan}
          className="mt-5 rounded-xl border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Следующая проверка
        </button>
      )}
    </div>
  );
}
