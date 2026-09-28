"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { DAY_NAMES, DAYS_OF_WEEK, type Availability, type DayOfWeek } from "@/domain/availability/availability-types";
import { AvailabilityDay } from "./availability-day";
import { AvailabilityForm, type AvailabilityValues } from "./availability-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, EmptyState, Toast } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

const emptyValues: AvailabilityValues = { dayOfWeek: 1, startTime: "", endTime: "" };
export type SerializedAvailability = Omit<Availability, "userId" | "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  if (body?.message) return body.message;
  if (body?.error === "INVALID_REQUEST") return "Revise o dia e os horários informados.";
  return "Não foi possível salvar seu horário. Tente novamente.";
}

export function AvailabilityPanel() {
  const [slots, setSlots] = useState<SerializedAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SerializedAvailability | AvailabilityValues | null>(null);
  const [removing, setRemoving] = useState<SerializedAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [toast, setToast] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/v1/availability", { cache: "no-store" });
      if (!response.ok) throw new Error("Request failed");
      setSlots(await response.json() as SerializedAvailability[]);
      setPageError("");
    } catch {
      setPageError("Não foi possível carregar sua disponibilidade. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function beginAdd(day: DayOfWeek = 1) {
    setError("");
    setEditing({ ...emptyValues, dayOfWeek: day });
  }

  async function save(values: AvailabilityValues) {
    setBusy(true);
    setError("");
    const existing = editing && "id" in editing ? editing : null;
    try {
      const response = await fetch(existing ? `/api/v1/availability/${existing.id}` : "/api/v1/availability", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      await load();
      setEditing(null);
      setToast(existing ? "Horário atualizado" : "Horário adicionado");
    } catch {
      setError("Não foi possível salvar seu horário. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/availability/${removing.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Request failed");
      await load();
      setRemoving(null);
      setToast("Horário removido");
    } catch {
      setPageError("Não foi possível remover este horário. Tente novamente.");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeader eyebrow="SUA SEMANA" title="Quando você pode estudar?" description="Defina os períodos habituais. O Fluxo usará essa base para construir uma rotina que respeita seu tempo." action={<Button onClick={() => beginAdd()}><Plus size={18}/> Novo horário</Button>}/>
    {loading ? <div className="availability-grid" aria-label="Carregando disponibilidade">{DAYS_OF_WEEK.slice(0, 4).map((day) => <div className="availability-skeleton" key={day}><span/><i/><i/><b/></div>)}</div> : pageError ? <EmptyState title="Algo saiu do fluxo" description={pageError}><Button onClick={() => { setLoading(true); void load(); }}>Tentar novamente</Button></EmptyState> : <>
      {!slots.length && <EmptyState title="Sua disponibilidade ainda não foi configurada." description="Adicione os períodos em que normalmente consegue estudar."/>}
      <div className="availability-grid">{DAYS_OF_WEEK.map((day) => <AvailabilityDay key={day} day={day} slots={slots.filter((slot) => slot.dayOfWeek === day)} onAdd={beginAdd} onEdit={(slot) => { setError(""); setEditing(slot); }} onRemove={setRemoving}/>)}</div>
    </>}
    {editing && <AvailabilityForm initialValues={{ dayOfWeek: editing.dayOfWeek, startTime: editing.startTime, endTime: editing.endTime }} busy={busy} error={error} onCancel={() => setEditing(null)} onSave={save}/>} 
    {removing && <ConfirmDialog title="Remover horário?" description={`${DAY_NAMES[removing.dayOfWeek]}, das ${removing.startTime} às ${removing.endTime}. Esta ação não pode ser desfeita.`} busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove}/>} 
    {toast && <Toast message={toast} onClose={() => setToast("")}/>} 
  </>;
}
