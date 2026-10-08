"use client";

import { useEffect, useState } from "react";
import { ApplicationForm } from "../../../../contractor/application/new/page";

export default function EditApproverApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");

  useEffect(() => {
    params.then((value) => setId(value.id));
  }, [params]);

  if (!id) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-500">Загрузка...</div>;
  }

  return <ApplicationForm editId={id} />;
}
