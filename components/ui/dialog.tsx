import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Dialog({ title, description, eyebrow = "FLUXO", onClose, children }: { title: string; description?: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <header><div><p className="kicker">{eyebrow}</p><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}</div><Button variant="secondary" size="small" aria-label="Fechar" onClick={onClose}><X size={18}/></Button></header>
      {children}
    </section>
  </div>;
}
