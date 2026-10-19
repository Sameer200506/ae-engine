import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PlanGrid } from "@/components/PlanGrid";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Describe the job",
    body: "Create an agent and write its system prompt in plain language. Start from a template for support, research or content optimisation.",
  },
  {
    n: "02",
    title: "Feed it your material",
    body: "Upload PDFs, Word files, Markdown, CSV or JSON, paste text, or point it at a URL. Everything is chunked and embedded automatically.",
  },
  {
    n: "03",
    title: "Get grounded answers",
    body: "Replies stream token by token and cite the exact excerpts they used, so you can check the claim instead of trusting it.",
  },
  {
    n: "04",
    title: "Embed and charge",
    body: "Publish a share link or drop the widget on any site. Per-plan message limits and Stripe checkout are already wired in.",
  },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Streaming chat",
    body: "Token-by-token responses over server-sent events, with a stop button and full conversation history. No page reloads, no polling.",
  },
  {
    icon: "📚",
    title: "Knowledge base (RAG)",
    body: "Documents are chunked with overlap, embedded, and retrieved by cosine similarity. Answers cite the sources they drew on.",
  },
  {
    icon: "🧩",
    title: "Embeddable widget",
    body: "One script tag puts the assistant on any website as a floating launcher. Each visitor gets their own isolated conversation.",
  },
  {
    icon: "🛡️",
    title: "Editable system prompts",
    body: "Every agent's instructions live in the database. Change behaviour instantly without a deploy or a code change.",
  },
  {
    icon: "📊",
    title: "Usage limits per plan",
    body: "Message, agent and document quotas are enforced server-side before any tokens are spent. Overspend is not possible.",
  },
  {
    icon: "🔧",
    title: "Admin console",
    body: "See every user, plan and conversation from one view. Search across transcripts to spot problems or abusive use.",
  },
];

const FAQ = [
  {
    q: "Which model does it use?",
    a: "Any OpenAI-compatible endpoint. Out of the box it points at OpenRouter, so you can run entirely on free models with no credit card. Swapping to OpenAI, Groq, DeepSeek or a local Ollama server is an environment-variable change.",
  },
  {
    q: "What happens when a customer hits their limit?",
    a: "The request is rejected before the model is called, with a message explaining the limit and a link to upgrade. Quotas reset at the start of each UTC month.",
  },
  {
    q: "Do I need Docker or a cloud database?",
    a: "No. The MVP stores everything in a single SQLite file using Node's built-in driver, so there is no native build step and no service to run. Point DATABASE_PATH at a persistent volume when you deploy.",
  },
  {
    q: "Can I self-host it?",
    a: "Yes — that is the point. It is a standard Next.js app plus one SQLite file. Deploy it to any Node host, or migrate the data layer to Postgres when you outgrow a single instance.",
  },
  {
    q: "Is widget traffic metered?",
    a: "Yes. Messages sent through a share link or widget are billed against the agent owner's monthly quota, and the public endpoint is rate-limited per IP so it cannot be used as a free LLM proxy.",
  },
];

function HeroPreview() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5">
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 text-xs text-slate-400">Knowledge Assistant · Pro</span>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-[13px] text-white">
            Do you support SSO on the team plan?
          </p>
        </div>

        <div className="mt-4 flex gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[10px] text-white">
            ✳
          </span>
          <div className="min-w-0 text-[13px] leading-relaxed text-slate-700">
            <p>
              Yes. SAML SSO is available on the team plan and is configured from{" "}
              <span className="font-medium">Settings → Security</span>, not at signup <span className="text-slate-400">[1]</span>.
            </p>
            <p className="mt-2 text-slate-500">
              One caveat: SCIM provisioning is still on the roadmap, so users are added manually.
            </p>

            <div className="mt-3 border-t border-slate-200 pt-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Sources
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                  [1] plans-and-security.pdf
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                  [2] sso-setup.md
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isSignedIn={Boolean(user)} />

      {/* ---------------------------------- hero --------------------------------- */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Runs on free OpenRouter models
            </span>

            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              AI agents that answer
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                {" "}
                from your own knowledge base
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Create agents with your own instructions, feed them your documents, and embed them
              anywhere. Streaming chat, retrieval, usage limits and Stripe billing are already
              wired together — so you can charge for it this week.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                {user ? "Open dashboard" : "Start free — no card"}
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                See pricing
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-slate-200 pt-6">
              {[
                { label: "Setup", value: "2 env vars" },
                { label: "Database", value: "1 file" },
                { label: "Billing", value: "Stripe-ready" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{item.label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-fade-up">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* --------------------------------- how it works ------------------------ */}
      <section id="how" className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              From empty account to billable product
            </h2>
            <p className="mt-3 text-slate-600">
              Four steps, all of them in the UI. Nothing here needs a code change.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="relative">
                <span className="text-xs font-bold tracking-widest text-indigo-500">{step.n}</span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------- features ---------------------------- */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Everything the MVP actually needs
            </h2>
            <p className="mt-3 text-slate-600">
              Deliberately small surface area. Each piece is wired end to end rather than stubbed.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------- pricing ---------------------------- */}
      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Simple pricing
            </h2>
            <p className="mt-3 text-slate-600">
              Start free. Upgrade when you have something worth charging for.
            </p>
          </div>

          <div className="mt-12">
            <PlanGrid plans={Object.values(PLANS)} isSignedIn={Boolean(user)} />
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            All plans include streaming chat, retrieval-augmented answers and conversation history.
          </p>
        </div>
      </section>

      {/* ------------------------------------ faq ------------------------------ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Questions worth asking
          </h2>

          <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-slate-900">
                  {item.q}
                  <span className="shrink-0 text-slate-400 transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------ cta ------------------------------ */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center sm:px-14">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Build the version you can actually run
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Clone it, set two environment variables, and you have a working product to demo to a
            customer tomorrow.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              {user ? "Open dashboard" : "Create your account"}
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
