"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form-controls";

export function CompletionDialog({ elapsedSeconds, busy, error, onCancel, onSave }: {
  elapsedSeconds: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (result: object) => void;
}) {
  const [minutes, setMinutes] = useState(Math.max(0, Math.round(elapsedSeconds / 60)));
  const [questions, setQuestions] = useState("");
  const [correctAnswers, setCorrectAnswers] = useState("");
  const [difficulty, setDifficulty] = useState("NORMAL");
  const [notes, setNotes] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      actualDurationSeconds: minutes * 60,
      questions: questions === "" ? null : Number(questions),
      correctAnswers: correctAnswers === "" ? null : Number(correctAnswers),
      difficulty,
      notes: notes || null,
    });
  }
  return <Dialog eyebrow="SESSÃO CONCLUÍDA" title="Registre o resultado" description="Conte como foi o estudo. A observação é opcional." onClose={onCancel}>
    <form className="session-result-form" onSubmit={submit}>
      <label>Quanto tempo você estudou? (minutos)<Input aria-label="Quanto tempo você estudou?" type="number" min={0} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}/></label>
      <div><label>Quantas questões?<Input aria-label="Quantas questões?" type="number" min={0} value={questions} onChange={(event) => setQuestions(event.target.value)}/></label><label>Quantos acertos?<Input aria-label="Quantos acertos?" type="number" min={0} value={correctAnswers} onChange={(event) => setCorrectAnswers(event.target.value)}/></label></div>
      <label>Como foi a dificuldade?<Select aria-label="Como foi a dificuldade?" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="EASY">Fácil</option><option value="NORMAL">Normal</option><option value="HARD">Difícil</option></Select></label>
      <label>Alguma observação?<textarea className="ui-input" aria-label="Alguma observação?" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000}/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><Button type="button" variant="secondary" onClick={onCancel}>Voltar</Button><Button disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar resultado"}</Button></div>
    </form>
  </Dialog>;
}
