# DISTRO

Token and asset distribution platform for the Monad blockchain. DISTRO lets projects create, fund, and manage distribution campaigns — airdrops, vesting schedules, and batch payouts — from a single dashboard, and lets recipients claim what they're owed.

## Stack

- **Contracts**: Solidity, Foundry, deployed to Monad
- **Backend**: Node.js/TypeScript API, Postgres
- **Frontend**: Next.js, wagmi/viem, RainbowKit
- **Indexing**: on-chain event indexer for campaign/claim state

See [`docs/`](docs/) for product, contract, and architecture specs.

## Repo layout

```
distro/
├── contracts/       # Foundry project: campaign contracts, factory, tests
├── apps/
│   ├── web/          # Next.js dashboard + claim portal
│   └── api/           # Backend API + indexer
├── docs/             # Product and technical specs
├── README.md
└── CLAUDE.md
```

## Getting started

Setup instructions land here once the contracts and apps scaffolds are in place (see [ROADMAP.md](docs/ROADMAP.md) for sequencing).
