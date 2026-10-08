export default function SidebarShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="sticky top-16 z-40 w-full border-b border-zinc-200 bg-white shadow-sm lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col py-3 lg:py-6">
        <div className="hidden px-5 pb-4 lg:block">
          <p className="text-xs font-semibold uppercase text-zinc-400">
            {title}
          </p>
        </div>
        <nav className="min-w-0 flex-1 px-3">{children}</nav>
      </div>
    </aside>
  );
}
