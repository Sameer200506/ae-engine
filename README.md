# AEO Engine

A lean, self-hostable AI agent platform: create agents with your own system
prompts, ground them in uploaded documents, embed them on any website, and meter
usage behind plans you can charge for.

Built as a small, working product rather than a framework — every feature listed
below is wired end to end.

---

## What it does

| Feature | Where it lives |
| --- | --- |
| Streaming chat (SSE, token by token) | `src/lib/chat.ts`, `src/lib/sse.ts`, `src/components/ChatPanel.tsx` |
| Editable system prompt per agent | `src/lib/agents.ts`, `/dashboard/agents` |
| Knowledge base + retrieval (RAG) | `src/lib/rag.ts`, `src/lib/chunk.ts`, `/dashboard/knowledge` |
| Multi-conversation history | `src/lib/conversations.ts`, `/dashboard` |
| Saved prompts | `/api/prompts`, `/dashboard/prompts` |
| Share link + embeddable widget | `/share/[token]`, `/embed/[token]`, `public/widget.js` |
| Usage limits per plan | `src/lib/plans.ts`, `src/lib/usage.ts` |
| Admin view of all conversations | `/dashboard/admin` |
| Email/password auth | `src/lib/auth.ts` |
| Stripe subscription billing | `src/lib/stripe.ts`, `/api/stripe/webhook` |

---

## Quick start

Requires **Node 22.5 or newer** (for the built-in `node:sqlite` module). Node 24
is recommended. There is no native compilation step and no database server to run.

```bash
npm install

# create your env file
cp .env.example .env.local
# then generate a session secret and paste it in:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run dev
```

Open <http://localhost:3000>.

**The first account you create automatically becomes the admin.**

### Try it without any API keys

The app runs immediately — the landing page, auth, agents, prompts and admin all
work with zero configuration. Only chat and document indexing need a model
endpoint. To demo those too, run the bundled mock:

```bash
npm run mock:llm          # terminal 1, listens on :8787

# then add to .env.local:
#   LLM_BASE_URL=http://localhost:8787/v1
#   LLM_API_KEY=mock
npm run dev               # terminal 2
```

`scripts/mock-llm.mjs` speaks the OpenAI wire format and returns deterministic
replies plus bag-of-words embeddings (64 dims). It is a test fixture, not a
language model — but it exercises streaming, retrieval, persistence and quota
enforcement for real.

### With a real model (free)

1. Get a key at <https://openrouter.ai/keys> (no credit card).
2. Put it in `.env.local` as `OPENROUTER_API_KEY`.
3. Restart the dev server.

---

## Environment variables

Everything is optional except `SESSION_SECRET`. The app degrades gracefully and
tells you what is missing.

### Core

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Stripe redirects, share links, widget snippet. Must be the public URL in production. |
| `SESSION_SECRET` | — | Signs sessions and share tokens. **Generate a real one for production.** |
| `DATABASE_PATH` | `./data/app.db` | SQLite file. Created on first run. |

### Model (chat)

| Variable | Default | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | — | Required for chat. Free tier: 20 req/min, 50/day (1,000/day after a one-time $10 top-up). |
| `OPENROUTER_MODEL` | `deepseek/deepseek-v4-flash-0731:free` | Any model id from <https://openrouter.ai/models>. |
| `OPENROUTER_FALLBACK_MODELS` | two other `:free` models | Tried in order when a model 429s. Free endpoints fail often; keep this set. |
| `OPENROUTER_SITE_NAME` | `AEO Engine` | Sent as `X-Title` for attribution. |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | — | Point at any OpenAI-compatible endpoint (OpenAI, Groq, DeepSeek, Ollama, the mock). Overrides OpenRouter. |

### Embeddings (knowledge base)

| Variable | Default | Notes |
| --- | --- | --- |
| `EMBEDDINGS_PROVIDER` | `openrouter` | `openrouter`, `openai`, or `none` to disable indexing. |
| `OPENROUTER_EMBEDDING_MODEL` | `nvidia/nemotron-3-embed-1b:free` | Free, shares the platform rate limits. |
| `OPENAI_API_KEY` | — | Only when `EMBEDDINGS_PROVIDER=openai`. Most reliable option for production. |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | |

### Stripe

