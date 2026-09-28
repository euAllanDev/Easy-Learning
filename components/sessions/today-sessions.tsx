"use client";

import { CalendarClock, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { CompletionDialog } from "./completion-dialog";
import { StudyTimer } from "./study-timer";
import { useActiveSession, useStudySession } from "@/hooks/use-study-session";
import type { SerializedStudySession } from "@/lib/client/sessions-api";

function sameLocalDay(iso: string, date: Date) {
  const value = new Date(iso);
  return value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth() && value.getDate() === date.getDate();
}
function time(iso: string) { return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); }
function duration(seconds: number) { return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`; }

export function TodaySessions({ initialSessions }: { initialSessions: SerializedStudySession[] }) {
  const state = useStudySession(initialSessions);
  const active = useActiveSession(state.sessions);
  const today = state.sessions.filter((session) => sameLocalDay(session.plannedStartAt, new Date()));
  const planned = today.filter((session) => session.status === "PLANNED");
  const studied = today.filter((session) => session.status === "COMPLETED").reduce((sum, session) => sum + (session.actualDurationSeconds ?? 0), 0);
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekly = state.sessions.filter((session) => session.status === "COMPLETED" && new Date(session.completedAt ?? session.updatedAt) >= weekStart).reduce((sum, session) => sum + (session.actualDurationSeconds ?? 0), 0);
  const [finishing, setFinishing] = useState<{ id: string; elapsed: number } | null>(null);

  async function finish(result: object) {
    if (!finishing) return;
    const updated = await state.act(finishing.id, "complete", result);
    if (updated) setFinishing(null);
  }

  return <section className="today-sessions">
    <div className="today-metrics"><article><span>Tempo estudado hoje</span><strong>{duration(studied)}</strong></article><article><span>Progresso semanal</span><strong>{duration(weekly)}</strong></article><article><span>Sessões de hoje</span><strong>{today.length}</strong></article></div>
    {state.error && !finishing && <p className="session-alert" role="alert">{state.error}</p>}
    {active ? <StudyTimer session={active} busy={state.busyId === active.id} onAction={(action) => void state.act(active.id, action)} onFinish={(elapsed) => { state.setError(""); setFinishing({ id: active.id, elapsed }); }}/>
      : planned[0] ? <article className="next-session"><div><p className="kicker">PRÓXIMA SESSÃO</p><h2>{planned[0].topicName ?? planned[0].title ?? planned[0].areaName ?? planned[0].objectiveName ?? "Sessão de estudo"}</h2><p><CalendarClock size={17}/> {time(planned[0].plannedStartAt)} → {time(planned[0].plannedEndAt)}</p></div><Button disabled={state.busyId === planned[0].id} onClick={() => void state.act(planned[0].id, "start")}><Play size={18}/> Iniciar sessão</Button></article>
      : <EmptyState title="Nenhuma sessão planejada para hoje." description="Quando sua rotina gerar uma sessão, ela aparecerá aqui."/>}
    {today.length > 0 && <div className="session-day-list"><h2>Sessões de hoje</h2>{today.map((session) => <article key={session.id}><div><strong>{session.topicName ?? session.title ?? session.areaName ?? session.objectiveName ?? "Sessão de estudo"}</strong><span>{time(session.plannedStartAt)} → {time(session.plannedEndAt)}</span></div><span className={`session-status ${session.status.toLowerCase()}`}>{session.status.replace("_", " ")}</span>{session.status === "PLANNED" && <Button size="small" variant="secondary" disabled={Boolean(state.busyId)} onClick={() => void state.act(session.id, "start")}>Iniciar</Button>}</article>)}</div>}
    {finishing && <CompletionDialog elapsedSeconds={finishing.elapsed} busy={state.busyId === finishing.id} error={state.error} onCancel={() => setFinishing(null)} onSave={(result) => void finish(result)}/>} 
  </section>;
}
