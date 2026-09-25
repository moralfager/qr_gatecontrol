"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell from "../components/SidebarShell";

const NAV = [
  { href: "/dashboard", label: "Сводка" },
  { href: "/dashboard/requests", label: "Заявки на согласование" },
  { href: "/dashboard/pass", label: "Выпуск пропуска" },
  { href: "/dashboard/passes", label: "Пропуски" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <SidebarShell title="Кабинет согласующего">
      <ul className="flex flex-col gap-1">
        {NAV.map(({ href, label }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#032c4f] text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </SidebarShell>
  );
}
