import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvailabilityPanel } from "@/components/availability/availability-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { currentUser } from "@/infrastructure/auth/session";

export const metadata: Metadata = { title: "Disponibilidade" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  return <DashboardShell user={user} active="availability"><AvailabilityPanel/></DashboardShell>;
}
