# CLAUDE.md

Working context for Claude Code in this repo.

## What this project is

DISTRO is a token/asset distribution platform on the Monad blockchain. See [docs/PRD.md](docs/PRD.md) for full product context.

## Stack & conventions

- **Contracts**: Solidity + Foundry. Tests in `contracts/test/`, one test file per contract. Run `forge test` before considering contract work done.
- **Backend**: Node.js/TypeScript, Postgres. Migrations live under `apps/api/`.
- **Frontend**: Next.js (App Router), wagmi/viem for chain interaction, RainbowKit for wallet connect.
- **Chain**: Monad (EVM-compatible) — testnet first, mainnet later. Never hardcode chain IDs/RPC URLs; read from config/env.

## Plugins in use

- **monskills** — Monad-specific skills/reference plugin (contract patterns, wallet integration, gas, tooling). Consult before writing new contract or chain-integration code.
- **impeccable** — design-review hook. Checks UI files after edits in `apps/web/`. Keep it on; don't bypass findings without a reason.

## Ground rules

- Don't invent product scope beyond [docs/PRD.md](docs/PRD.md) / [docs/FEATURES.md](docs/FEATURES.md) — flag gaps instead of guessing.
- Contract changes are high-stakes: no upgrades to deployed/mainnet contracts without explicit confirmation.
- Keep [docs/CONTRACT_SPEC.md](docs/CONTRACT_SPEC.md) and [docs/API.md](docs/API.md) in sync with actual code as they evolve.
