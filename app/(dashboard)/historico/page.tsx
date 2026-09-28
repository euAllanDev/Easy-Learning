import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudySessionService } from "@/application/study-session/study-session-service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { HistoryPanel } from "@/components/sessions/history-panel";
import { currentUser } from "@/infrastructure/auth/session";
import { DrizzleStudySessionRepository } from "@/infrastructure/repositories/drizzle-study-session-repository";
import { serializeStudySession } from "@/lib/api/serialize";

export const metadata: Metadata = { title: "Histórico" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const history = await new StudySessionService(new DrizzleStudySessionRepository()).history(user.id, "week");
  return <DashboardShell user={user} active="history"><HistoryPanel initialSessions={history.sessions.map(serializeStudySession)} initialSummary={history.summary}/></DashboardShell>;
}
