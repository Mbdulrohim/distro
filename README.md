<div align="center">

# Distro

**The onchain distribution engine for Monad.**

Send tokens to hundreds of wallets — payroll, airdrops, rewards, grants, contributor payouts — from one automated workflow instead of hundreds of manual transactions.

[Live app](https://getdistro.vercel.app) · [Docs](docs/) · [Contracts](contracts/src)

</div>

---

## Why Distro exists

Blockchain made transferring assets permissionless. It never made _distributing_ them efficient.

Paying a team, a community, or a set of contributors onchain still means doing the same thing by hand, once per recipient: copy an address, verify it, enter an amount, sign a transaction, track whether it landed, retry it if it didn't. That process gets slower and more error-prone with every name added to the list.

Distro turns it into one workflow: **create a distribution, import recipients, choose a token, decide when it runs, approve.** Distro executes onchain and tracks every payment, so "did everyone get paid?" always has a precise answer.

## What Distro is — and isn't

| Distro **is**                        | Distro is **not**   |
| ------------------------------------ | ------------------- |
| A distribution platform              | A wallet            |
| An automation tool for recurring pay | An exchange         |
| A payment scheduler                  | A bridge            |
| A payroll engine                     | A bank              |
| A reward-distribution system         | A custodian         |
| Treasury distribution infrastructure | A portfolio tracker |

Distro is a **push** system: the sender distributes, and recipients simply receive — there's no claim step, no eligibility portal, no vesting contract for them to interact with.

## Product pillars

- **Distribution** — send a token to many recipients efficiently, in one workflow. One blocked or failing address never stops the rest of the run.
- **Scheduling** — execute now, or commit a distribution onchain to run at a future date and time, permissionlessly.
- **Automation** — turn a recurring payout into a repeatable workflow instead of rebuilding a recipient list every cycle.
- **Tracking** — know exactly who's been paid, when, and see every transaction verified onchain.

## Who it's for

**Primary** — Web3 startups, DAO contributors, community managers, NFT projects, token issuers.
**Secondary** — hackathon organizers, payroll teams, grant programs, freelancer agencies, creator communities.

**Use cases:** monthly payroll · community rewards · airdrops · bug bounty payouts · hackathon prizes · grant distributions · creator revenue sharing · affiliate payouts · scholarship payments · DAO contributor compensation.

## Why Monad

Large-scale distributions need fast execution, low transaction costs, and high throughput — exactly what Monad's parallelized EVM provides. It's what lets Distro process a 200-recipient payroll run or a bulk airdrop without the cost or latency becoming the product's bottleneck, while staying fully Ethereum-tool-compatible (Solidity, Foundry, viem/wagmi — no new language, no new wallet).

## How it works

1. **Create** a distribution and give it a name.
2. **Import recipients** — upload a CSV or paste a list. Every address is validated and duplicates are flagged before you commit.
3. **Select a token** — any ERC-20, or native MON.
4. **Choose when it executes** — immediately, or scheduled for later.
5. **Review** the exact recipient count, total, and gas estimate — nothing sends until you approve it.
6. **Approve.** Distro executes onchain and tracks every payment in real time, with each transaction verifiable on the block explorer.

## Architecture

```
distro/
├── contracts/    Foundry — Multisend, MultisendNative, Distribution/DistributionFactory (escrow)
├── web/          Next.js 15 — marketing site, dashboard, API routes
├── supabase/     Postgres schema + migrations (index/cache over onchain state)
└── docs/         Product and technical specifications
```

**Contracts** (Solidity + Foundry, 150+ tests):

| Contract                                       | Purpose                                                                        | Status                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `Multisend.sol`                                | Immediate ERC-20 distribution, stateless                                       | **Live on Monad mainnet & testnet**                                                                                    |
| `MultisendNative.sol`                          | Immediate native-MON distribution, stateless                                   | **Live on Monad mainnet & testnet**                                                                                    |
| `Distribution.sol` / `DistributionFactory.sol` | Scheduled distribution — escrow, permissionless execution, native MON + ERC-20 | Built and tested, **not yet deployed** — blocked on an external audit (see [docs/AUDIT_SCOPE.md](docs/AUDIT_SCOPE.md)) |

Both live contracts are stateless and non-custodial by construction: tokens move directly from sender to recipient in the same transaction, so the contract's balance is always zero and a bug in transfer logic can, at worst, cause a failed send — never a stolen or stranded fund. The escrow contract is a different risk category (it holds funds between scheduling and execution), which is exactly why it stays unaudited-and-undeployed until that gap is closed.

**Frontend** — Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, wagmi/viem, Framer Motion.
**Auth** — Sign-In With Ethereum (SIWE) → stateless JWT session. No third-party wallet-auth provider.
**Data** — Supabase (Postgres) as an index/cache over onchain state; the chain is always the source of truth for what actually happened.

## Landing page

Hero · Problem · Solution · How It Works · Features · Templates · Use Cases · Security · Why Monad · FAQ · CTA · Footer — each section carries its own visual identity rather than repeating the same white block down the page.

## Documentation

| Doc                                                            | Covers                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [docs/PRD.md](docs/PRD.md)                                     | Product definition, scope, success metrics                               |
| [docs/FEATURES.md](docs/FEATURES.md)                           | Feature set, mapped to the four product pillars                          |
| [docs/CONTRACT_ARCHITECTURE.md](docs/CONTRACT_ARCHITECTURE.md) | Contract-system design: responsibilities, storage, events, gas, security |
| [docs/CONTRACT_SPEC.md](docs/CONTRACT_SPEC.md)                 | The escrow contract's normative spec — state machine, invariants         |
| [docs/AUDIT_SCOPE.md](docs/AUDIT_SCOPE.md)                     | What an external audit of the escrow contract needs to cover             |
| [docs/DATABASE.md](docs/DATABASE.md)                           | Supabase schema, RLS policies, indexes                                   |
| [docs/API.md](docs/API.md)                                     | Route handlers backing the dashboard                                     |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                   | Full system architecture and the reasoning behind each decision          |
| [docs/ROADMAP.md](docs/ROADMAP.md)                             | Phasing and the decisions that gate each phase                           |
| [docs/BRAND.md](docs/BRAND.md)                                 | Name, voice, vocabulary                                                  |

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

Copy [.env.example](.env.example) to `web/.env.local` and fill in your Supabase project, RPC, and session values before running the app. Never commit a filled-in env file.

## Conventions

- Build on OpenZeppelin; never reimplement token or access-control primitives.
- Never hardcode a Monad token or contract address — verify against the canonical registry before adding one.
- Chain data comes from viem's built-in `monad` chain definition; chain IDs are protocol facts, not configuration.
- A contract that holds funds between transactions doesn't reach mainnet without an external audit — no exceptions. A stateless, non-custodial contract can be deployed under an explicit, reasoned exception to that rule; the reasoning has to hold up on its own, not just "it seemed fine."

## License

MIT — see [LICENSE](LICENSE).
