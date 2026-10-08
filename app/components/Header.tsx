"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ROLE_CONFIG: Record<
  string,
  { label: string; home: string; navLabel: string }
> = {
  admin: { label: "Администратор", home: "/admin", navLabel: "Кабинет" },
  guard: { label: "Охранник", home: "/guard", navLabel: "Пост" },
  contractor: { label: "Подрядчик", home: "/contractor", navLabel: "Кабинет" },
  approver: { label: "Согласующий", home: "/approver", navLabel: "Кабинет" },
};

type HeaderUser = {
  name: string;
  role: string;
  department: string | null;
  organization_name: string | null;
};

function clearRoleCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "userRole=; path=/; max-age=0; SameSite=Lax";
}

export default function Header() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<HeaderUser | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetch("/api/me")
        .then((response) => response.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
            setRole(data.user.role);
            return;
          }
          setRole(sessionStorage.getItem("userRole"));
        })
        .catch(() => setRole(sessionStorage.getItem("userRole")));
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const config = role ? ROLE_CONFIG[role] : null;
  const roleLabel = config?.label ?? "";
  const homeHref = config?.home ?? "/";
  const navLabel = config?.navLabel ?? "Кабинет";
  const userContext = user?.department ?? user?.organization_name ?? roleLabel;
  const identityLabel = user ? [user.name, userContext !== user.name ? userContext : ""].filter(Boolean).join(" · ") : roleLabel;

  async function handleLogout() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("userRole");
      clearRoleCookie();
    }
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#032c4f]">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link href={homeHref} className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Logo.webp"
            alt="Логотип"
            width={140}
            height={44}
            className="h-auto w-[118px] object-contain brightness-0 invert sm:w-[140px]"
          />
          <span className="hidden text-lg font-medium text-white sm:inline">
            КПП
          </span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href={homeHref}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            {navLabel}
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {identityLabel && <span className="max-w-[130px] truncate text-xs text-white/70 sm:max-w-[260px] sm:text-sm" title={identityLabel}>{identityLabel}</span>}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-white/10 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:px-3 sm:text-sm"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
