# Encomendas

Aplicação interna, em português, para as lojas registarem encomendas personalizadas e a cozinha central as aceitar, rejeitar, imprimir e acompanhar em tempo real.

## Arranque local

Requisitos: Node.js 22+, npm, Docker Desktop com pelo menos 7 GB de memória disponível.

```bash
npm install
npm run supabase:start
npm run dev
```

O primeiro `supabase:start` descarrega as imagens Docker. O repositório inclui `.env.example`; neste workspace já existe um `.env.local` gitignored com as chaves da stack local. Para recriar as chaves noutro computador, consulte `npx supabase status -o env` e preencha uma cópia de `.env.example`.

### Testar noutro dispositivo com ngrok

Inicie o servidor local e o túnel para a mesma porta:

```bash
npm run dev
ngrok http 3000
```

Adicione apenas o hostname apresentado pelo ngrok, sem `https://`, ao `.env.local` e reinicie o Next.js:

```dotenv
NEXT_DEV_ALLOWED_HOSTS=exemplo.ngrok-free.app
NEXT_PUBLIC_SITE_URL=https://exemplo.ngrok-free.app
```

O hostname é autorizado tanto para os recursos de desenvolvimento como para Server Actions. Separe vários hostnames com vírgulas. O Supabase Docker continua deliberadamente acessível apenas no Mac; num telefone, Realtime mostrará erro porque `127.0.0.1` aponta para o próprio telefone. Para testar Realtime fora do Mac, utilize um projeto Supabase Cloud de desenvolvimento em vez de expor a stack Docker à Internet.

Contas locais criadas por `supabase/seed.sql`:

| Função | Email | Palavra-passe |
| --- | --- | --- |
| Administração | `admin@encomendas.local` | `Encomendas123!` |
| Loja | `loja@encomendas.local` | `Encomendas123!` |
| Cozinha | `cozinha@encomendas.local` | `Encomendas123!` |

Estas credenciais existem apenas no seed local e nunca devem ser utilizadas em produção. O Studio local abre em `http://127.0.0.1:54323` e a caixa de email local em `http://127.0.0.1:54324`.

## Fluxos implementados

- Contas nominativas por convite, com funções `admin`, `store` e `kitchen` e autorização dupla em Server Actions e RLS.
- Catálogo configurável, unidades/incrementos, campos obrigatórios, antecedência, horizonte, horários por loja e retenção de dados.
- Encomendas com loja de origem e loja de levantamento independentes, chave de idempotência, revisões imutáveis e auditoria.
- Aceitação/rejeição atómica pela cozinha; alterações aceites regressam a pendentes e exigem nova aceitação.
- Cancelamento imediato, email ao cliente e reconhecimento obrigatório da cozinha quando o pedido já estava aceite.
- Fila Realtime, alarme repetido a cada 10 segundos, estado de ligação e PWA/Web Push.
- Outbox transacional processada pela Edge Function `process-notifications`, com Resend, Web Push, idempotência e retry exponencial.
- Impressão protegida em A4 ou 80 mm e anonimização diária após o prazo configurado (24 meses por defeito).

## Comandos úteis

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run supabase:reset
npm run supabase:test
npm run supabase:types
npm run test:e2e
npm run supabase:stop
```

`supabase:reset` apaga apenas a base de dados Docker local, reaplica todas as migrations e volta a carregar o seed.

## Produção: Vercel + Supabase Cloud

1. Crie os projetos Vercel e Supabase Cloud e configure os valores de `.env.example` em ambos os ambientes.
2. Ligue o projeto com `npx supabase link --project-ref ...`, reveja `npx supabase db push --dry-run` e aplique com `npx supabase db push`.
3. Faça deploy de `process-notifications` e configure `RESEND_API_KEY`, `RESEND_FROM="Encomendas <encomendas@encomendas.olguinhas.pt>"`, chaves VAPID e `NOTIFICATION_WORKER_SECRET` com `npx supabase secrets set`.
4. Configure o SMTP personalizado do Supabase Auth com as credenciais SMTP do domínio verificado no Resend, para convites e recuperação de palavra-passe.
5. Crie um Database Webhook em inserts de `notification_outbox` para a Edge Function e um Supabase Cron a cada minuto como retry. O webhook deve usar a chave de serviço; o cron deve enviar `x-worker-secret` a partir do Vault.
6. Defina `NEXT_PUBLIC_SITE_URL`, URLs autorizadas do Auth e as variáveis Supabase/VAPID/Resend no Vercel.
7. Crie o primeiro utilizador no Supabase Auth, atribua-lhe `role = admin` e `active = true` em `profiles`, e conclua a configuração pela área de Administração.
8. Instale a PWA nos tablets. Em iPad, a instalação no ecrã principal é obrigatória para Web Push. Abra a Cozinha e toque em “Ativar agora”.

Para testar push localmente use `npm run dev:https`; os browsers exigem HTTPS fora das exceções de localhost. Emails de encomenda ficam em modo `log` localmente; emails do Auth aparecem na caixa local.

## Estrutura

- `app/`: rotas App Router, Server Actions e experiências de loja, cozinha e administração.
- `components/`: componentes shadcn/ui e blocos reutilizáveis da aplicação.
- `lib/`: autenticação, clientes Supabase, tipos gerados, validação, datas e templates.
- `supabase/migrations/`: schema, RLS, RPCs, auditoria, outbox e jobs.
- `supabase/functions/`: worker de notificações Resend/Web Push.
- `supabase/tests/`: testes pgTAP de schema, permissões e fluxo transacional.
- `e2e/`: smoke tests Playwright em viewports iPad e Android tablet.
