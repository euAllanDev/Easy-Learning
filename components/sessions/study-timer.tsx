"use client";

import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionTimer } from "@/hooks/use-study-session";
import type { SerializedStudySession } from "@/lib/client/sessions-api";

function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function StudyTimer({ session, busy, onAction, onFinish }: {
  session: SerializedStudySession;
  busy: boolean;
  onAction: (action: "pause" | "resume" | "cancel") => void;
  onFinish: (elapsedSeconds: number) => void;
}) {
  const timer = useSessionTimer(session);
  const overtime = timer.elapsedSeconds >= session.plannedDurationSeconds;
  return <section className={`study-timer ${session.status === "PAUSED" ? "paused" : "running"}`} aria-label="Timer da sessão">
    <p className="kicker">{session.objectiveName ?? (session.type === "MANUAL" ? "ATIVIDADE MANUAL" : "SESSÃO ATUAL")}</p>
    <h2>{session.topicName ?? session.title ?? session.areaName ?? "Sessão de estudo"}</h2>
    <p className="timer-mode">{session.status === "PAUSED" ? "Pausada" : overtime ? "Tempo adicional" : "Tempo restante"}</p>
    <output aria-live="off">{clock(overtime ? timer.elapsedSeconds : timer.remainingSeconds)}</output>
    <div className="timer-actions">
      <Button disabled={busy} onClick={() => onAction(session.status === "PAUSED" ? "resume" : "pause")}>
        {session.status === "PAUSED" ? <><Play size={20}/> Retomar</> : <><Pause size={20}/> Pausar</>}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => onFinish(timer.elapsedSeconds)}><Square size={18}/> Finalizar</Button>
      <button className="timer-cancel" disabled={busy} onClick={() => onAction("cancel")}>Cancelar sessão</button>
    </div>
  </section>;
}
