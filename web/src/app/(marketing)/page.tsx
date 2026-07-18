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
  FolderGit2,
  BadgeCheck,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { DistroMark } from "@/components/brand/distro-mark";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { HoverCard } from "@/components/ui/card";
import { SignedInRedirectNotice } from "./signed-in-redirect-notice";
import { AuthRedirect } from "./auth-redirect";

/**
 * Distro landing page — DESIGN.md v3.
 *
 * Every section carries its own surface identity (§7): no repeating white
 * blocks. White -> lavender -> gradient-mesh -> glass, in sequence. This is
 * the one surface where the brand is expressive (huge headlines, floating
 * cards, motion) — the authenticated dashboard stays flatter and denser by
 * design, per the same spec.
 *
 * Integrity constraints carried over from v2, unchanged by the redesign: no
 * fabricated trust (no fake logos, testimonials, or user counts), and no
 * audit claim, because Distro is not audited. The honest architectural
 * guarantees carry the security story.
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
      <AuthRedirect />
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
        <WhoUsesDistro />
        <Security />
        <WhyMonad />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */
/* Soft purple gradient wash + a floating product card, the heaviest shadow
   in the system, with subtle parallax on the background blobs. */

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: "var(--gradient-wash)" }}
    >
      <HeroBlobs />
      <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-36">
        <Reveal duration={0.7}>
          <div className="flex flex-col gap-7">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary-text uppercase">
              Onchain distribution engine
            </p>
            <h1 className="text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.5rem]">
              Distribute tokens to hundreds of wallets. In one workflow.
            </h1>
            <p className="max-w-md text-lg text-pretty text-charcoal-muted">
              Distro is an onchain distribution platform that helps teams automate token payouts at
              scale. Upload recipients, choose a token, schedule execution, and let Distro handle
              every distribution securely on Monad.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <ConnectWalletButton label="Start Distribution" size="lg" />
              <Link
                href="https://github.com/tweetbysobur/distro/tree/main/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary-text"
              >
                View Documentation
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <MonadBadge />
          </div>
        </Reveal>

        <Reveal duration={0.7} delay={0.15} rise={24}>
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * A small "built on Monad" chain badge — replaces the old text-only
 * "Onchain distribution engine · Monad" pill. The engine claim now lives in
 * the small label above the headline; this badge's only job is the chain
 * credential, so it's deliberately quiet: a mark + wordmark, nothing else.
 *
 * The mark below is an original abstract shape (not Monad's official
 * trademarked logo — no verified brand-asset SVG was available to embed
 * faithfully), rendered in Monad's public brand purple so it still reads as
 * a chain credential rather than a generic dot.
 */
function MonadBadge() {
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-sm">
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path d="M12 1 L23 12 L12 23 L1 12 Z" fill="none" stroke="#836EF9" strokeWidth="2.2" />
      </svg>
      <span className="text-xs font-medium text-charcoal-muted">
        Built on <span className="font-semibold text-foreground">Monad</span>
      </span>
    </div>
  );
}

/** Soft, slow-drifting gradient blobs behind the hero content — the only
 * place parallax lives; everything else is a static wash. */
function HeroBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-24 -left-24 size-[28rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute top-1/3 -right-32 size-[24rem] rounded-full bg-brand-secondary/12 blur-3xl" />
    </div>
  );
}

/** A real Distro artifact — a distribution mid-flight — rather than a
 * decorative graphic. The heaviest shadow in the system (§4 `shadow-lg`). */