| Variable | Notes |
| --- | --- |
| `STRIPE_SECRET_KEY` | Secret key. Use a **test** key (`sk_test_...`) until you are ready to charge. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional; not required for Checkout redirects. |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen`, or the endpoint's signing secret in production. |
| `STRIPE_PRICE_PRO` | Price id (`price_...`) for the $19/month plan. |
| `STRIPE_PRICE_SCALE` | Optional second tier. |

### Limits and admin

| Variable | Default | Notes |
| --- | --- | --- |
| `ADMIN_EMAILS` | — | Comma-separated emails auto-promoted to admin on signup. |
| `FREE_MONTHLY_MESSAGES` | `25` | |
| `FREE_MAX_AGENTS` | `1` | |
| `FREE_MAX_DOCUMENTS` | `3` | |

---

## Using it

1. **Create an agent** (`/dashboard/agents`). Start from a template — Knowledge
   Assistant, Answer Researcher, or Content Optimizer — or write a blank one. The
   system prompt is stored in the database, so you can change behaviour without a
   deploy.
2. **Attach knowledge** (`/dashboard/knowledge`). Upload `.pdf`, `.docx`, `.txt`,
   `.md`, `.csv`, `.json` or `.html` (max 10 MB), paste text, or point it at a
   URL. Documents are chunked on paragraph boundaries with a 150-character
   overlap, embedded, and stored.
3. **Chat** (`/dashboard`). Answers stream token by token and cite the excerpts
   they used. Retrieved excerpts are injected into the system prompt inside a
   `<knowledge_base>` block, with instructions to admit when they don't cover the
   question.
4. **Publish** (paid plans). Toggle "Publish this agent publicly" to get a share
   link and an embed snippet.
5. **Charge for it** (`/dashboard/billing`). Upgrade via Stripe Checkout; plan
   state is written by the webhook, never by the browser redirect.

### Embedding the widget

Paste this before `</body>` on any site:

```html
<script src="https://your-domain.com/widget.js" data-agent="YOUR_SHARE_TOKEN" async></script>
```

Optional attributes: `data-position="left|right"`, `data-color="#4f46e5"`,
`data-title="Chat with us"`. The launcher renders in a fixed-position iframe, so
host-page CSS cannot break it. Each visitor gets an isolated conversation keyed
by a local storage id.

Widget messages are billed to the agent owner's quota, and the public endpoint is
rate-limited to 20 requests per minute per IP.

---

## Stripe setup

### Local (test mode)

```bash
stripe login
stripe products create --name "Pro" --description "Pro plan"
stripe prices create --product prod_XXX --unit-amount 1900 --currency usd \
  --recurring interval=month
```

Put the resulting `price_...` id in `.env.local` as `STRIPE_PRICE_PRO`, then:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET and restart
```

Upgrade in the app using test card `4242 4242 4242 4242`, any future expiry, any
CVC. The webhook flips the plan; `/dashboard/billing` shows the new tier.

### Production

Create a webhook endpoint in the Stripe dashboard pointing at
`https://your-domain.com/api/stripe/webhook`, subscribe it to
`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated` and `customer.subscription.deleted`, and put its
signing secret in `STRIPE_WEBHOOK_SECRET`.

---

## Deploying

The app is a standard Next.js server plus one SQLite file. **It needs a
persistent disk**, which rules out purely serverless platforms.

### Recommended: a container host with a volume

Railway, Render, Fly.io and any VPS with Docker all work. Set:

```
NEXT_PUBLIC_APP_URL=https://your-domain.com
SESSION_SECRET=<fresh 32-byte hex>
DATABASE_PATH=/data/app.db
OPENROUTER_API_KEY=sk-or-...
```

Mount a volume at `/data` so the database survives redeploys. A minimal
`Dockerfile`:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production DATABASE_PATH=/data/app.db
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel

Deployable, but **the SQLite file will not persist** — each cold start gets a
fresh filesystem and your data disappears. To use Vercel you must move off
SQLite first: point the data layer at Postgres and replace the brute-force
similarity scan with `pgvector`. See "Scaling" below.

### Before you take real money

- [ ] Set a real `SESSION_SECRET` (the default placeholder is rejected by the
      billing status check for a reason).
- [ ] Confirm the Stripe webhook is receiving events — the plan is only updated
      by the webhook, so a misconfigured endpoint means customers pay and stay on
      Free.
- [ ] Move embeddings to OpenAI (`EMBEDDINGS_PROVIDER=openai`). Free embedding
      models share a 50-requests-per-day cap, which document indexing will exhaust.
- [ ] Move chat off free models. Free OpenRouter endpoints are rate-limited,
      frequently 429, and often permit prompt logging. Fine for a demo, not for
      paying customers' data.
- [ ] Put HTTPS in front of it, so the session cookie is sent with `Secure`.

---

## Architecture

