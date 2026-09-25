"use client";

import Image from "next/image";
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
  user: { label: "Пользователь", home: "/dashboard", navLabel: "Кабинет" },
};

function clearRoleCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "userRole=; path=/; max-age=0; SameSite=Lax";
}

export default function Header() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const r =
      typeof window !== "undefined" ? sessionStorage.getItem("userRole") : null;
    setRole(r);
  }, []);

  const config = role ? ROLE_CONFIG[role] : null;
  const roleLabel = config?.label ?? "Согласующий";
  const homeHref = config?.home ?? "/dashboard";
  const navLabel = config?.navLabel ?? "Кабинет";

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={homeHref} className="flex items-center gap-3">
          <Image
            src="/Logo.webp"
            alt="Логотип"
            width={140}
            height={44}
            className="h-11 w-auto object-contain brightness-0 invert"
          />
          <span className="hidden text-lg font-medium text-white sm:inline">
            КПП
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href={homeHref}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            {navLabel}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70">{roleLabel}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
