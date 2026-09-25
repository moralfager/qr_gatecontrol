"use client";

import { usePathname } from "next/navigation";
import SidebarShell from "../components/SidebarShell";
import { AdminNav } from "./lib";

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <SidebarShell title="Администрирование">
      <AdminNav currentPath={pathname ?? ""} />
    </SidebarShell>
  );
}
