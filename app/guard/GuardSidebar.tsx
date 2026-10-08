"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell from "../components/SidebarShell";

const NAV = [
  { href: "/guard", label: "Интерфейс поста" },
];

export default function GuardSidebar() {
  const pathname = usePathname();
  return (
    <SidebarShell title="Охрана">
      <ul className="grid grid-cols-1 gap-2 lg:flex lg:min-w-0 lg:flex-col">
        {NAV.map(({ href, label }) => {
          const isActive = pathname === href || pathname?.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors lg:px-4 lg:text-left ${
                  isActive ? "bg-[#032c4f] text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 hidden border-t border-zinc-100 pt-4 lg:mt-6 lg:block">
        <Link
          href="/"
          className="block rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        >
          Выйти
        </Link>
      </div>
    </SidebarShell>
  );
}
