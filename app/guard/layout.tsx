import Header from "../components/Header";

export default function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-100">
      <Header />
      <main className="min-h-[calc(100dvh-4rem)] w-full pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  );
}
