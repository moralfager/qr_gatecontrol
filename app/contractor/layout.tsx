import Header from "../components/Header";
import ContractorSidebar from "./ContractorSidebar";

export default function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <div className="flex">
        <ContractorSidebar />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-6 py-6 lg:pl-8">
          {children}
        </main>
      </div>
    </div>
  );
}
