# Runbook — F3: Deploy `Multisend` + calibrate gas

Everything for F3 is built. **It must be run from a machine that can reach Monad** — the environment this was authored in cannot resolve `*.monad.xyz` at all (DNS fails for the RPC, the docs, and the explorers alike), so the deploy and the measurement could not be executed here.

Two things come out of this: a deployed testnet address, and the **real** `MIN_GAS_PER_TRANSFER`.

---

> **Shell:** commands are **PowerShell** (the project's primary shell). `$VAR` is bash syntax and will silently expand to nothing in pwsh — so these use Foundry's own RPC aliases from `foundry.toml` instead, which work identically in every shell.

## 0. Prerequisites

### a. Put Foundry on your PATH

Foundry is installed at `C:\Users\USER\.foundry\bin`, but PowerShell may not see it (`forge: The term 'forge' is not recognized`). This session only:

```powershell
$env:PATH += ";$env:USERPROFILE\.foundry\bin"
```

Permanently (recommended — do it once):

```powershell
[Environment]::SetEnvironmentVariable(
  "PATH",
  [Environment]::GetEnvironmentVariable("PATH", "User") + ";$env:USERPROFILE\.foundry\bin",
  "User"
)
```

Reopen the terminal, then confirm:

```powershell
forge --version
```

### b. Environment

Use the **absolute path** — a fresh terminal opens in your home folder, and `forge` run outside the project doesn't error, it just prints `Nothing to compile` and does nothing:

```powershell
cd C:\Users\USER\Documents\DISTRO\contracts
Copy-Item .env.example .env
```

Sanity-check you're in the right place (`foundry.toml` must be listed):

```powershell
Get-ChildItem foundry.toml
```

The public RPC URLs ship as working defaults, so there's nothing to fill in for testnet. Foundry loads `.env` automatically.

### c. A deployer key — via keystore, never a raw key

Per the Monad docs' recommended method. **Never paste a private key into a command, a file, or a chat** — `--interactive` prompts for it and stores it encrypted:

```powershell
cast wallet import monad-deployer --interactive
```

To use a fresh throwaway key for testnet, generate one first with `cast wallet new` and import that.

### d. Fund it

Get testnet MON from the faucet: **https://testnet.monad.xyz** (chain 10143). You need gas to deploy.

See §4 on why a Safe isn't required for _this_ contract.

---

## 1. Measure the gas (do this first — it changes the source)

```powershell
cd C:\Users\USER\Documents\DISTRO\contracts
forge test --fork-url monad_mainnet --match-path "test/Multisend.fork.t.sol" -vv
```

`monad_mainnet` is an alias defined in `foundry.toml`, resolved from `.env` — no shell variable syntax, so it behaves the same in pwsh and bash.

Measures against a **mainnet fork** (no funds move — a fork is a local simulation). Mainnet rather than testnet because it measures against **real USDC**, and real tokens cost more than a plain ERC-20: USDC-class contracts do extra storage reads for blocklist checks, and the floor must clear the _most_ a legitimate transfer could need.

Read from the output:

| Log line                                   | Use                                           |
| ------------------------------------------ | --------------------------------------------- |
| `MONAD marginal gas/recipient (real USDC)` | the number `MIN_GAS_PER_TRANSFER` must exceed |
| `Recommended (2x real-token marginal)`     | the value to set                              |
| `MONAD gas, 200 recipients (real USDC)`    | derive the dashboard's default batch size     |

**If `test_fork_placeholderFloorIsNotTooLow` fails**, the current `100_000` is _below_ a real transfer's cost — legitimate payments would be starved and mislabeled as failures. Fix the constant; do not touch the test.

**If `test_fork_gas_realUsdc` fails with "no code at the USDC address"**, the token registry is wrong. Stop and fix `web/src/lib/tokens/registry.ts` before anything else — a wrong token address means users approve and send to the wrong contract.

### Then update the constant

In `contracts/src/Multisend.sol`, replace the `MIN_GAS_PER_TRANSFER` placeholder with the measured value and **record the measurement in the comment** (the current comment explains why the naive "×4 for Monad cold access" extrapolation is invalid — replace it with the real number, don't delete the reasoning).

Mirror the same value in `test/Multisend.gas.t.sol`'s `floor` local — it's mirrored deliberately so changing the constant fails that test and forces a re-justification.

```powershell
forge test        # all 33 offline tests must still pass
```

---

## 2. Deploy to testnet

```powershell
forge script script/DeployMultisend.s.sol:DeployMultisend `
  --rpc-url monad_testnet `
  --account monad-deployer `
  --broadcast -vvv
```

(Backtick is PowerShell's line continuation — the bash `\` will not work.)

Record the address in:

- `contracts/deployments/monad-testnet.json` (create from the shape in `deployments/README.md`)
- `web/src/config/contracts.ts` → `CONTRACTS[10143].multisend`

**Both, in the same commit.** If they drift, the app talks to the wrong contract.

---

## 3. Verify the contract

Use the multi-explorer verification API (monskills `scaffold` skill) — it covers MonadVision, Socialscan, and Monadscan in one call. Do **not** reach for `forge verify-contract` first.

```bash
forge verify-contract <ADDRESS> src/Multisend.sol:Multisend \
  --chain 10143 --show-standard-json-input > /tmp/standard-input.json
cat out/Multisend.sol/Multisend.json | jq '.metadata' > /tmp/metadata.json
```

Then POST to `https://agents.devnads.com/v1/verify` per the `scaffold` skill. `Multisend`'s constructor takes no arguments, so no `constructorArgs`.

---

## 4. On the Safe-multisig rule

CLAUDE.md requires deploys to go through a Safe, never a bare EOA. That rule exists so no single key holds privileged power over a deployed contract — and it applies **in full** to `DistributionFactory` (owner, fee, pause).

**`Multisend` has no owner, no admin, no privileged role at all.** The deployer cannot pause it, upgrade it, take a fee, or touch a single token. Who broadcasts the transaction is therefore not a security property — it only determines the address. A plain EOA is fine here, and is the pragmatic choice for testnet calibration.

For **mainnet**, prefer a deterministic CREATE2 deploy (via one of Monad's canonical deployers — monskills `addresses`) so the address is reproducible and independent of deployer nonce. That's a provenance win, not a permissions one.

---

## 5. What this does _not_ unblock

Deploying to testnet does not let the app talk to it. `config/chains.ts` and the wagmi config are **Monad Mainnet only** by design (Feature 1's explicit requirement), and auth _rejects_ signing on any other chain.

So testnet is currently for **contract validation and gas measurement only**. To exercise the full flow against testnet, add it as a staging environment first — [ARCHITECTURE.md](ARCHITECTURE.md) already calls for "fully separated testnet/staging vs mainnet, separate deployed contract addresses," so that's consistent with the plan, just not yet built.

Note too that the token registry holds **mainnet** addresses. Those contracts do not exist at those addresses on testnet, so testnet end-to-end testing needs testnet tokens or a mock ERC-20 deployed alongside.

---

## Definition of Done

- [ ] `MIN_GAS_PER_TRANSFER` is measurement-backed, with the measurement recorded in the comment.
- [ ] `test_fork_placeholderFloorIsNotTooLow` passes against a real fork.
- [ ] All 33 offline tests still pass.
- [ ] `Multisend` deployed to Monad testnet.
- [ ] Address recorded in `deployments/monad-testnet.json` **and** `web/src/config/contracts.ts`.
- [ ] Contract verified on all three explorers.
- [ ] Default batch size derived from the 200-recipient measurement (feeds `lib/recipients/encode.ts`).
