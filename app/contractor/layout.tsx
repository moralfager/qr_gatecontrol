import Header from "../components/Header";
import ContractorSidebar from "./ContractorSidebar";
import { Suspense } from "react";

export default function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <div className="flex flex-col lg:flex-row">
        <Suspense fallback={null}>
          <ContractorSidebar />
        </Suspense>
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:pl-8">
          {children}
        </main>
      </div>
    </div>
  );
}
