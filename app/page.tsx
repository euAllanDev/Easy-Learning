import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link className="brand" href="/">fluxo<span>.</span></Link>
        <div><Link className="text-link" href="/entrar">Entrar</Link><Link className="button small" href="/criar-conta">Criar conta</Link></div>
      </nav>
      <section className="landing-hero">
        <p className="kicker">ROTINA, FOCO, PROGRESSO</p>
        <h1>Decida menos.<br/><em>Estude melhor.</em></h1>
        <p className="lead">O Fluxo transforma objetivos e tempo disponível em um próximo passo claro, todos os dias.</p>
        <Link className="button" href="/criar-conta">Começar meu fluxo <span>↗</span></Link>
      </section>
      <section className="landing-note">
        <span>01</span><p>Seu plano de estudo vive em uma única conta, pronto para acompanhar você entre dispositivos.</p>
      </section>
    </main>
  );
}
