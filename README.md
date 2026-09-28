# Fluxo

Migração incremental do MVP local para um monólito Next.js com PostgreSQL. O código está sendo migrado por domínio; os arquivos JavaScript da aplicação anterior permanecem no repositório até suas jornadas equivalentes serem validadas.

## Executar o monólito

Requisitos: Node.js 24+, pnpm e PostgreSQL 17.

```bash
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

A aplicação fica disponível em `http://localhost:3000`. Para executar temporariamente o MVP anterior, use `pnpm legacy:start`.

## Verificações

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Arquitetura atual

- `app/`: páginas Next.js e rotas HTTP versionadas em `/api/v1`.
- `components/`: componentes React que consomem o contrato HTTP.
- `domain/`: regras puras e interfaces de repositório.
- `application/`: casos de uso e autorização orientada pela identidade recebida do servidor.
- `infrastructure/`: PostgreSQL/Drizzle, autenticação e implementações dos repositórios.
- `lib/validation/`: contratos Zod de request e response.
- `drizzle/`: migrações SQL versionadas.

## Fases entregues

As fatias concluídas estabelecem Next.js, TypeScript, Tailwind, PostgreSQL/Drizzle, sessões autenticadas por cookie HTTP-only e os CRUDs de objetivos e disponibilidade. Toda operação é limitada pelo `userId` obtido da sessão; a API não aceita identidade de propriedade enviada pelo cliente.

Os próximos domínios devem ser migrados nesta ordem: sessões e lifecycle, rotina, analytics, Pomodoro/Focus Mode, Study Coach e migração idempotente do `localStorage`. O legado não deve ser removido antes da validação de cada jornada equivalente.
# Easy-Learning
