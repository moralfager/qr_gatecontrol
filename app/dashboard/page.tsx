export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#032c4f]">
        Главная
      </h1>
      <p className="mt-2 text-zinc-600">
        Добро пожаловать в систему контроля пропусков КПП.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Заявки на согласование"
          href="/dashboard/requests"
          description="Заявки вашей организации"
        />
        <Card
          title="Пропуски"
          href="/dashboard/passes"
          description="Список выданных пропусков"
        />
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-sm text-zinc-600">{description}</p>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }
  return content;
}
