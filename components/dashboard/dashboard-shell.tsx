import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./logout-button";

type User = { name: string; email: string };

export function DashboardShell({ user, active, children }: { user: User; active: "today" | "availability" | "history"; children: ReactNode }) {
  return <main className="dashboard-shell"><aside><Link className="brand light" href="/hoje">fluxo<span>.</span></Link><nav><Link className={active === "today" ? "active" : ""} href="/hoje">Hoje</Link><Link className={active === "availability" ? "active" : ""} href="/disponibilidade">Disponibilidade</Link><span>Foco</span><Link className={active === "history" ? "active" : ""} href="/historico">Histórico</Link></nav><div><small>{user.email}</small><strong>{user.name}</strong><LogoutButton/></div></aside><div className="dashboard-content">{children}</div></main>;
}
