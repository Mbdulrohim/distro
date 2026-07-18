import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  Upload,
  ShieldCheck,
  Zap,
  Repeat,
  Send,
  ListChecks,
  FileText,
  ExternalLink,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";
import { DistroMark } from "@/components/brand/distro-mark";
import { SignedInRedirectNotice } from "./signed-in-redirect-notice";

/**
 * Distro landing page.
 *
 * Brand register (DESIGN.md v2): this is the one surface where design IS the
 * product. White-dominant with soft lavender sections and a single enterprise
 * violet for brand + interaction; Geist; functional green/amber/red reserved
 * for payment meaning — reads like Stripe/Linear/Mercury/Vercel, not a
 * token-launch site.
 *
 * Integrity constraints, deliberate: no fabricated trust (no fake logos,
 * testimonials, or user counts), and no audit claim, because Distro is not
 * audited. The honest architectural guarantees carry the security story.
 */
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        {redirect ? (
          <div className="mx-auto w-full max-w-5xl px-6 pt-6">
            <SignedInRedirectNotice />
          </div>
        ) : null}

        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Features />
        <Templates />
        <UseCases />
        <WhyMonad />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
        <div className="flex flex-col gap-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Onchain distribution engine · Monad
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Pay hundreds of wallets in one workflow.
          </h1>
          <p className="max-w-md text-lg text-pretty text-muted-foreground">
            Payroll, rewards, grants, and payouts — import recipients, review once, and Distro sends
            to everyone onchain. No scripts. No spreadsheets. No custody.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <ConnectWalletButton />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-muted-foreground"
            >
              Open the dashboard
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Non-custodial · Verifiable onchain · Open source
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/**
 * The hero visual is a real Distro artifact — a distribution mid-flight —
 * rather than a decorative graphic. Every element here is the design system's
 * signature: mono addresses, tabular amounts, functional status colour.
 */
function HeroVisual() {
  const rows = [
    { addr: "0x1a2b…9f3c", amt: "1,200.00", state: "paid" as const },
    { addr: "0x4d5e…7a1b", amt: "1,200.00", state: "paid" as const },
    { addr: "0x8c7d…2e1f", amt: "800.00", state: "failed" as const },
    { addr: "0x3f9a…6b04", amt: "1,500.00", state: "paid" as const },
    { addr: "0xb2e1…c7d8", amt: "950.00", state: "pending" as const },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-1 shadow-sm">
      <div className="rounded-lg bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">March payroll</p>
            <p className="font-mono text-xs text-muted-foreground">USDC · 240 recipients</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-info/30 bg-info-surface px-2 py-0.5 text-xs text-info">
            <Clock className="size-3" />
            Sending
          </span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.addr} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.addr}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{r.amt}</td>
                <td className="px-4 py-2.5 text-right">
                  <StatePill state={r.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 font-mono text-xs">
          <span className="text-success">236 paid</span>
          <span className="text-warning">4 failed</span>
          <span className="text-muted-foreground">verifiable onchain ↗</span>
        </div>
      </div>
    </div>
  );
}

function StatePill({ state }: { state: "paid" | "failed" | "pending" }) {
  if (state === "paid")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="size-3" /> Paid
      </span>
    );
  if (state === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning">
        <X className="size-3" /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="size-3" /> Pending
    </span>
  );
}

/* --------------------------------------------------------------- Problem */

