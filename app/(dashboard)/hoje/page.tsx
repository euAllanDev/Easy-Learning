import { redirect } from "next/navigation";
import { GoalService } from "@/application/goals/goal-service";
import { GoalsPanel } from "@/components/goals/goals-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TodaySessions } from "@/components/sessions/today-sessions";
import { StudySessionService } from "@/application/study-session/study-session-service";
import { currentUser } from "@/infrastructure/auth/session";
import { DrizzleGoalRepository } from "@/infrastructure/repositories/drizzle-goal-repository";
import { DrizzleStudySessionRepository } from "@/infrastructure/repositories/drizzle-study-session-repository";
import { serializeGoal, serializeStudySession } from "@/lib/api/serialize";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const goals = await new GoalService(new DrizzleGoalRepository()).list(user.id);
  const sessions = await new StudySessionService(new DrizzleStudySessionRepository()).list(user.id);
  return <DashboardShell user={user} active="today"><header className="welcome"><p className="kicker">O QUE FAÇO AGORA?</p><h1>Bom dia, {user.name.split(" ")[0]}.<br/><em>Entre no fluxo.</em></h1><p>Seu plano e sua sessão atual, em um só lugar.</p></header><TodaySessions initialSessions={sessions.map(serializeStudySession)}/><GoalsPanel initialGoals={goals.map(serializeGoal)}/></DashboardShell>;
}
