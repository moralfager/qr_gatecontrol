import Header from "../components/Header";
import AdminSidebar from "./AdminSidebar";
import { getCurrentUserFromCookies } from "../../lib/server/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserFromCookies();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <div className="flex flex-col lg:flex-row">
        <AdminSidebar />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:pl-8">
          {children}
        </main>
      </div>
    </div>
  );
}
