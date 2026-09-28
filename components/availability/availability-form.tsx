"use client";

import { useState, type FormEvent } from "react";
import { DAY_NAMES, DAYS_OF_WEEK, type DayOfWeek } from "@/domain/availability/availability-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select, TimeInput } from "@/components/ui/form-controls";

export type AvailabilityValues = { dayOfWeek: DayOfWeek; startTime: string; endTime: string };

export function AvailabilityForm({ initialValues, busy, error, onCancel, onSave }: { initialValues: AvailabilityValues; busy: boolean; error: string; onCancel: () => void; onSave: (values: AvailabilityValues) => Promise<void> }) {
  const [values, setValues] = useState(initialValues);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(values);
  }

  return <Dialog title={initialValues.startTime ? "Editar horário" : "Adicionar horário"} description="Use o horário local em que você normalmente consegue estudar." onClose={onCancel}>
    <form className="availability-form" onSubmit={submit}>
      <label>Dia<Select value={values.dayOfWeek} onChange={(event) => setValues({ ...values, dayOfWeek: Number(event.target.value) as DayOfWeek })}>{DAYS_OF_WEEK.map((day) => <option value={day} key={day}>{DAY_NAMES[day]}</option>)}</Select></label>
      <div className="time-fields"><label>Início<TimeInput required value={values.startTime} onChange={(event) => setValues({ ...values, startTime: event.target.value })}/></label><label>Fim<TimeInput required value={values.endTime} onChange={(event) => setValues({ ...values, endTime: event.target.value })}/></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></div>
    </form>
  </Dialog>;
}
