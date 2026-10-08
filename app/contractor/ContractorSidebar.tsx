"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import SidebarShell from "../components/SidebarShell";

const NAV = [
  { href: "/contractor", label: "Кабинет", shortLabel: "Кабинет" },
  { href: "/contractor/application/new?type=workers", label: "Новая заявка (работники)", shortLabel: "Работники" },
  { href: "/contractor/application/new?type=vehicles", label: "Новая заявка (автотранспорт)", shortLabel: "Автотранспорт" },
];

function isActive(pathname: string | null, href: string, currentType: string): boolean {
  if (!pathname) return false;
  if (href === "/contractor") return pathname === "/contractor" || pathname === "/contractor/";
  if (href.includes("/application/new")) {
    if (!pathname.startsWith("/contractor/application/new")) return false;
    const linkUrl = new URL(href, "http://_");
    const linkType = linkUrl.searchParams.get("type") ?? "";
    return currentType === linkType;
  }
  return pathname.startsWith(href);
}

export default function ContractorSidebar() {
  const pathname = usePathname();
  const currentType = useSearchParams().get("type") ?? "";

  return (
    <SidebarShell title="Подрядчик">
      <ul className="grid grid-cols-2 gap-2 lg:flex lg:min-w-0 lg:flex-col">
        {NAV.map(({ href, label, shortLabel }) => {
          const active = isActive(pathname, href, currentType);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors lg:px-4 lg:text-left ${
                  active ? "bg-[#032c4f] text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <span className="lg:hidden">{shortLabel}</span>
                <span className="hidden lg:inline">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SidebarShell>
  );
}
