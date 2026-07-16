# User flows — Distro

> Push model: only the creator transacts. Recipients receive tokens and do nothing — there is no recipient-facing flow.

## 1. Create and execute a distribution now

1. Connect wallet (SIWE sign-in, Monad Mainnet) → dashboard.
2. **New distribution** → name it, select the ERC-20 token.
3. **Import recipients** — upload CSV (`address,amount`) or paste. A downloadable template is offered; the expected format is never assumed.
4. **Validation** runs immediately: invalid addresses, duplicates, bad amounts, and total-vs-balance. Errors are shown inline against the offending rows, not as a generic failure.
5. **Schedule** → "Execute now".
6. **Review** — recipient count, total in both human and base units, token, chunk count, estimated gas, and an explicit irreversibility warning. The escrow address is already known here (CREATE2 is deterministic), so it can be shown before anything is signed.
7. **Commit** → `createDistribution`, then `commitChunk` per chunk. The contract hashes and sums each payload and emits it onchain — so the total the creator funds is computed by the contract, not asserted by the dashboard. Large lists commit across several transactions; the UI must treat this as one reviewable step, not expose the chunk mechanics.
8. **Approve + fund** → ERC-20 approve, then `fund()`. Tokens move into escrow.
9. Execution begins; the dashboard streams per-chunk and per-recipient results live.
10. **Completed** — creator sees paid/failed totals, can retry failures or export a CSV record.

## 2. Schedule a distribution for later (e.g. Friday payroll)

Steps 1–4 as above, then:

5. **Schedule** → pick date/time. Shown in local time _and_ UTC to prevent a timezone mistake sending payroll on the wrong day.
6. **Review + commit** — the recipient list is committed onchain; the distribution is now **Ready**.
7. **Fund whenever you choose**, any time before execution — at commit, or Thursday night for a Friday run. Funding is decoupled from creation, so the creator picks the lock-up window rather than the architecture imposing one.
   - **A Ready-but-unfunded distribution does nothing at its scheduled time.** No revert, no alert from the chain — it simply no-ops. The dashboard carries the entire burden of making this impossible to miss.
8. Once funded, the distribution sits **scheduled**. The creator can **cancel for a full refund** any time before execution begins.
9. At the scheduled time, Distro's keeper triggers execution automatically.
   - If the keeper is unavailable, the creator (or anyone) can trigger it manually — the dashboard always offers "Execute now" once the time has passed. This works without Distro's database because the recipient list is recoverable from onchain logs.
10. Creator tracks results as in flow 1.

## 3. Retry failed payments

1. A distribution completes with some failures (e.g. a token blocklist rejected a recipient).
2. Dashboard shows exactly which recipients failed, with the revert reason where available — successful payments are untouched and never re-sent.
3. Creator fixes what's fixable (or not) and clicks **Retry failed**.
4. Only the failed recipients are re-attempted, using funds still held in escrow.
5. Any permanently undeliverable amount can be **reclaimed** to the creator's wallet once execution is complete.

## 4. Cancel a scheduled distribution

1. Creator opens a scheduled distribution.
2. **Cancel** → clear confirmation showing the full refund amount.
3. Wallet prompts `cancel()`; escrow returns the entire balance to the creator.
4. Distribution moves to **Cancelled** — it can never pay anyone afterward.

Available until the first chunk executes, including after the scheduled time has passed. Once execution has begun it is no longer offered; undeliverable funds come back via reclaim instead (flow 5).

## 5. Nobody ever executed

The escape hatch for a keeper outage, a gas cost exceeding the distribution's value, or an indefinitely paused token — without it, a funded distribution that nobody executes would strand the creator's money permanently, since the factory deliberately has no admin path to it.

1. A funded distribution passes its scheduled time and stays unexecuted past the grace period.
2. The dashboard surfaces it as needing attention, offering both **Execute now** and **Reclaim funds**.
3. **Reclaim** returns the remaining balance and blocks any further execution — otherwise a later chunk would fail on an emptied escrow.

## Failure states that must be designed (not generic toasts)

Per [CTO_REVIEW.md](CTO_REVIEW.md), each of these needs a real designed state:

- Wrong network connected (must be Monad Mainnet).
- Insufficient token balance at funding time.
- Wallet rejection at approve/fund/execute.
- RPC timeout or transaction stuck pending.
- Transaction reverted.
- **Indexer lag** — the gap between "confirmed onchain" and "dashboard updated" needs an explicit _syncing_ state, or users assume failure and retry, wasting gas.
- Unsupported token detected at funding (fee-on-transfer / rebasing).
