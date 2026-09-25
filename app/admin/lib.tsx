import Link from "next/link";
import type { ReactNode } from "react";

export function AdminCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#032c4f]">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}

export function AdminTable({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-zinc-200 bg-white ${className}`}>
      <table className="w-full min-w-[600px] text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
        {children}
      </tr>
    </thead>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-100">{children}</tbody>;
}

export function AdminTh({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

export function AdminTd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-zinc-700 ${className}`}>{children}</td>;
}

export function AdminBadge({ children, green }: { children: ReactNode; green?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        green ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-700"
      }`}
    >
      {children}
    </span>
  );
}

export function AdminSectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <h3 className="text-base font-semibold text-[#032c4f]">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const ADMIN_NAV = [
  { href: "/admin", label: "Сводка" },
  { href: "/admin/directories", label: "Справочники" },
  { href: "/admin/users", label: "Пользователи и роли" },
  { href: "/admin/audit", label: "Журнал аудита" },
  { href: "/admin/reports", label: "Отчеты" },
  { href: "/admin/notifications", label: "Уведомления" },
];

export function AdminNav({ currentPath }: { currentPath: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.map(({ href, label }) => {
        const isActive = href === "/admin" ? currentPath === "/admin" : currentPath.startsWith(href);
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
  );
}
