"use client";

import { useState, type FormEvent } from "react";

type Goal = { id: string; name: string; description: string; priority: "HIGH" | "MEDIUM" | "LOW"; idealMinutesPerDay: number; minimumMinutesPerDay: number; status: string };

export function GoalsPanel({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/v1/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, idealMinutesPerDay: Number(values.idealMinutesPerDay), minimumMinutesPerDay: Number(values.minimumMinutesPerDay) }) });
    if (!response.ok) return setError("Revise as metas informadas.");
    setGoals([...goals, await response.json()]);
    form.reset(); setError(""); setOpen(false);
  }

  return <section className="goals-section">
    <header><div><p className="kicker">OBJETIVOS</p><h2>Onde seu tempo ganha direção</h2></div><button className="button small" onClick={() => setOpen(!open)}>+ Novo objetivo</button></header>
    {open && <form className="goal-form" onSubmit={createGoal}><input name="name" required placeholder="Ex.: Concurso para Analista"/><input name="description" placeholder="Uma breve descrição"/><select name="priority" defaultValue="MEDIUM"><option value="HIGH">Alta prioridade</option><option value="MEDIUM">Média prioridade</option><option value="LOW">Baixa prioridade</option></select><input name="minimumMinutesPerDay" required type="number" min="1" placeholder="Meta mínima (min)"/><input name="idealMinutesPerDay" required type="number" min="1" placeholder="Meta ideal (min)"/><button className="button">Salvar</button>{error && <p className="form-error">{error}</p>}</form>}
    <div className="goal-list">{goals.length ? goals.map((goal) => <article key={goal.id}><div><span className={`priority ${goal.priority.toLowerCase()}`}>{goal.priority === "HIGH" ? "Alta" : goal.priority === "MEDIUM" ? "Média" : "Baixa"}</span><h3>{goal.name}</h3><p>{goal.description || "Seu objetivo está pronto para receber áreas e tópicos."}</p></div><dl><div><dt>Mínimo</dt><dd>{goal.minimumMinutesPerDay} min</dd></div><div><dt>Ideal</dt><dd>{goal.idealMinutesPerDay} min</dd></div></dl></article>) : <div className="empty-goals"><span>01</span><h3>Comece pelo destino.</h3><p>Crie um objetivo para que o Fluxo possa organizar seu tempo.</p></div>}</div>
  </section>;
}
