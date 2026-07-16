# CLAUDE.md

Working context for Claude Code in this repo.

## What this project is

Distro is an **onchain distribution engine** on Monad: create a distribution, import recipients, select a token, schedule execution, approve — Distro executes onchain and tracks every payment. Payroll, airdrops, rewards, grants, contributor payouts.

**Distro is a push system.** The sender distributes; recipients receive tokens and never transact. There is no claim step, no Merkle proof, no eligibility portal, no vesting. If you find yourself designing one, you are building the wrong product — earlier drafts of these docs described a claim-based model and were wrong.

Distro is explicitly **not a custodian**. See [docs/PRD.md](docs/PRD.md) for full product context.

## Stack & conventions

- **Contracts**: Solidity + Foundry in `contracts/`. Tests in `contracts/test/`, one test file per contract. Run `forge test` before considering contract work done. Build on OpenZeppelin rather than reimplementing primitives.
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui in `web/`. wagmi/viem for chain interaction.
- **Auth**: SIWE (Sign-In With Ethereum) → stateless JWT session cookie. Not RainbowKit, not Para. See `web/src/lib/auth/`.
- **Backend**: Next.js route handlers (`web/src/app/api/`) + Supabase (Postgres). Migrations in `supabase/migrations/`.
- **Indexer**: must be a long-running service — it cannot be serverless (needs a persistent event subscription). Not built yet.
- **Chain**: **Monad Mainnet only** (chain id 143). Chain data comes from viem's built-in `monad` chain — don't hand-roll it. RPC URLs come from env; chain ids are protocol facts, not config.

## Plugins in use

- **monskills** — Monad-specific reference (contract patterns, gas, addresses, tooling, concepts). Consult before writing contract or chain-integration code. Its `gas` skill matters: Monad charges on `gas_limit`, not gas used.
- **impeccable** — design-review hook. Checks UI files after edits in `web/`. Keep it on; don't bypass findings without a reason.

## Ground rules

- Don't invent product scope beyond [docs/PRD.md](docs/PRD.md) / [docs/FEATURES.md](docs/FEATURES.md) — flag gaps instead of guessing.
- Contract changes are high-stakes: no upgrades to deployed/mainnet contracts without explicit confirmation.
- Keep [docs/CONTRACT_SPEC.md](docs/CONTRACT_SPEC.md) and [docs/API.md](docs/API.md) in sync with actual code as they evolve.
- Never hardcode a Monad token/contract address — verify via the monskills `addresses` skill.
- Deployments go through a Safe multisig (monskills `wallet` skill), never a bare EOA key.

## Repo layout

```
contracts/   Foundry — DistributionFactory + Distribution escrow (not built yet)
web/         Next.js 15 app — marketing + dashboard + API routes
supabase/    config + migrations
docs/        PRD, FEATURES, USER_FLOW, CONTRACT_SPEC, DATABASE, API, ROADMAP, BRAND, CTO_REVIEW
PRODUCT.md   impeccable's strategic design context
DESIGN.md    impeccable's visual system
```
