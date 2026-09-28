"use client";

import { useEffect, useState } from "react";
import { sessionsApi, type SerializedStudySession } from "@/lib/client/sessions-api";

export function useStudySession(initialSessions: SerializedStudySession[]) {
  const [sessions, setSessions] = useState(initialSessions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    const fresh = await sessionsApi.list();
    setSessions(fresh);
    return fresh;
  }

  async function act(id: string, action: Parameters<typeof sessionsApi.action>[1], input?: object) {
    if (busyId) return null;
    setBusyId(id);
    setError("");
    try {
      const updated = await sessionsApi.action(id, action, input);
      setSessions((current) => current.map((session) => session.id === id ? updated : session));
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a sessão.");
      await reload().catch(() => undefined);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  return { sessions, setSessions, busyId, error, setError, reload, act };
}

export function useActiveSession(sessions: SerializedStudySession[]) {
  return sessions.find((session) => session.status === "IN_PROGRESS" || session.status === "PAUSED") ?? null;
}

export function useSessionTimer(session: SerializedStudySession | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (session?.status !== "IN_PROGRESS") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.id, session?.status, session?.resumedAt]);

  if (!session) return { elapsedSeconds: 0, remainingSeconds: 0 };
  const liveSeconds = session.status === "IN_PROGRESS" && session.resumedAt
    ? Math.max(0, Math.floor((now - new Date(session.resumedAt).getTime()) / 1000))
    : 0;
  const elapsedSeconds = session.focusedSeconds + liveSeconds;
  return { elapsedSeconds, remainingSeconds: Math.max(0, session.plannedDurationSeconds - elapsedSeconds) };
}
