# AGENTS.md

Working context for Codex in this repo.

## What this project is

Distro is an **onchain distribution engine** on Monad: create a distribution, import recipients, select a token, schedule execution, approve — Distro executes onchain and tracks every payment. Payroll, airdrops, rewards, grants, contributor payouts.

**Distro is a push system.** The sender distributes; recipients receive tokens and never transact. There is no claim step, no Merkle proof, no eligibility portal, no vesting. If you find yourself designing one, you are building the wrong product — earlier drafts of these docs described a claim-based model and were wrong.

Distro is explicitly **not a custodian** — with one deliberate, narrow exception documented below. See [docs/PRD.md](docs/PRD.md) for full product context.

## Stack & conventions

- **Contracts**: Solidity + Foundry in `contracts/`. Tests in `contracts/test/`, one test file per contract. Run `forge test` before considering contract work done. Build on OpenZeppelin rather than reimplementing primitives.
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui in `web/`. wagmi/viem for chain interaction.
- **Auth**: SIWE (Sign-In With Ethereum) → stateless JWT session cookie. Not RainbowKit, not Para. See `web/src/lib/auth/`.
- **Backend**: Next.js route handlers (`web/src/app/api/`) + Neon Postgres. Migrations in `database/migrations/`.
- **Indexer**: must be a long-running service — it cannot be serverless (needs a persistent event subscription). Not built yet.
- **Chain**: Monad Mainnet (chain id 143) by default; testnet (10143) is reachable only under an explicit staging flag (`NEXT_PUBLIC_ENABLE_TESTNET`). Chain data comes from viem's built-in `monad` chain — don't hand-roll it. RPC URLs come from env; chain ids are protocol facts, not config.

## Contract status — read before touching deployment

| Contract                                       | Purpose                                                     | Status                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Multisend.sol`                                | Immediate ERC-20 distribution, stateless, non-custodial     | Deployed and wired on mainnet + testnet                                                                         |
| `MultisendNative.sol`                          | Immediate native-MON distribution, stateless, non-custodial | Deployed and wired on mainnet + testnet                                                                         |
| `Distribution.sol` / `DistributionFactory.sol` | Scheduled distribution — escrow, permissionless execution   | Built, 100+ tests passing, **not deployed anywhere** — blocked on an external audit (see `docs/AUDIT_SCOPE.md`) |

## Plugins in use

- **monskills** — Monad-specific reference (contract patterns, gas, addresses, tooling, concepts). Consult before writing contract or chain-integration code. Its `gas` skill matters: Monad charges on `gas_limit`, not gas used.
- **impeccable** — design-review hook. Checks UI files after edits in `web/`. Keep it on; don't bypass findings without a reason.

## Ground rules

- Don't invent product scope beyond [docs/PRD.md](docs/PRD.md) / [docs/FEATURES.md](docs/FEATURES.md) — flag gaps instead of guessing.
- Contract changes are high-stakes: no upgrades to deployed/mainnet contracts without explicit confirmation.
- A contract that holds funds between transactions (the escrow contract above) does not reach mainnet without an external audit — no exceptions. `Multisend`/`MultisendNative` are stateless and non-custodial by construction (tokens move sender → recipient in one call; contract balance is always zero), which is the specific, narrow reason they were deployed via a bare EOA under an explicit, reasoned exception rather than waiting on a Safe multisig — see `web/src/config/contracts.ts` for the reasoning in full. That exception does not extend to the escrow contract.
- Keep [docs/CONTRACT_SPEC.md](docs/CONTRACT_SPEC.md) and [docs/API.md](docs/API.md) in sync with actual code as they evolve.
- Never hardcode a Monad token/contract address — verify via the monskills `addresses` skill.

## Repo layout

```
contracts/   Foundry — Multisend, MultisendNative (deployed); Distribution/DistributionFactory escrow (built, undeployed)
web/         Next.js 15 app — marketing + dashboard + API routes
database/    Neon Postgres migrations
docs/        PRD, FEATURES, USER_FLOW, CONTRACT_SPEC, DATABASE, API, ROADMAP, BRAND, CTO_REVIEW, AUDIT_SCOPE
PRODUCT.md   impeccable's strategic design context
DESIGN.md    impeccable's visual system
```
