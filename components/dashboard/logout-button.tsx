"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return <button className="nav-button" onClick={async () => { await fetch("/api/v1/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }}>Sair</button>;
}
