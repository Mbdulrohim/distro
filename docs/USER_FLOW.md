# User flows — Distro

> Push model: only the creator transacts. Recipients receive tokens and do nothing — there is no recipient-facing flow.

## 1. Create and execute a distribution now

1. Connect wallet (SIWE sign-in, Monad Mainnet) → dashboard.
2. **New distribution** → name it, select the ERC-20 token.
3. **Import recipients** — upload CSV (`address,amount`) or paste. A downloadable template is offered; the expected format is never assumed.
4. **Validation** runs immediately: invalid addresses, duplicates, bad amounts, and total-vs-balance. Errors are shown inline against the offending rows, not as a generic failure.
5. **Schedule** → "Execute now".
6. **Review** — recipient count, total in both human and base units, token, chunk count, estimated gas, and an explicit irreversibility warning.
7. **Approve + fund** → wallet prompts (ERC-20 approve, then `createDistribution` + `fund`). Tokens move into the distribution's escrow.
8. Execution begins; the dashboard streams per-chunk and per-recipient results live.
9. **Completed** — creator sees paid/failed totals, can retry failures or export a CSV record.

## 2. Schedule a distribution for later (e.g. Friday payroll)

Steps 1–4 as above, then:

5. **Schedule** → pick date/time. Shown in local time *and* UTC to prevent a timezone mistake sending payroll on the wrong day.
6. **Review + approve + fund** — funds are escrowed now; they cannot be paid out before the scheduled time (enforced onchain by `executeAfter`, not by Distro).
7. Distribution sits in **Scheduled**. The creator can **cancel for a full refund** any time before execution.
8. At the scheduled time, Distro's keeper triggers execution automatically.
   - If the keeper is unavailable, the creator (or anyone) can trigger it manually — the dashboard always offers "Execute now" once the time has passed. Execution is permissionless by design; Distro being down cannot make payroll miss.
9. Creator tracks results as in flow 1.

## 3. Retry failed payments

1. A distribution completes with some failures (e.g. a token blocklist rejected a recipient).
2. Dashboard shows exactly which recipients failed, with the revert reason where available — successful payments are untouched and never re-sent.
3. Creator fixes what's fixable (or not) and clicks **Retry failed**.
4. Only the failed recipients are re-attempted, using funds still held in escrow.
5. Any permanently undeliverable amount can be **reclaimed** to the creator's wallet once execution is complete.

## 4. Cancel a scheduled distribution

1. Creator opens a **Scheduled** distribution.
2. **Cancel** → clear confirmation showing the full refund amount.
3. Wallet prompts `cancel()`; escrow returns the entire balance to the creator.
4. Distribution moves to **Cancelled** — it can never pay anyone afterward.

## Failure states that must be designed (not generic toasts)

Per [CTO_REVIEW.md](CTO_REVIEW.md), each of these needs a real designed state:

- Wrong network connected (must be Monad Mainnet).
- Insufficient token balance at funding time.
- Wallet rejection at approve/fund/execute.
- RPC timeout or transaction stuck pending.
- Transaction reverted.
- **Indexer lag** — the gap between "confirmed onchain" and "dashboard updated" needs an explicit *syncing* state, or users assume failure and retry, wasting gas.
- Unsupported token detected at funding (fee-on-transfer / rebasing).
