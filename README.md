# Distro

**Onchain distribution engine for Monad.** Pay many wallets at once — payroll, rewards, grants, contributor payouts — from a single automated workflow instead of repeating transactions by hand.

Distro is a **push** system: the sender distributes, recipients receive tokens and never transact. There is no claim step. See [docs/PRD.md](docs/PRD.md) for the full product definition.

> **Status:** pre-launch. Wallet auth and the MVP `Multisend` contract are built; the distribution dashboard is next. See [docs/ROADMAP.md](docs/ROADMAP.md).

## What it does

1. Create a distribution and import recipients (CSV: `address,amount`).
2. Select an ERC-20 token; the dashboard validates addresses, amounts, and your balance.
3. Review the full committed state — irreversible actions are labelled as such.
4. Approve, and Distro executes the distribution onchain, tracking every payment.

One blocklisted or failing recipient never reverts the run for everyone else; failures are isolated and retryable.

## Stack

- **Contracts** — Solidity + Foundry, Monad Mainnet (chain id 143). `contracts/`
- **Frontend** — Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, wagmi/viem. `web/`
- **Auth** — SIWE (Sign-In With Ethereum) → stateless JWT session. Not RainbowKit, not Para.
- **Data** — Supabase (Postgres) as an index/cache over onchain state; the chain is the source of truth.

## Repo layout

```
distro/
├── contracts/    # Foundry — Multisend (MVP), escrow (scheduling, later)
├── web/          # Next.js 15 — marketing + dashboard + API routes
├── supabase/     # config + migrations
├── docs/         # product & technical specs (see below)
├── PRODUCT.md    # impeccable's strategic design context
├── DESIGN.md     # impeccable's visual system
└── CLAUDE.md     # working context for Claude Code
```

## Documentation

| File | What it covers |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product definition, scope, success metrics |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature set, mapped to the four product pillars |
| [docs/USER_FLOW.md](docs/USER_FLOW.md) | Step-by-step flows and the failure states that need designing |
| [docs/CONTRACT_ARCHITECTURE.md](docs/CONTRACT_ARCHITECTURE.md) | Contract-system design across both contracts (responsibilities, storage, events, gas, security, upgrades) |
| [docs/CONTRACT_SPEC.md](docs/CONTRACT_SPEC.md) | Escrow contract's normative spec (state machine, invariants) |
| [docs/DATABASE.md](docs/DATABASE.md) | Supabase schema, RLS policies, indexes |
| [docs/API.md](docs/API.md) | Route handlers backing the dashboard |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system architecture and the reasoning behind each decision |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phasing and the decisions that block each phase |
| [docs/BRAND.md](docs/BRAND.md) | Name, voice, vocabulary |
| [docs/ARCHITECTURE_REVIEW.md](docs/ARCHITECTURE_REVIEW.md) | Adversarial review — the *why* behind the contract's shape |
| [docs/CTO_REVIEW.md](docs/CTO_REVIEW.md) | Scope and product-fit review |

## Development

**Contracts**
```bash
cd contracts
forge build
forge test
```

**Web**
```bash
cd web
npm install
npm run dev
```

Copy [.env.example](.env.example) to `web/.env.local` and fill in Supabase, RPC, and session values before running the app. Never commit a filled-in env file.

## Conventions

- Build on OpenZeppelin; never reimplement token/access-control primitives.
- Never hardcode a Monad token/contract address — verify via the monskills `addresses` skill.
- Chain data comes from viem's built-in `monad` chain; chain ids are protocol facts, not config.
- Deployments go through a Safe multisig, never a bare EOA key.