```
src/
  app/
    page.tsx                 landing page
    pricing/                 public pricing
    login/ signup/           auth
    dashboard/               authenticated app (chat, agents, knowledge, prompts, billing, admin)
    share/[token]/           public share page
    embed/[token]/           widget iframe contents
    api/
      auth/                  signup, login, logout
      chat/                  authenticated streaming chat
      public/chat/           token-authenticated streaming chat (widget)
      agents/ conversations/ knowledge/ prompts/ usage/
      billing/               Stripe Checkout + portal
      stripe/webhook/        subscription state
      admin/overview/        admin data
  lib/
    db.ts                    node:sqlite connection + schema
    chunk.ts                 paragraph-aware chunking        (pure)
    vector.ts                normalize / dot / rank          (pure)
    rag.ts                   ingest + retrieve
    embeddings.ts            embedding provider abstraction
    llm.ts                   streaming chat client + model fallback chain
    chat.ts                  the chat turn: quota -> retrieve -> stream -> persist
    sse.ts                   server-sent event writer
    plans.ts                 plan definitions (client-safe)
    usage.ts                 metering + quota checks
    auth.ts                  passwords, sessions, guards
    stripe.ts                billing helpers
  components/                ChatPanel, Workspace, AgentManager, ...
public/widget.js             dependency-free embed script
scripts/mock-llm.mjs         offline mock model server
tests/                       node:test unit tests
```

### Design decisions worth knowing

- **`node:sqlite` instead of `better-sqlite3`.** No native compile step, so
  `npm install && npm run dev` works on a clean machine including Windows. The
  tradeoff is that the API is marked experimental and a single file cannot be
  shared across instances.
- **Brute-force cosine similarity instead of a vector database.** A few thousand
  chunks scan in single-digit milliseconds, and it removes an entire service from
  the stack. Vectors are L2-normalised at write time so cosine reduces to a dot
  product.
- **Hand-rolled SSE instead of the Vercel AI SDK.** The protocol is ~20 lines,
  identical for the dashboard and the widget, and has no version churn. The
  server emits `meta`, `delta`, `done` and `error` events as JSON frames.
- **Database-backed sessions, not JWTs.** The cookie holds an opaque 256-bit
  token, so sessions can be revoked instantly and there is no signing-key
  rotation to get wrong.
- **Quotas are checked before the model is called**, and again against the
  database count rather than a denormalised counter, so a user cannot overspend
  through a race.
- **The Stripe webhook is the only writer of plan state.** The success redirect
  is treated as cosmetic because a client can forge it.

---

## Trust boundaries

Worth being explicit about what the current code does and does not protect:

- **Agent output is rendered as Markdown with raw HTML disabled.** `react-markdown`
  without `rehype-raw` cannot emit `<script>` from model output.
- **URL ingestion blocks private and loopback addresses** (`isPrivateHost` in
  `src/lib/extract.ts`) to prevent server-side request forgery.
- **Public widget conversations are scoped to their agent.** A visitor-supplied
  conversation id is only honoured if it belongs to the agent behind the token.
- **Rate limiting is in-process**, so it is per-instance. Behind a load balancer
  you need Redis or similar.
- **Not included:** email verification, password reset, 2FA, or audit logging.
  Add these before running a real business on it.

---

## Scaling

When a single instance stops being enough:

1. **Database.** Swap `src/lib/db.ts` for Postgres. Only that module (plus the
   SQL strings) knows about SQLite.
2. **Vector search.** Replace the scan in `retrieve()` with `pgvector`; the
   `embedding` column becomes a native vector type.
3. **Rate limiting.** Move `rateLimit()` in `src/lib/usage.ts` to Redis.
4. **Usage metering.** Add a monthly rollup table once a tenant passes roughly a
   million messages; until then counting rows is fine and cannot drift.

---

## Development

```bash
npm run dev         # dev server
npm run build       # production build (also type-checks)
npm run typecheck   # tsc --noEmit
npm test            # unit tests for chunking and vector math
npm run mock:llm    # offline mock model server
```

The tests cover the two pieces of pure logic that retrieval quality depends on:
chunk boundaries and similarity ranking. Both are dependency-free modules
precisely so they can be tested without a database or a model.

---

## Licence and attribution

Apache-2.0. See [`NOTICE`](./NOTICE) for third-party attribution and for the
relationship to the AionUi project referenced in the original brief — no AionUi
source code was copied; only its choice of document-parsing libraries and its
Markdown-rendering approach were adopted.

Model and embedding calls go to a third-party provider you configure. Review that
provider's data-handling terms before sending customer content to it.
