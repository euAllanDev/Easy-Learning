import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return <main className="auth-page"><Link className="brand" href="/">fluxo<span>.</span></Link><section><p className="kicker">BEM-VINDO DE VOLTA</p><h1>Retome de onde <em>parou.</em></h1><AuthForm mode="login"/><p className="auth-switch">Ainda não tem conta? <Link href="/criar-conta">Comece agora</Link></p></section></main>;
}
