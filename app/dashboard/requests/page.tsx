export default function DashboardRequestsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#032c4f]">
          Заявки на согласование
        </h1>
        <p className="mt-1 text-zinc-600">
          Заявки, ожидающие проверки и согласования (АСС / ТБ).
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
        <p>Список заявок на согласование. Данные подгрузятся при подключении API.</p>
      </div>
    </div>
  );
}
