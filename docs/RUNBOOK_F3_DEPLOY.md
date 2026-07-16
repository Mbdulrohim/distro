# Runbook — F3: Deploy `Multisend` + calibrate gas

Two things come out of F3: the **real** `MIN_GAS_PER_TRANSFER`, and a deployed testnet address.

**Step 1 (gas measurement) is ✅ done** — see the results below. **Step 2 (deploy) still needs running**, because it requires a funded key that only you hold.

> Both machines this was attempted from hit `dns error` / `os error 11002` on `*.monad.xyz` while browsers loaded Monad sites fine. If that's you, see the DNS section below — it's a resolver problem, not a Monad outage.

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

## ⚠️ If you hit `dns error` / `os error 11002`

`forge` fails on `https://rpc.monad.xyz` while your **browser** loads Monad sites fine. That's not a contradiction: Chrome uses DNS-over-HTTPS and bypasses your system resolver — `forge` doesn't.

The domain is healthy; it's a CNAME to QuickNode:

```
rpc.monad.xyz          → delicate-empty-lake.monad-mainnet.quiknode.pro → 64.31.29.187
testnet-rpc.monad.xyz  → quiet-methodical-seed.monad-testnet.quiknode.pro
```

**Diagnose** (if the first fails and the second works, your resolver is the problem):

```powershell
Resolve-DnsName rpc.monad.xyz
Resolve-DnsName rpc.monad.xyz -Server 1.1.1.1
```

**Fix** — flush, then point at a public resolver (needs an elevated terminal; `Get-NetAdapter` to find your interface name):

```powershell
ipconfig /flushdns
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("1.1.1.1","8.8.8.8")
```

**Or bypass it entirely** by passing the CNAME target as the fork URL — this is what unblocked the measurement below:

```powershell
forge test --fork-url https://delicate-empty-lake.monad-mainnet.quiknode.pro `
  --match-path "test/Multisend.fork.t.sol" -vv
```

Treat that as a workaround, not a config value: it's the endpoint `rpc.monad.xyz` currently points at, and it can change without notice. Never hardcode it.

---

## 1. Measure the gas — ✅ DONE (2026-07-16)

```powershell
cd C:\Users\USER\Documents\DISTRO\contracts
forge test --fork-url monad_mainnet --match-path "test/Multisend.fork.t.sol" -vv
```

`monad_mainnet` is an alias in `foundry.toml`, resolved from `.env` — no shell variable syntax, so it behaves the same in pwsh and bash.

**Results, against real Monad mainnet state:**

| Measurement                           | Value              |
| ------------------------------------- | ------------------ |
| marginal gas/recipient, plain ERC-20  | 28,783             |
| marginal gas/recipient, **real USDC** | **31,471**         |
| 200 recipients (real USDC)            | 6,335,797          |
| `MIN_GAS_PER_TRANSFER` floor          | 100,000 (~3.2x) ✅ |

`MIN_GAS_PER_TRANSFER` stays at **100,000** — now measurement-backed rather than guessed. It is retained rather than tightened because the floor must clear the most gas a _legitimate_ transfer could need, and USDC is a reference point, not an upper bound.

**The headline finding: Monad costs ~1.1x local, not 4x.** The tempting extrapolation (local 28.6k × the "3-4x cold access" figure ≈ 115k) would have set the floor _above_ a real transfer's cost — starving legitimate payments and mislabeling them as rejections, the exact bug the floor prevents. Measure; don't multiply.

It forks **mainnet** (no funds move — a fork is a local simulation) rather than testnet, because it needs **real USDC**: real tokens cost more than a plain ERC-20 (blocklist checks add storage reads), and the floor must clear the _most_ a legitimate transfer could need.

**Re-run after any change to `distribute`'s hot loop.** Two failures matter:

- **`test_fork_placeholderFloorIsNotTooLow`** — the floor has fallen below a real transfer's cost. Legitimate payments would be starved and mislabeled as failures. Fix the constant; don't touch the test. (`MIN_GAS_PER_TRANSFER` is mirrored in `test/Multisend.gas.t.sol` on purpose, so changing it forces a re-justification.)
- **`test_fork_gas_realUsdc` — "no code at the USDC address"** — the token registry is wrong. Stop everything and fix `web/src/lib/tokens/registry.ts`: a wrong token address means users approve and send to the wrong contract.

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

- [x] `MIN_GAS_PER_TRANSFER` is measurement-backed (31,471 real-USDC marginal; floor 100k = ~3.2x), recorded in the comment.
- [x] `test_fork_placeholderFloorIsNotTooLow` passes against a real fork.
- [x] All 33 offline tests still pass.
- [ ] `Multisend` deployed to Monad testnet.
- [ ] Address recorded in `deployments/monad-testnet.json` **and** `web/src/config/contracts.ts`.
- [ ] Contract verified on all three explorers.
- [ ] Default batch size derived from the 200-recipient measurement (feeds `lib/recipients/encode.ts`).