function HeroVisual() {
  const rows = [
    { addr: "0x1a2b…9f3c", amt: "1,200.00", state: "paid" as const },
    { addr: "0x4d5e…7a1b", amt: "1,200.00", state: "paid" as const },
    { addr: "0x8c7d…2e1f", amt: "800.00", state: "failed" as const },
    { addr: "0x3f9a…6b04", amt: "1,500.00", state: "paid" as const },
    { addr: "0xb2e1…c7d8", amt: "950.00", state: "pending" as const },
  ];
  return (
    <div
      className="rounded-xl border border-border bg-background/90 p-1.5 backdrop-blur-sm"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <div className="rounded-lg bg-background">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-medium">March payroll</p>
            <p className="font-mono text-xs text-charcoal-muted">USDC · 240 recipients</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-light-purple px-2.5 py-1 text-xs text-primary-text">
            <Clock className="size-3" />
            Sending
          </span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.addr} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-mono text-xs text-charcoal-muted">{r.addr}</td>
                <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{r.amt}</td>
                <td className="px-5 py-3 text-right">
                  <StatePill state={r.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-4 font-mono text-xs">
          <span className="text-success">236 paid</span>
          <span className="text-warning">4 failed</span>
          <span className="text-charcoal-muted">verifiable onchain ↗</span>
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
    <span className="inline-flex items-center gap-1 text-xs text-charcoal-muted">
      <Clock className="size-3" /> Pending
    </span>
  );
}

/* --------------------------------------------------------------- Problem */
/* Light lavender flat — quiet, editorial, no card chrome. */

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
    <section className="bg-light-purple">
      <div className="mx-auto w-full max-w-4xl px-6 py-28">
        <Reveal>
          <h2 className="max-w-2xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.75rem]">
            Blockchain made transfers permissionless. It never made distribution efficient.
          </h2>
          <p className="mt-5 max-w-xl text-lg text-pretty text-charcoal-muted">
            Paying a team, a cohort, or a community onchain still means doing the same thing by
            hand, dozens or hundreds of times. It gets slower and more error-prone with every
            recipient.
          </p>
        </Reveal>
        <RevealGroup className="mt-12 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {pains.map((p) => (
            <RevealItem key={p} className="flex items-center gap-3 text-sm text-charcoal-muted">
              <X className="size-4 shrink-0 text-charcoal-muted/60" />
              <span className="line-through decoration-border">{p}</span>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Solution */
/* Plain white — after two tinted sections, this reads as the reset. */

