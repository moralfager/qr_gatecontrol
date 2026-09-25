import Header from "../components/Header";
import DashboardSidebar from "./DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <div className="flex">
        <DashboardSidebar />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-6 py-6 lg:pl-8">
          {children}
        </main>
      </div>
    </div>
  );
}
