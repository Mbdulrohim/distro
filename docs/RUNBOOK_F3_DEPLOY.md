# Runbook — F3: Deploy `Multisend` + calibrate gas

Everything for F3 is built. **It must be run from a machine that can reach Monad** — the environment this was authored in cannot resolve `*.monad.xyz` at all (DNS fails for the RPC, the docs, and the explorers alike), so the deploy and the measurement could not be executed here.

Two things come out of this: a deployed testnet address, and the **real** `MIN_GAS_PER_TRANSFER`.

---

## 0. Prerequisites

```bash
cd contracts
cp .env.example .env     # then fill in the RPC URLs
```

`.env` needs:

```
MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_MAINNET_RPC_URL=https://rpc.monad.xyz
```

A funded testnet EOA for the deploy. See §4 on why a Safe isn't required for _this_ contract.

---

## 1. Measure the gas (do this first — it changes the source)

```bash
cd contracts
forge test --fork-url $MONAD_MAINNET_RPC_URL \
  --match-path "test/Multisend.fork.t.sol" -vv
```

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

```bash
forge test        # all 33 offline tests must still pass
```

---

## 2. Deploy to testnet

```bash
forge script script/DeployMultisend.s.sol:DeployMultisend \
  --rpc-url $MONAD_TESTNET_RPC_URL \
  --broadcast -vvv
```

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
