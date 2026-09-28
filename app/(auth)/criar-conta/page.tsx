import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return <main className="auth-page"><Link className="brand" href="/">fluxo<span>.</span></Link><section><p className="kicker">SEU PRIMEIRO PASSO</p><h1>Construa um ritmo <em>possível.</em></h1><AuthForm mode="register"/><p className="auth-switch">Já usa o Fluxo? <Link href="/entrar">Entrar</Link></p></section></main>;
}
