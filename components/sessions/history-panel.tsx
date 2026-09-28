"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Toast } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import type { StudySessionPeriod, StudySessionSummary } from "@/domain/study-session/study-session-types";
import { sessionsApi, type SerializedStudySession } from "@/lib/client/sessions-api";

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function HistoryPanel({ initialSessions, initialSummary }: { initialSessions: SerializedStudySession[]; initialSummary: StudySessionSummary }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [summary, setSummary] = useState(initialSummary);
  const [period, setPeriod] = useState<StudySessionPeriod>("week");
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function load(nextPeriod: StudySessionPeriod) {
    setBusy(true); setError("");
    try {
      const history = await sessionsApi.history(nextPeriod);
      setSessions(history.sessions); setSummary(history.summary); setPeriod(nextPeriod);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico."); }
    finally { setBusy(false); }
  }

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minutes = Number(data.get("minutes"));
    setBusy(true); setError("");
    try {
      await sessionsApi.create({
        type: "MANUAL", title: data.get("title"), plannedDurationSeconds: minutes * 60, actualDurationSeconds: minutes * 60,
        questions: data.get("questions") === "" ? null : Number(data.get("questions")),
        correctAnswers: data.get("correctAnswers") === "" ? null : Number(data.get("correctAnswers")),
        difficulty: data.get("difficulty"), notes: data.get("notes") || null,
      });
      await load(period); setManualOpen(false); setToast("Atividade registrada");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a atividade."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="SEU PROGRESSO" title="Histórico de estudo" description="Resultados reais das suas sessões, persistidos no Fluxo." action={<Button onClick={() => { setError(""); setManualOpen(true); }}><Plus size={18}/> Registrar atividade</Button>}/>
    <div className="history-tabs" aria-label="Período">{(["today", "week", "month"] as const).map((value) => <Button key={value} size="small" variant={period === value ? "primary" : "secondary"} disabled={busy} onClick={() => void load(value)}>{value === "today" ? "Hoje" : value === "week" ? "Semana" : "Mês"}</Button>)}</div>
    {error && !manualOpen && <p className="session-alert" role="alert">{error}</p>}
    <div className="history-summary"><article><span>Sessões concluídas</span><strong>{summary.completedSessions}</strong></article><article><span>Tempo estudado</span><strong>{duration(summary.actualDurationSeconds)}</strong></article><article><span>Questões / acertos</span><strong>{summary.questions} / {summary.correctAnswers}</strong></article><article><span>Aproveitamento</span><strong>{summary.accuracy === null ? "—" : `${summary.accuracy.toFixed(2)}%`}</strong></article></div>
    {!sessions.length ? <EmptyState title="Nenhuma sessão concluída neste período." description="Conclua uma sessão ou registre uma atividade externa para iniciar seu histórico."/> : <div className="history-list">{[...sessions].reverse().map((session) => <article key={session.id}><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.completedAt ?? session.updatedAt))}</time><div><h2>{session.topicName ?? session.title ?? session.areaName ?? session.objectiveName ?? "Sessão de estudo"}</h2><p>{session.type === "MANUAL" ? "Manual" : "Planejada"} · {duration(session.actualDurationSeconds ?? 0)}</p></div><dl><div><dt>Questões</dt><dd>{session.questions ?? "—"}</dd></div><div><dt>Acertos</dt><dd>{session.correctAnswers ?? "—"}</dd></div><div><dt>Aproveitamento</dt><dd>{session.accuracy === null ? "—" : `${session.accuracy.toFixed(2)}%`}</dd></div></dl></article>)}</div>}
    {manualOpen && <Dialog eyebrow="ATIVIDADE MANUAL" title="O que você estudou?" description="Registre uma atividade que não estava no planejamento." onClose={() => setManualOpen(false)}><form className="session-result-form" onSubmit={createManual}><label>Atividade<Input name="title" required placeholder="Ex.: Alemão"/></label><label>Tempo estudado (minutos)<Input name="minutes" type="number" min={1} required/></label><div><label>Questões<Input name="questions" type="number" min={0}/></label><label>Acertos<Input name="correctAnswers" type="number" min={0}/></label></div><label>Dificuldade<Select name="difficulty" defaultValue="NORMAL"><option value="EASY">Fácil</option><option value="NORMAL">Normal</option><option value="HARD">Difícil</option></Select></label><label>Observação<textarea className="ui-input" name="notes" maxLength={2000}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="secondary" onClick={() => setManualOpen(false)}>Cancelar</Button><Button disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar atividade"}</Button></div></form></Dialog>}
    {toast && <Toast message={toast} onClose={() => setToast("")}/>} 
  </>;
}
