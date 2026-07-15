# distro-contracts

Foundry project for DISTRO's smart contracts. See [../docs/CONTRACT_SPEC.md](../docs/CONTRACT_SPEC.md) for the architecture this implements.

## Structure

```
contracts/
├── src/
│   └── interfaces/     # Contract interfaces
├── test/                 # Foundry tests (one file per contract)
├── script/               # Deployment scripts
├── lib/                   # forge-std, OpenZeppelin (via forge install)
├── foundry.toml
└── remappings.txt
```

## Setup

`lib/` (forge-std, OpenZeppelin) is gitignored, not vendored into history — restore it after cloning:

```bash
forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts
```

## Commands

```bash
forge build
forge test
forge fmt
```

## Conventions

- Build on OpenZeppelin contracts (`lib/openzeppelin-contracts`) rather than reimplementing token/access-control primitives — see `monskills` `scaffold` skill.
- Never hardcode a Monad contract/token address — cross-check against the `monskills` `addresses` skill.
- Deployment goes through an agent wallet + Safe multisig (`monskills` `wallet` skill), not a bare EOA key — see [../docs/CTO_REVIEW.md](../docs/CTO_REVIEW.md) on the single-EOA-admin risk.
- After deploy: verify via the multi-explorer verification API (`monskills` `scaffold` skill), not `forge verify-contract` directly.
