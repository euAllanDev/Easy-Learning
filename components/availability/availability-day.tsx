import { Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { DAY_NAMES, type DayOfWeek } from "@/domain/availability/availability-types";
import { Button } from "@/components/ui/button";
import type { SerializedAvailability } from "./availability-panel";

export function AvailabilitySlot({ slot, onEdit, onRemove }: { slot: SerializedAvailability; onEdit: (slot: SerializedAvailability) => void; onRemove: (slot: SerializedAvailability) => void }) {
  return <li className="availability-slot"><div><Clock3 size={16}/><strong>{slot.startTime}</strong><span aria-hidden="true">—</span><strong>{slot.endTime}</strong></div><div><button aria-label={`Editar ${slot.startTime} a ${slot.endTime}`} onClick={() => onEdit(slot)}><Pencil size={16}/><span>Editar</span></button><button className="remove" aria-label={`Remover ${slot.startTime} a ${slot.endTime}`} onClick={() => onRemove(slot)}><Trash2 size={16}/><span>Remover</span></button></div></li>;
}

export function AvailabilityDay({ day, slots, onAdd, onEdit, onRemove }: { day: DayOfWeek; slots: SerializedAvailability[]; onAdd: (day: DayOfWeek) => void; onEdit: (slot: SerializedAvailability) => void; onRemove: (slot: SerializedAvailability) => void }) {
  return <article className={`availability-day ${slots.length ? "has-slots" : ""}`}><header><span>{String(day || 7).padStart(2, "0")}</span><h2>{DAY_NAMES[day]}</h2></header>{slots.length ? <ul>{slots.map((slot) => <AvailabilitySlot key={slot.id} slot={slot} onEdit={onEdit} onRemove={onRemove}/>)}</ul> : <p className="day-empty">Nenhum horário definido</p>}<Button variant="secondary" size="small" onClick={() => onAdd(day)}><Plus size={16}/> Adicionar horário</Button></article>;
}
