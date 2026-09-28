import { CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><span aria-hidden="true">+</span><h3>{title}</h3><p>{description}</p>{children}</div>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast" role="status"><CheckCircle2 size={18}/><span>{message}</span><button aria-label="Fechar aviso" onClick={onClose}><X size={16}/></button></div>;
}

export function ConfirmDialog({ title, description, busy, onCancel, onConfirm }: { title: string; description: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Dialog title={title} description={description} onClose={onCancel}><div className="dialog-actions"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? "Removendo..." : "Remover horário"}</Button></div></Dialog>;
}
