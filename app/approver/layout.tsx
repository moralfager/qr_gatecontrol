import Header from "../components/Header";

export default function ApproverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:py-8">{children}</main>
    </div>
  );
}
