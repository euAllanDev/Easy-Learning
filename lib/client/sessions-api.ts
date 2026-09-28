import type { StudySession, StudySessionPeriod, StudySessionSummary } from "@/domain/study-session/study-session-types";

export type SerializedStudySession = Omit<StudySession, "userId" | "plannedStartAt" | "plannedEndAt" | "startedAt" | "pausedAt" | "resumedAt" | "completedAt" | "createdAt" | "updatedAt"> & {
  plannedStartAt: string;
  plannedEndAt: string;
  startedAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class SessionsApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers });
  } catch {
    throw new SessionsApiError("Erro de rede. Verifique sua conexão e tente novamente.", "NETWORK_ERROR");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    const messages: Record<string, string> = {
      SESSION_NOT_FOUND: "Sessão não encontrada.",
      INVALID_SESSION_TRANSITION: "Esta sessão já mudou de estado. Atualize a página.",
      ACTIVE_SESSION_EXISTS: "Você já possui outra sessão ativa.",
      CONCURRENT_CHANGE: "A sessão foi alterada em outro dispositivo. Atualize a página.",
    };
    throw new SessionsApiError(body?.message ?? messages[body?.error ?? ""] ?? "Não foi possível atualizar a sessão.", body?.error, response.status);
  }
  return response.json() as Promise<T>;
}

export const sessionsApi = {
  list: () => request<SerializedStudySession[]>("/api/v1/sessions"),
  get: (id: string) => request<SerializedStudySession>(`/api/v1/sessions/${id}`),
  create: (input: object) => request<SerializedStudySession>("/api/v1/sessions", { method: "POST", body: JSON.stringify(input) }),
  action: (id: string, action: "start" | "pause" | "resume" | "complete" | "skip" | "cancel" | "reschedule", input: object = {}) => request<SerializedStudySession>(`/api/v1/sessions/${id}/${action}`, { method: "POST", body: JSON.stringify(input) }),
  history: (period: StudySessionPeriod) => request<{ sessions: SerializedStudySession[]; summary: StudySessionSummary }>(`/api/v1/sessions/history?period=${period}`),
};
