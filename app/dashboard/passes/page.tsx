export default function DashboardPassesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">
          Пропуски
        </h1>
        <p className="mt-1 text-zinc-600">
          Выданные пропуски (работники и автотранспорт).
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
        <p>Список выданных пропусков. Данные подгрузятся при подключении API.</p>
      </div>
    </div>
  );
}
