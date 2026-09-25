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
          title="Сформировать пропуск"
          value=""
          href="/dashboard/pass"
          description="Предпросмотр и формирование пропуска для работника или автотранспорта"
        />
        <Card
          title="Заявки на согласование"
          value="—"
          href="/dashboard/requests"
          description="Заявки, ожидающие проверки и согласования"
        />
        <Card
          title="Пропуски"
          value="—"
          href="/dashboard/passes"
          description="Список выданных пропусков"
        />
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: string;
  description: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-[#032c4f]">{value}</p>
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
