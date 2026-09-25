"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SidebarShell from "../components/SidebarShell";

const NAV = [
  { href: "/contractor", label: "Кабинет" },
  { href: "/contractor/application/new?type=workers", label: "Новая заявка (работники)" },
  { href: "/contractor/application/new?type=vehicles", label: "Новая заявка (автотранспорт)" },
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
  const [currentType, setCurrentType] = useState("");

  useEffect(() => {
    setCurrentType(new URLSearchParams(window.location.search).get("type") ?? "");
  }, [pathname]);

  return (
    <SidebarShell title="Подрядчик">
      <ul className="flex flex-col gap-1">
        {NAV.map(({ href, label }) => {
          const active = isActive(pathname, href, currentType);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-[#032c4f] text-white" : "text-zinc-700 hover:bg-zinc-100"
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
