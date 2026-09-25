export default function SidebarShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="sticky top-16 z-40 h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white shadow-sm">
      <div className="flex h-full flex-col py-6">
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {title}
          </p>
        </div>
        <nav className="flex-1 px-3">{children}</nav>
      </div>
    </aside>
  );
}
