"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const login = (form.elements.namedItem("login") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    if (!login.trim()) {
      setError("Введите логин");
      setLoading(false);
      return;
    }
    if (!password) {
      setError("Введите пароль");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Не удалось войти");
        setLoading(false);
        return;
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("userRole", data.user.role);
      }
      router.push(data.redirectTo || "/dashboard");
    } catch {
      setError("Сервер недоступен");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#032c4f]">
      {/* Фон: градиент + сетка (mobile-first, без лишнего на малом экране) */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fff 1px, transparent 1px),
            linear-gradient(to bottom, #fff 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#032c4f] via-[#032c4f] to-[#051f38]" />

      <div className="relative flex min-h-[100dvh] flex-col px-4 py-8 sm:py-10 md:flex-row md:items-center md:justify-center md:gap-12 md:px-8 lg:gap-16 lg:px-12">
        {/* Блок с лого и слоганом — на десктопе слева */}
        <div className="flex flex-col items-center text-center md:w-[min(360px,40%)] md:items-start md:text-left">
          <Link href="/" className="flex shrink-0 justify-center md:justify-start">
            <Image
              src="/Logo.webp"
              alt="Логотип"
              width={200}
              height={64}
              className="h-12 w-auto object-contain brightness-0 invert sm:h-14 md:h-16"
              priority
            />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-white/80 sm:mt-6 sm:text-base md:mt-8 md:max-w-[280px]">
            Система контроля пропусков для подрядчиков. Заявки, документы и пропуск — в одном месте.
          </p>
          <div className="mt-6 hidden h-px w-16 bg-white/30 md:block" />
        </div>

        {/* Карточка входа — mobile-first: сначала по центру, на десктопе справа */}
        <div className="flex flex-1 flex-col items-center justify-center md:w-[min(400px,45%)] md:flex-none">
          <div className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:max-w-[400px] sm:p-8 md:max-w-none">
            <div className="border-l-4 border-[#032c4f] pl-4">
              <h1 className="text-xl font-semibold tracking-tight text-[#032c4f] sm:text-2xl">
                Вход в систему
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Контроль пропусков КПП
              </p>
            </div>

            <form className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-5" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Email или логин
                </span>
                <input
                  type="text"
                  name="login"
                  placeholder="Введите email или логин"
                  className="min-h-[48px] rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#032c4f] focus:outline-none focus:ring-2 focus:ring-[#032c4f]/20"
                  autoComplete="username"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700">Пароль</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Введите пароль"
                  className="min-h-[48px] rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#032c4f] focus:outline-none focus:ring-2 focus:ring-[#032c4f]/20"
                  autoComplete="current-password"
                />
              </label>
              <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-5 w-5 shrink-0 rounded border-zinc-300 text-[#032c4f] focus:ring-[#032c4f]"
                />
                <span className="text-sm text-zinc-600">Запомнить меня</span>
              </label>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#032c4f] py-3 text-base font-semibold text-white transition-colors hover:bg-[#042a4a] focus:outline-none focus:ring-2 focus:ring-[#032c4f] focus:ring-offset-2 active:scale-[0.99]"
              >
                {loading ? "Входим..." : "Войти"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-zinc-400">
              Первичный вход: <strong>admin/admin123</strong>, <strong>contractor/contractor123</strong>, <strong>ass/approver123</strong>, <strong>tb/approver123</strong>, <strong>guard/guard123</strong>.
            </p>

            <p className="mt-4 text-center text-sm text-zinc-500">
              Нет аккаунта?{" "}
              <Link
                href="#"
                className="font-semibold text-[#032c4f] hover:underline"
              >
                Обратитесь к администратору
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-white/60 sm:text-sm">
            © Система контроля КПП
          </p>
        </div>
      </div>
    </div>
  );
}
