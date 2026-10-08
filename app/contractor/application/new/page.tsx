"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type FormType = "workers" | "vehicles";

type DictItem = { id: number; name: string; code?: string; active: boolean };
type Organization = { id: number; name: string; active: boolean };
type RequiredDoc = { target_type: "profession" | "vehicle_type"; target_id: number; id: number; code: string; name: string };
type ExistingDocument = {
  id: number;
  subject_type: "worker" | "vehicle";
  subject_id: number;
  document_code: string;
  document_name: string;
  original_name: string;
};
type EditableApplicationDetails = {
  application: {
    id: number;
    type: string;
    status: string;
    organization_id: number | null;
    comment: string;
  };
  zones: { id: number }[];
  workers: Array<{
    id: number;
    full_name: string;
    position: string;
    iin: string;
    validity_from: string;
    validity_to: string;
    profession_id: number;
  }>;
  vehicles: Array<{
    id: number;
    make: string;
    plate: string;
    trailer: string | null;
    validity_from: string;
    validity_to: string;
    vehicle_type_id: number;
  }>;
  documents: ExistingDocument[];
};

type CurrentUser = {
  role: string;
  department: string | null;
  organization_id: number | null;
  organization_name: string | null;
};

interface Dictionaries {
  professions: DictItem[];
  vehicleTypes: DictItem[];
  zones: DictItem[];
  organizations: Organization[];
  requiredDocuments: RequiredDoc[];
}

interface WorkerRow {
  id: string;
  fullName: string;
  position: string;
  iin: string;
  validityFrom: string;
  validityTo: string;
  professionId: number;
}

interface VehicleRow {
  id: string;
  make: string;
  plate: string;
  trailer: string;
  validityFrom: string;
  validityTo: string;
  typeId: number;
}

