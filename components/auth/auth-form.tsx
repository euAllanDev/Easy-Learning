"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/v1/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      router.push("/hoje");
      router.refresh();
      return;
    }
    const result = await response.json().catch(() => ({}));
    setError(result.error === "EMAIL_ALREADY_USED" ? "Este e-mail já possui uma conta." : "Não foi possível continuar. Confira os dados.");
    setPending(false);
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && <label>Como podemos chamar você?<input name="name" required minLength={2} autoComplete="name" /></label>}
      <label>E-mail<input name="email" required type="email" autoComplete="email" /></label>
      <label>Senha<input name="password" required type="password" minLength={mode === "register" ? 8 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button full" disabled={pending}>{pending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha conta"}</button>
    </form>
  );
}
