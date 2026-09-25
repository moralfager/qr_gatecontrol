"use client";

import Link from "next/link";
import { useState } from "react";

type PassType = "employee" | "vehicle";

const EMPLOYEE_PASS = {
  number: "Р-2025-37076",
  type: "для работника",
  organization: 'ТОО "Varro Operating Group"',
  fullName: "Елизаров Сергей Константинович",
  position: "Заместитель начальника ОИ",
  iin: "851201301109",
  validity: "с 29 декабря 2025 по 31 декабря 2026 года",
  object: 'Толқын',
  approvedBy: "Коданов К.К., 29-12-2025, 10:27",
};

const VEHICLE_PASS = {
  number: "ATC-2025-24162",
  type: "для автотранспортных средств",
  organization: 'ТОО "Varro Operating Group"',
  make: "TOYOTA LAND CRUISER 300",
  plate: "012UU12",
  trailer: "—",
  validity: "с 29 января 2026 по 31 декабря 2026 года",
  object: 'Толқын',
  approvedBy: "Коданов К.К., 03-02-2026, 15:14",
};

function QrCode({ data }: { data: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  return (
    <img
      src={url}
      alt="QR-код пропуска"
      className="h-[200px] w-[200px] shrink-0 rounded-lg border border-zinc-200 bg-white object-contain"
      width={200}
      height={200}
    />
  );
}

export default function PassFormPage() {
  const [passType, setPassType] = useState<PassType>("employee");

  const qrPayload =
    passType === "employee"
      ? JSON.stringify({ type: "R", id: "37076", number: EMPLOYEE_PASS.number })
      : JSON.stringify({ type: "ATC", id: "24162", number: VEHICLE_PASS.number });

  return (
    <div className="pass-page">
      <div className="mb-6 flex items-center gap-4 print:hidden">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#032c4f] hover:underline"
        >
          ← Главная
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[#032c4f] print:hidden">
        Формирование пропуска
      </h1>
      <p className="mt-2 text-zinc-600 print:hidden">
        Выберите тип пропуска и проверьте макет перед печатью.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setPassType("employee")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            passType === "employee"
              ? "bg-[#032c4f] text-white"
              : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
          }`}
        >
          Для работника
        </button>
        <button
          type="button"
          onClick={() => setPassType("vehicle")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            passType === "vehicle"
              ? "bg-[#032c4f] text-white"
              : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
          }`}
        >
          Для автотранспорта
        </button>
      </div>

      <div className="mt-8 flex flex-col items-start gap-6 lg:flex-row lg:items-stretch">
        <div className="w-full max-w-lg shrink-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg print:shadow-none">
          <div className="flex gap-6">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center" role="img" aria-label="Логотип">
                <span
                  className="block h-12 w-40 shrink-0 bg-[#032c4f] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:left_center] [-webkit-mask-size:contain] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:left_center]"
                  style={{
                    maskImage: "url(/Logo.webp)",
                    WebkitMaskImage: "url(/Logo.webp)",
                  }}
                />
              </div>

              {passType === "employee" ? (
                <>
                  <div>
                    <p className="text-xl font-semibold text-[#032c4f]">
                      Пропуск № {EMPLOYEE_PASS.number}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {EMPLOYEE_PASS.type}
                    </p>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <Row label="Наименование организации" value={EMPLOYEE_PASS.organization} />
                    <Row label="Ф.И.О. Работника" value={EMPLOYEE_PASS.fullName} />
                    <Row label="Должность" value={EMPLOYEE_PASS.position} />
                    <Row label="ИИН" value={EMPLOYEE_PASS.iin} />
                    <Row label="Срок действия пропуска" value={EMPLOYEE_PASS.validity} />
                    <Row label="Наименование объекта" value={EMPLOYEE_PASS.object} />
                    <Row label="Утвердил" value={EMPLOYEE_PASS.approvedBy} />
                  </dl>
                  <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                    Пропуск действителен при предъявлении удостоверения личности
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xl font-semibold text-[#032c4f]">
                      Пропуск № {VEHICLE_PASS.number}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {VEHICLE_PASS.type}
                    </p>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <Row label="Наименование организации" value={VEHICLE_PASS.organization} />
                    <Row label="Марка автотранспорта" value={VEHICLE_PASS.make} />
                    <Row label="Гос. номер" value={VEHICLE_PASS.plate} />
                    <Row label="Номер прицепа (если имеется)" value={VEHICLE_PASS.trailer} />
                    <Row label="Срок действия пропуска" value={VEHICLE_PASS.validity} />
                    <Row label="Наименование объекта" value={VEHICLE_PASS.object} />
                    <Row label="Утвердил" value={VEHICLE_PASS.approvedBy} />
                  </dl>
                </>
              )}
            </div>
            <div className="flex flex-col items-center">
              <QrCode data={qrPayload} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 print:hidden lg:min-w-[260px]">
          <h2 className="font-semibold text-[#032c4f]">Действия</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Макет пропуска сформирован. В реальной системе здесь будут кнопки:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-600">
            <li>Печать</li>
            <li>Скачать PDF</li>
            <li>Отправить на email</li>
          </ul>
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-6 w-full rounded-lg bg-[#032c4f] py-2.5 text-sm font-medium text-white hover:bg-[#042a4a]"
          >
            Печать (предпросмотр)
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