const TYPE_LABELS: Record<FormType, string> = {
  workers: "Работники",
  vehicles: "Автотранспорт",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function endOfYear() {
  const d = new Date();
  return `${d.getFullYear()}-12-31`;
}

function dateInput(value: string) {
  if (!value) return today();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewApplicationPage() {
  return <ApplicationForm />;
}

export function ApplicationForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const backHref = pathname?.startsWith("/approver") ? "/approver" : "/contractor";
  const backLabel = pathname?.startsWith("/approver") ? "Кабинет согласующего" : "Кабинет подрядчика";
  const [dict, setDict] = useState<Dictionaries | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizationId, setOrganizationId] = useState<number>(0);
  const [formType, setFormType] = useState<FormType>("workers");
  const [zoneIds, setZoneIds] = useState<number[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [existingFiles, setExistingFiles] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/dictionaries"), fetch("/api/me"), editId ? fetch(`/api/applications/${editId}`) : Promise.resolve(null)])
      .then(async ([dictResponse, meResponse, editResponse]) => {
        const data = await dictResponse.json();
        const me = await meResponse.json();
        const editData = editResponse ? await editResponse.json() : null;
        if (!dictResponse.ok) throw new Error(data.error || "Не удалось загрузить справочники");
        if (!meResponse.ok) throw new Error(me.error || "Не удалось определить пользователя");
        if (editResponse && !editResponse.ok) throw new Error(editData.error || "Заявка не найдена");
        return { data, user: me.user as CurrentUser | null, editData: editData as EditableApplicationDetails | null };
      })
      .then(({ data, user, editData }) => {
        const activeProfessions = data.professions.filter((p: DictItem) => p.active);
        const activeVehicleTypes = data.vehicleTypes.filter((v: DictItem) => v.active);
        const activeZones = data.zones.filter((z: DictItem) => z.active);
        const activeOrganizations = data.organizations.filter((org: Organization) => org.active);
        const canChooseOrganization = user?.role === "admin" || (user?.role === "approver" && user.department === "ТБ");
        setDict({
          professions: activeProfessions,
          vehicleTypes: activeVehicleTypes,
          zones: activeZones,
          organizations: activeOrganizations,
          requiredDocuments: data.requiredDocuments,
        });
        setCurrentUser(user);
        if (editData) {
          if (!["draft", "returned"].includes(editData.application.status)) {
            throw new Error("Заявку можно менять только в статусе Черновик или На доработке.");
          }
          setOrganizationId(canChooseOrganization ? editData.application.organization_id ?? 0 : user?.organization_id ?? 0);
          setZoneIds(editData.zones.map((zone) => zone.id));
          setComment(editData.application.comment ?? "");
          setFormType(editData.application.type === "vehicles" ? "vehicles" : "workers");
          setWorkers(editData.workers.length ? editData.workers.map((worker) => ({
            id: String(worker.id),
            fullName: worker.full_name,
            position: worker.position,
            iin: worker.iin,
            validityFrom: dateInput(worker.validity_from),
            validityTo: dateInput(worker.validity_to),
            professionId: worker.profession_id,
          })) : [{
            id: "w1",
            fullName: "",
            position: activeProfessions[0]?.name ?? "",
            iin: "",
            validityFrom: today(),
            validityTo: endOfYear(),
            professionId: activeProfessions[0]?.id ?? 0,
          }]);
          setVehicles(editData.vehicles.length ? editData.vehicles.map((vehicle) => ({
            id: String(vehicle.id),
            make: vehicle.make,
            plate: vehicle.plate,
            trailer: vehicle.trailer || "—",
            validityFrom: dateInput(vehicle.validity_from),
            validityTo: dateInput(vehicle.validity_to),
            typeId: vehicle.vehicle_type_id,
          })) : [{
            id: "v1",
            make: "",
            plate: "",
            trailer: "—",
            validityFrom: today(),
            validityTo: endOfYear(),
            typeId: activeVehicleTypes[0]?.id ?? 0,
          }]);
          const existing: Record<string, string> = {};
          for (const document of editData.documents) {
            existing[fileKey(document.subject_type, String(document.subject_id), document.document_code)] = document.original_name;
          }
          setExistingFiles(existing);
          return;
        }
        setOrganizationId(canChooseOrganization ? activeOrganizations[0]?.id ?? 0 : user?.organization_id ?? 0);
        setZoneIds(activeZones[0] ? [activeZones[0].id] : []);
        setWorkers([
          {
            id: "w1",
            fullName: "",
            position: activeProfessions[0]?.name ?? "",
            iin: "",
            validityFrom: today(),
            validityTo: endOfYear(),
            professionId: activeProfessions[0]?.id ?? 0,
          },
        ]);
        setVehicles([
          {
            id: "v1",
            make: "",
            plate: "",
            trailer: "—",
            validityFrom: today(),
            validityTo: endOfYear(),
            typeId: activeVehicleTypes[0]?.id ?? 0,
          },
        ]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить справочники"));
  }, [editId]);

  useEffect(() => {
    if (editId) return;
    const typeParam = new URLSearchParams(window.location.search).get("type");
    if (typeParam === "vehicles") setFormType("vehicles");
  }, [editId]);

  const activeWorkers = formType === "workers" ? workers : [];
  const activeVehicles = formType === "vehicles" ? vehicles : [];

  const canChooseOrganization = currentUser?.role === "admin" || (currentUser?.role === "approver" && currentUser.department === "ТБ");
  const canSubmit = useMemo(
    () => Boolean(dict && organizationId && zoneIds.length && (activeWorkers.length || activeVehicles.length)),
    [dict, organizationId, zoneIds, activeWorkers.length, activeVehicles.length],
  );

  function docsForWorker(worker: WorkerRow) {
    return dict?.requiredDocuments.filter((d) => d.target_type === "profession" && d.target_id === worker.professionId) ?? [];
  }

  function docsForVehicle(vehicle: VehicleRow) {
    return dict?.requiredDocuments.filter((d) => d.target_type === "vehicle_type" && d.target_id === vehicle.typeId) ?? [];
  }

  function fileKey(kind: "worker" | "vehicle", rowId: string, code: string) {
    return `${kind}:${rowId}:${code}`;
  }

  function addWorker() {
    const profession = dict?.professions[0];
    setWorkers((prev) => [
      ...prev,
      {
        id: `w${Date.now()}`,
        fullName: "",
        position: profession?.name ?? "",
        iin: "",
        validityFrom: today(),
        validityTo: endOfYear(),
        professionId: profession?.id ?? 0,
      },
    ]);
  }

  function addVehicle() {
    const type = dict?.vehicleTypes[0];
    setVehicles((prev) => [
      ...prev,
      {
        id: `v${Date.now()}`,
        make: "",
        plate: "",
        trailer: "—",
        validityFrom: today(),
        validityTo: endOfYear(),
        typeId: type?.id ?? 0,
      },
    ]);
  }

  function validateForSubmit() {
    const missing: string[] = [];
    for (const worker of activeWorkers) {
      if (!worker.fullName.trim()) missing.push(`${worker.id}: ФИО`);
      if (!worker.iin.trim()) missing.push(`${worker.fullName || worker.id}: ИИН`);
      for (const doc of docsForWorker(worker)) {
        const key = fileKey("worker", worker.id, doc.code);
        if (!files[key] && !existingFiles[key]) missing.push(`${worker.fullName || worker.id}: ${doc.name}`);
      }
    }
    for (const vehicle of activeVehicles) {
      if (!vehicle.make.trim()) missing.push(`${vehicle.id}: марка`);
      if (!vehicle.plate.trim()) missing.push(`${vehicle.make || vehicle.id}: госномер`);
      for (const doc of docsForVehicle(vehicle)) {
        const key = fileKey("vehicle", vehicle.id, doc.code);
        if (!files[key] && !existingFiles[key]) missing.push(`${vehicle.plate || vehicle.id}: ${doc.name}`);
      }
    }
    return missing;
  }

  async function save(action: "draft" | "submit") {
    setError("");
    setMessage("");
    if (!canSubmit) {
      setError("Заполните заявку и выберите территорию.");
      return;
    }
    if (action === "submit") {
      const missing = validateForSubmit();
      if (missing.length) {
        setError(`Нельзя отправить: не хватает данных/документов:\n${missing.join("\n")}`);
        return;
      }
    }
    setBusy(true);
    const payload = {
      type: formType,
      action,
      organizationId,
      zoneIds,
      comment,
      workers: activeWorkers,
      vehicles: activeVehicles,
    };
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    for (const [key, file] of Object.entries(files)) {
      formData.append(key, file);
    }
    try {
      const response = await fetch(editId ? `/api/applications/${editId}` : "/api/applications", { method: editId ? "PUT" : "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить заявку");
      setMessage(action === "submit" ? "Заявка отправлена на согласование." : "Черновик сохранён.");
      router.push(`/contractor/application/${data.application.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  if (!dict) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка справочников...</div>;
  }

  return (
    <div className="space-y-8">
      <Link href={backHref} className="text-sm font-medium text-[#032c4f] hover:underline">← {backLabel}</Link>
      <div>
          <h1 className="text-2xl font-semibold text-[#032c4f]">{editId ? "Изменение заявки" : "Новая заявка на пропуск"}</h1>
          <p className="mt-1 text-zinc-600">{editId ? "После правок отправьте заявку на согласование повторно." : "Документы загружаются отдельно по каждому работнику или ТС."}</p>
      </div>

      {error && <pre className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</pre>}
      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-[#032c4f]">Организация</h2>
        <div className="mt-3 max-w-xl">
          {canChooseOrganization ? (
            <select value={organizationId} onChange={(e) => setOrganizationId(Number(e.target.value))} className="input">
              <option value={0}>Выберите организацию</option>
              {dict.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {currentUser?.organization_name || "Организация не привязана к учетной записи"}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-[#032c4f]">Тип заявки</h2>
        {editId ? (
          <div className="mt-3 max-w-xl rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
            {TYPE_LABELS[formType]}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setFormType("workers")} className={tabClass(formType === "workers")}>Работники</button>
            <button type="button" onClick={() => setFormType("vehicles")} className={tabClass(formType === "vehicles")}>Автотранспорт</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-[#032c4f]">Объект(ы) / территории</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {dict.zones.map((z) => (
            <label key={z.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 has-[:checked]:border-[#032c4f] has-[:checked]:bg-[#032c4f]/5">
              <input type="checkbox" checked={zoneIds.includes(z.id)} onChange={() => setZoneIds((prev) => prev.includes(z.id) ? prev.filter((id) => id !== z.id) : [...prev, z.id])} />
              <span className="text-sm">{z.name}</span>
            </label>
          ))}
        </div>
      </section>

      {formType === "workers" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#032c4f]">Работники</h2>
            <button type="button" onClick={addWorker} className="rounded-lg bg-[#032c4f] px-4 py-2 text-sm font-medium text-white">+ Добавить</button>
          </div>
          <div className="mt-4 space-y-5">
            {workers.map((worker, index) => (
              <div key={worker.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-600">Работник {index + 1}</span>
                  {workers.length > 1 && <button type="button" onClick={() => setWorkers((prev) => prev.filter((w) => w.id !== worker.id))} className="text-sm text-red-600">Удалить</button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="ФИО"><input value={worker.fullName} onChange={(e) => setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, fullName: e.target.value } : w))} className="input" /></Field>
                  <Field label="Профессия">
                    <select value={worker.professionId} onChange={(e) => {
                      const professionId = Number(e.target.value);
                      const profession = dict.professions.find((p) => p.id === professionId);
                      setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, professionId, position: profession?.name ?? w.position } : w));
                    }} className="input">
                      {dict.professions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="ИИН"><input value={worker.iin} onChange={(e) => setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, iin: e.target.value } : w))} className="input" /></Field>
                  <Field label="Срок с"><input type="date" value={worker.validityFrom} onChange={(e) => setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, validityFrom: e.target.value } : w))} className="input" /></Field>
                  <Field label="Срок по"><input type="date" value={worker.validityTo} onChange={(e) => setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, validityTo: e.target.value } : w))} className="input" /></Field>
                </div>
                <DocumentInputs docs={docsForWorker(worker)} rowId={worker.id} kind="worker" files={files} existingFiles={existingFiles} setFiles={setFiles} fileKey={fileKey} />
              </div>
            ))}
          </div>
        </section>
      )}

      {formType === "vehicles" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#032c4f]">Автотранспорт</h2>
            <button type="button" onClick={addVehicle} className="rounded-lg bg-[#032c4f] px-4 py-2 text-sm font-medium text-white">+ Добавить</button>
          </div>
          <div className="mt-4 space-y-5">
            {vehicles.map((vehicle, index) => (
              <div key={vehicle.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-600">ТС {index + 1}</span>
                  {vehicles.length > 1 && <button type="button" onClick={() => setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id))} className="text-sm text-red-600">Удалить</button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Вид ТС">
                    <select value={vehicle.typeId} onChange={(e) => setVehicles((prev) => prev.map((v) => v.id === vehicle.id ? { ...v, typeId: Number(e.target.value) } : v))} className="input">
                      {dict.vehicleTypes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Марка"><input value={vehicle.make} onChange={(e) => setVehicles((prev) => prev.map((v) => v.id === vehicle.id ? { ...v, make: e.target.value } : v))} className="input" /></Field>
                  <Field label="Госномер"><input value={vehicle.plate} onChange={(e) => setVehicles((prev) => prev.map((v) => v.id === vehicle.id ? { ...v, plate: e.target.value } : v))} className="input" /></Field>
                  <Field label="Прицеп"><input value={vehicle.trailer} onChange={(e) => setVehicles((prev) => prev.map((v) => v.id === vehicle.id ? { ...v, trailer: e.target.value } : v))} className="input" /></Field>
                  <Field label="Срок с"><input type="date" value={vehicle.validityFrom} onChange={(e) => setVehicles((prev) => prev.map((v) => v.id === vehicle.id ? { ...v, validityFrom: e.target.value } : v))} className="input" /></Field>
                  <Field label="Срок по"><input type="date" value={vehicle.validityTo} onChange={(e) => setVehicles((prev) => prev.map((v) => v.id === vehicle.id ? { ...v, validityTo: e.target.value } : v))} className="input" /></Field>
                </div>
                <DocumentInputs docs={docsForVehicle(vehicle)} rowId={vehicle.id} kind="vehicle" files={files} existingFiles={existingFiles} setFiles={setFiles} fileKey={fileKey} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <Field label="Комментарий"><textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input min-h-24" /></Field>
      </section>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5">
        <button type="button" disabled={busy} onClick={() => save("draft")} className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Сохранить черновик</button>
        <button type="button" disabled={busy} onClick={() => save("submit")} className="rounded-lg bg-[#032c4f] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#042a4a] disabled:opacity-50">{editId ? "Отправить повторно" : "Отправить на согласование"}</button>
        <Link href="/contractor" className="text-sm font-medium text-zinc-600 hover:underline">Отмена</Link>
        <span className="text-xs text-zinc-500">Срок действия документов пока не проверяется автоматически: оставлено в TODO до OCR/метаданных.</span>
      </div>
    </div>
  );
}

function tabClass(active: boolean) {
  return `rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-[#032c4f] bg-[#032c4f] text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function DocumentInputs({
  docs,
  rowId,
  kind,
  files,
  existingFiles,
  setFiles,
  fileKey,
}: {
  docs: RequiredDoc[];
  rowId: string;
  kind: "worker" | "vehicle";
  files: Record<string, File>;
  existingFiles: Record<string, string>;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, File>>>;
  fileKey: (kind: "worker" | "vehicle", rowId: string, code: string) => string;
}) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-[#032c4f]">Документы</h3>
      <div className="mt-3 grid gap-3">
        {docs.map((doc) => {
          const key = fileKey(kind, rowId, doc.code);
          return (
            <label key={doc.code} className="grid gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 md:grid-cols-[1fr_auto] md:items-center">
              <span className="text-sm text-zinc-700">{doc.name}</span>
              <span className="flex items-center gap-2">
                <input type="file" className="max-w-64 text-sm" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setFiles((prev) => ({ ...prev, [key]: file }));
                }} />
                {(files[key] || existingFiles[key]) && (
                  <span className="max-w-48 truncate text-xs text-green-700">
                    {files[key]?.name ?? existingFiles[key]}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