function Solution() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-3xl px-6 py-28 text-center">
        <Reveal>
          <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            One distribution. Every recipient. Sent onchain, tracked to the last payment.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-charcoal-muted">
            Distro turns a repetitive, manual chore into a single workflow: create, import, review,
            approve. It executes the transfers and shows you exactly what happened.
          </p>
        </Reveal>
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
    <section className="bg-light-purple">
      <div className="mx-auto w-full max-w-5xl px-6 py-28">
        <Reveal>
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-tight sm:text-[2.75rem]">
            How it works
          </h2>
        </Reveal>
        <RevealGroup className="mt-14 grid gap-12 sm:grid-cols-3">
          {steps.map((s, i) => (
            <RevealItem key={s.title} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-light-purple font-mono text-sm text-primary-text">
                  {i + 1}
                </span>
                <s.icon className="size-5 text-primary" />
              </div>
              <h3 className="text-lg font-medium">{s.title}</h3>
              <p className="text-sm text-charcoal-muted">{s.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Features */
/* Gradient mesh — the brand's signature moment. Floating cards on top. */

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
    <section style={{ background: "var(--gradient-mesh)" }}>
      <div className="mx-auto w-full max-w-5xl px-6 py-28">
        <Reveal>
          <h2 className="max-w-xl text-[2rem] leading-[1.1] font-semibold tracking-tight sm:text-[2.75rem]">
            Four things Distro does, and does precisely.
          </h2>
        </Reveal>
        <RevealGroup className="mt-14 grid gap-6 sm:grid-cols-2">
          {pillars.map((p) => (
            <RevealItem key={p.title}>
              <HoverCard className="flex h-full flex-col gap-4 p-7">
                <span className="flex size-11 items-center justify-center rounded-md bg-light-purple">
                  <p.icon className="size-5 text-primary" />
                </span>
                <h3 className="text-lg font-medium">{p.title}</h3>
                <p className="text-sm text-charcoal-muted">{p.body}</p>
              </HoverCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Templates */
/* Glass cards — the one sanctioned glassmorphism surface, over a lavender
   backdrop. Never used on the authenticated dashboard. */

function Templates() {
  const templates = [
    ["Monthly payroll", "240 recipients"],
    ["Core contributors", "18 recipients"],
    ["Grant cohort · Q1", "12 recipients"],
  ];
  return (
    <section className="bg-background">
      <div className="mx-auto grid w-full max-w-5xl gap-14 px-6 py-28 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <div className="flex flex-col gap-5">
            <FileText className="size-6 text-primary" />
            <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-tight sm:text-[2.75rem]">
              Save a distribution. Run it again next month.
            </h2>
            <p className="max-w-md text-charcoal-muted">
              Templates keep your recipient lists — a payroll roster, a contributor cohort, a grant
              round — so recurring payouts take seconds. Using a template always goes through the
              full review and approval, so a saved list can never pay anyone on its own.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} rise={24}>
          <div className="flex flex-col gap-4">
            {templates.map(([name, count]) => (
              <div
                key={name}
                className="rounded-lg border border-primary/15 bg-white/60 px-5 py-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="font-mono text-xs text-charcoal-muted">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Who Uses Distro */
/* Lavender flat — a deliberate change of surface after Templates' white. No
   fabricated customer logos (Distro has none to show yet, and inventing them
   would break the no-fabricated-trust rule on a page selling a money
   product); the credibility job is done instead by the deployed,
   bytecode-verified contract and the open repository, both linkable facts. */

function WhoUsesDistro() {
  const useCases = [
    { icon: Send, label: "Payroll", desc: "Pay a whole team in one workflow, every cycle." },
    { icon: Zap, label: "Airdrops", desc: "Distribute a token to thousands of wallets at once." },
    {
      icon: Repeat,
      label: "Community rewards",
      desc: "Recurring payouts to active members or contributors.",
    },
    { icon: FileText, label: "Grants", desc: "Disburse grant tranches without manual transfers." },
    {
      icon: ListChecks,
      label: "Contributor payouts",
      desc: "Compensate DAO or open-source contributors on schedule.",
    },
    {
      icon: Upload,
      label: "Bulk transfers",
      desc: "Anything that means sending the same token to many addresses.",
    },
  ];
  const facts = [
    {
      icon: BadgeCheck,
      label: "Deployed & bytecode-verified",
      value: "0xd9C7…4538",
      href: "https://monadscan.com/address/0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538",
    },
    {
      icon: FolderGit2,
      label: "Open source",
      value: "View the repository",
      href: "https://github.com/tweetbysobur/distro",
    },
    {
      icon: ShieldCheck,
      label: "Architecture",
      value: "Non-custodial by design",
      href: "#security",
    },
  ];
  return (
    <section className="bg-light-purple">
      <div className="mx-auto w-full max-w-5xl px-6 py-28">
        <Reveal>
          <h2 className="max-w-xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.75rem]">
            Built for anyone paying more than one wallet at a time.
          </h2>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((u) => (
            <RevealItem key={u.label}>
              <div className="h-full rounded-lg border border-border bg-background p-6 shadow-xs">
                <u.icon className="size-5 text-primary" />
                <p className="mt-4 font-medium">{u.label}</p>
                <p className="mt-1.5 text-sm text-charcoal-muted">{u.desc}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <RevealGroup className="mt-6 grid gap-4 sm:grid-cols-3">
          {facts.map((f) => (
            <RevealItem key={f.label}>
              <a
                href={f.href}
                target={f.href.startsWith("http") ? "_blank" : undefined}
                rel={f.href.startsWith("http") ? "noreferrer" : undefined}
                className="group flex items-center gap-3 rounded-md border border-border bg-background px-5 py-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
              >
                <f.icon className="size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-charcoal-muted">{f.label}</p>
                  <p className="truncate font-mono text-sm font-medium group-hover:text-primary-text">
                    {f.value}
                  </p>
                </div>
              </a>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Why Monad */
/* Editorial — an asymmetric, magazine-style layout, not a 3-card grid. */

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
    <section className="bg-light-purple">
      <div className="mx-auto grid w-full max-w-5xl gap-16 px-6 py-28 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[2.75rem]">
            Why Distro is built on Monad
          </h2>
        </Reveal>
        <div className="flex flex-col gap-10">
          {points.map((p, i) => (
            <Reveal key={p.k} delay={i * 0.08}>
              <div className="border-l-2 border-primary/25 pl-6">
                <p className="text-xl font-medium text-pretty">{p.k}</p>
                <p className="mt-2 text-charcoal-muted">{p.v}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Security */
/* Soft purple flat — calmer than a gradient, since this section carries
   trust claims and needs to read as restrained rather than dramatic. */

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
    <section id="security" className="scroll-mt-20 bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-28">
        <Reveal>
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-tight sm:text-[2.75rem]">
            Security
          </h2>
          <p className="mt-4 max-w-2xl text-charcoal-muted">
            Distro moves real money, so the guarantees are architectural, not promises. It is not a
            wallet, an exchange, or a custodian.
          </p>
        </Reveal>
        <RevealGroup className="mt-14 grid gap-8 sm:grid-cols-3">
          {guarantees.map((g) => (
            <RevealItem key={g.title} className="flex flex-col gap-3">
              <g.icon className="size-5 text-primary" />
              <h3 className="font-medium">{g.title}</h3>
              <p className="text-sm text-charcoal-muted">{g.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-primary/15 pt-6 text-sm">
          <a
            href="https://monadscan.com/address/0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary-text hover:underline"
          >
            Contract 0xd9C7…4538 <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/tweetbysobur/distro"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-charcoal-muted hover:text-foreground"
          >
            Open source <ExternalLink className="size-3" />
          </a>
          <span className="text-charcoal-muted">
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
    <section className="bg-background">
      <div className="mx-auto w-full max-w-3xl px-6 py-28">
        <Reveal>
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-tight sm:text-[2.75rem]">
            Questions
          </h2>
        </Reveal>
        <div className="mt-12 divide-y divide-border border-y border-border">
          {items.map((it) => (
            <details key={it.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
                {it.q}
                <span className="text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm text-charcoal-muted">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- CTA */
/* Beautiful gradient — the heaviest mesh in the page, echoing the Hero. The
   two most visually rich moments are deliberately the open and the close. */

function FinalCta() {
  return (
    <section className="relative overflow-hidden" style={{ background: "var(--gradient-mesh)" }}>
      <div className="mx-auto w-full max-w-3xl px-6 py-28 text-center">
        <Reveal>
          <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Send your first distribution.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-pretty text-charcoal-muted">
            Connect your wallet and pay everyone at once — reviewed, tracked, and verifiable
            onchain.
          </p>
          <div className="mt-9 flex justify-center">
            <ConnectWalletButton />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Footer */

const FOOTER_COLUMNS: {
  heading: string;
  links: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Security", href: "#security" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "GitHub", href: "https://github.com/tweetbysobur/distro", external: true },
      {
        label: "Smart Contracts",
        href: "https://github.com/tweetbysobur/distro/tree/main/contracts",
        external: true,
      },
      {
        label: "Contract Address",
        href: "https://monadscan.com/address/0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538",
        external: true,
      },
    ],
  },
  {
    heading: "Resources",
    links: [
      {
        label: "Documentation",
        href: "https://github.com/tweetbysobur/distro/tree/main/docs",
        external: true,
      },
      { label: "Monad Explorer", href: "https://monadscan.com", external: true },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
              <DistroMark className="size-4 text-primary" />
              Distro
            </p>
            <p className="mt-3 max-w-xs text-sm text-charcoal-muted">
              Onchain distribution engine for Monad. Not a wallet, exchange, bridge, bank, or
              custodian.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-charcoal-muted">
              <span className="size-1.5 rounded-full bg-success" />
              Built on Monad Mainnet
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {col.heading}
              </p>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm text-charcoal-muted">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link href={link.href} className="hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-charcoal-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Distro. All rights reserved.</span>
          <span>Chain id 143 · Monad Mainnet</span>
        </div>
      </div>
    </footer>
  );
}
