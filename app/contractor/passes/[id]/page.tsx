"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ContractorPassPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [pass, setPass] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/passes/${id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Пропуск не найден");
        setPass(data.pass);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>;
  if (!pass) return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>;

  const isWorker = pass.subject_type === "worker";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Link href="/contractor" className="text-sm font-medium text-[#032c4f] hover:underline">← Кабинет подрядчика</Link>
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg print:shadow-none">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex flex-1 flex-col gap-4">
              <div className="text-xl font-bold text-[#032c4f]">КПП</div>
              <div>
                <p className="text-2xl font-semibold text-[#032c4f]">Пропуск № {pass.number}</p>
                <p className="text-sm text-zinc-500">{isWorker ? "для работника" : "для автотранспортных средств"}</p>
              </div>
              <dl className="grid gap-2 text-sm">
                <Row label="Наименование организации" value={pass.organization_name} />
                {isWorker ? (
                  <>
                    <Row label="Ф.И.О. Работника" value={pass.full_name} />
                    <Row label="Должность" value={pass.position} />
                    <Row label="ИИН" value={pass.iin} />
                  </>
                ) : (
                  <>
                    <Row label="Марка автотранспорта" value={pass.make} />
                    <Row label="Гос. номер" value={pass.plate} />
                    <Row label="Номер прицепа" value={pass.trailer || "—"} />
                  </>
                )}
                <Row label="Срок действия пропуска" value={`${date(pass.valid_from)} - ${date(pass.valid_to)}`} />
                <Row label="Наименование объекта" value={pass.zones || "—"} />
                <Row label="Утвердил" value={pass.approved_by || "—"} />
              </dl>
              {isWorker && (
                <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  Пропуск действителен при предъявлении удостоверения личности
                </p>
              )}
            </div>
            <div className="flex justify-center md:block">
              <img
                src={`/api/passes/${pass.id}/qr`}
                alt="QR-код пропуска"
                className="h-[220px] w-[220px] rounded-lg border border-zinc-200 bg-white object-contain"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 print:hidden lg:min-w-[260px]">
          <h2 className="font-semibold text-[#032c4f]">Действия</h2>
          <p className="mt-2 text-sm text-zinc-600">QR формируется внутри системы, без внешних сервисов.</p>
          <button type="button" onClick={() => window.print()} className="mt-6 w-full rounded-lg bg-[#032c4f] py-2.5 text-sm font-medium text-white hover:bg-[#042a4a]">
            Печать / PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function date(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}