function Problem() {
  const pains = [
    "Copy each wallet address by hand",
    "Verify every one is correct",
    "Enter amounts one at a time",
    "Send the same transaction over and over",
    "Track who's been paid in a spreadsheet",
    "Chase and retry the failures yourself",
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Blockchain made transfers permissionless. It never made distribution efficient.
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Paying a team, a cohort, or a community onchain still means doing the same thing by hand,
          dozens or hundreds of times. It gets slower and more error-prone with every recipient.
        </p>
        <ul className="mt-10 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {pains.map((p) => (
            <li key={p} className="flex items-center gap-3 text-sm text-muted-foreground">
              <X className="size-4 shrink-0 text-muted-foreground/60" />
              <span className="line-through decoration-border">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Solution */

function Solution() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          One distribution. Every recipient. Sent onchain, tracked to the last payment.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          Distro turns a repetitive, manual chore into a single workflow: create, import, review,
          approve. It executes the transfers and shows you exactly what happened.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ How it works */

function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Import recipients",
      body: "Upload a CSV or paste a list of addresses and amounts. Distro validates every address and flags duplicates before you commit.",
    },
    {
      icon: ListChecks,
      title: "Review the exact total",
      body: "See the recipient count, the total, and every amount in both human and base units. Nothing is sent until you approve it.",
    },
    {
      icon: Send,
      title: "Distribute onchain",
      body: "Approve once. Distro sends to everyone, isolates any failures, and records each payment — verifiable on the block explorer.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg border border-border font-mono text-sm text-muted-foreground">
                  {i + 1}
                </span>
                <s.icon className="size-5 text-foreground" />
              </div>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Features */

function Features() {
  const pillars = [
    {
      icon: Send,
      title: "Distribution",
      body: "Send an ERC-20 to many recipients efficiently. One blocked or failing address never stops the rest of the run.",
    },
    {
      icon: Clock,
      title: "Scheduling",
      body: "Execute now, or set a future date and time. A scheduled run is committed onchain, not held on a server.",
    },
    {
      icon: Repeat,
      title: "Automation",
      body: "Turn recurring payouts into repeatable workflows. Reuse a recipient list instead of rebuilding it every cycle.",
    },
    {
      icon: ListChecks,
      title: "Tracking",
      body: "Know exactly who was paid and when. Every payment is a public transaction, one click from its explorer.",
    },
  ];
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Four things Distro does, and does precisely.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.title} className="flex flex-col gap-3 bg-background p-6">
              <p.icon className="size-5 text-foreground" />
              <h3 className="font-medium">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Templates */

function Templates() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-5">
          <FileText className="size-6 text-foreground" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Save a distribution. Run it again next month.
          </h2>
          <p className="max-w-md text-muted-foreground">
            Templates keep your recipient lists — a payroll roster, a contributor cohort, a grant
            round — so recurring payouts take seconds. Using a template always goes through the full
            review and approval, so a saved list can never pay anyone on its own.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-1">
          <div className="rounded-lg bg-background">
            {[
              ["Monthly payroll", "240 recipients"],
              ["Core contributors", "18 recipients"],
              ["Grant cohort · Q1", "12 recipients"],
            ].map(([name, count], i, a) => (
              <div
                key={name}
                className={`flex items-center justify-between px-4 py-3.5 ${i < a.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="text-sm font-medium">{name}</span>
                <span className="font-mono text-xs text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Use cases */

function UseCases() {
  const cases = [
    "Monthly payroll",
    "Community rewards",
    "Airdrops",
    "Bug bounty payouts",
    "Hackathon prizes",
    "Grant distributions",
    "Creator revenue sharing",
    "Affiliate payouts",
    "Scholarship payments",
    "DAO contributor comp",
  ];
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Anywhere the recipients are known and the payments need to actually arrive — Web3 teams,
          DAOs, grant programs, NFT projects, and creator communities.
        </p>
        <div className="mt-10 flex flex-wrap gap-2.5">
          {cases.map((c) => (
            <span
              key={c}
              className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Why Monad */

function WhyMonad() {
  const points = [
    {
      k: "Fast execution",
      v: "Distributions confirm quickly, so a 200-person payroll doesn't mean a long wait.",
    },
    {
      k: "Low fees",
      v: "High throughput and low transaction costs make bulk and recurring payouts economical.",
    },
    {
      k: "Built for scale",
      v: "The chain is designed for the kind of high-volume execution distribution demands.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Why Distro is built on Monad
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Large-scale distribution demands speed, low cost, and throughput. Monad provides all three
          without compromising the experience.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {points.map((p) => (
            <div key={p.k} className="flex flex-col gap-2 border-t border-border pt-5">
              <h3 className="font-medium">{p.k}</h3>
              <p className="text-sm text-muted-foreground">{p.v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Security */

function Security() {
  const guarantees = [
    {
      icon: ShieldCheck,
      title: "Non-custodial by design",
      body: "Distro never holds your funds or your keys. Tokens move directly from your wallet to each recipient — the contract's balance is always zero.",
    },
    {
      icon: Zap,
      title: "Failure isolation",
      body: "One blocked or reverting recipient never fails the run for everyone else. Failed payments simply stay in your wallet, ready to retry.",
    },
    {
      icon: ListChecks,
      title: "Verifiable onchain",
      body: "Every payment is a public transaction. Nothing about a distribution rests on trusting Distro's word for it.",
    },
  ];
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Security</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Distro moves real money, so the guarantees are architectural, not promises. It is not a
          wallet, an exchange, or a custodian.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {guarantees.map((g) => (
            <div key={g.title} className="flex flex-col gap-3">
              <g.icon className="size-5 text-foreground" />
              <h3 className="font-medium">{g.title}</h3>
              <p className="text-sm text-muted-foreground">{g.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <a
            href="https://monadscan.com/address/0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-info hover:underline"
          >
            Contract 0xd9C7…4538 <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/tweetbysobur/distro"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            Open source <ExternalLink className="size-3" />
          </a>
          <span className="text-muted-foreground">
            Independent audit pending before mainnet launch.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- FAQ */

function Faq() {
  const items = [
    {
      q: "Does Distro hold my funds?",
      a: "No. Distro is non-custodial. Tokens move straight from your wallet to each recipient in a single transaction — the contract never holds a balance, and it has no owner or admin who could touch your funds.",
    },
    {
      q: "What happens if a payment fails?",
      a: "It's isolated. One recipient failing — because a token blocks them, say — never stops the others. The failed amount stays in your wallet, and you can retry just the failed subset. Nobody gets paid twice.",
    },
    {
      q: "Which tokens are supported?",
      a: "Any standard ERC-20 on Monad, selected by address with its balance shown before you send. Native MON is distributed as WMON (wrapped MON), the standard pattern.",
    },
    {
      q: "Do recipients need to do anything?",
      a: "No. Distro is a push system — recipients receive tokens directly. There's no claim step, no portal, and no action required on their end.",
    },
    {
      q: "How large can a distribution be?",
      a: "Large lists are split into batches sized to fit within a block's gas limit, so you can pay hundreds of recipients in one workflow.",
    },
    {
      q: "Is it live on mainnet?",
      a: "The contracts are deployed and the full flow is proven on testnet. An independent audit comes before mainnet distribution is enabled in the app — moving real payroll through unaudited code isn't something worth rushing.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions</h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {items.map((it) => (
            <details key={it.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {it.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- CTA */

function FinalCta() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Send your first distribution.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground">
          Connect your wallet and pay everyone at once — reviewed, tracked, and verifiable onchain.
        </p>
        <div className="mt-8 flex justify-center">
          <ConnectWalletButton />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Footer */

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <DistroMark className="h-[1.15rem] w-[1.15rem]" />
            <p className="text-sm font-semibold tracking-tight">Distro</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Onchain distribution engine for Monad.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <a
            href="https://github.com/tweetbysobur/distro"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="https://monadscan.com/address/0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Contract
          </a>
        </nav>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Not a wallet, exchange, bridge, bank, or custodian.
      </p>
    </footer>
  );
}
