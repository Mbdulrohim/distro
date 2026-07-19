# UX Punch List — First-Time User Walkthrough

Traced through the real code path, landing → completed distribution, on 2026-07-17. Not run live (this environment has no configured database or wallet), so every item is anchored to a specific file rather than a screenshot.

**The honest headline:** a first-time user **cannot** finish with a completed distribution on a production build. Mainnet's `Multisend` is deployed but deliberately unwired (unaudited), so `getMultisendAddress(143)` is `undefined` and the send dead-ends. The flow only completes on a **staging build** (`NEXT_PUBLIC_ENABLE_TESTNET=true`), against the testnet contract. Everything below assumes staging, since that's the only path that reaches "completed."

Severity: **P0** breaks or endangers the money flow · **P1** serious · **P2** medium · **P3** polish.

---

## P0 — Blocks or endangers the core action

### P0-1 · The "Distribute now" button doesn't distribute — it saves a draft

`distribution-review.tsx` · `create-flow.tsx`

The review screen's primary button reads **"Distribute now"**. Clicking it calls `onConfirm`, which `POST`s to `/api/distributions` and **saves a draft** — no money moves. Only then does a _second_ section appear below with a _second_ button, "Distribute to N recipients" (`ExecutePanel`), which is the one that actually sends.

So the single mental action "send the payments" is split across two buttons, and the more prominent one is mislabeled. A first-time user clicks "Distribute now", sees a draft-saved state, and reasonably wonders whether it worked or whether they've already sent money.

**Fix direction:** make the review's confirm do save-then-send as one action, or relabel it unambiguously ("Save & review send" is still bad — better to merge). One button, one act.

### P0-2 · The irreversibility checkbox gates the wrong step

`distribution-review.tsx`

The "I've reviewed the recipients and amounts" checkbox gates `onConfirm` — the **save**. The button that actually moves tokens (`ExecutePanel`) has **no acknowledgement gate at all**. The user acknowledges irreversibility, clicks a button that does something reversible (a DB write), and then sends real money with an unguarded click. The safety gate is spent on the safe action; the irreversible one has none. This is the sharpest issue in the app.

### P0-3 · "Check your wallet…" shown while merely saving

`distribution-review.tsx` (button label under `isConfirming`)

During the save `POST`, the button reads **"Check your wallet…"** — but saving a draft never touches the wallet. At the one moment a user is primed to look at their wallet for a signature, the app tells them to, and nothing appears. Erodes trust in exactly the wrong place.

---

## P1 — Serious

### P1-1 · Double-click creates a duplicate distribution

`create-flow.tsx` · `api/distributions/route.ts`

After the first save, `savedId` is set but the review's confirm button becomes **enabled again** (`canConfirm` is true once `isConfirming` clears). Given P0-1's confusion ("did that send?"), a second click is likely — and it `POST`s a **second draft**. The MVP create route has no idempotency key (the `salt` guard is a Tier-2 escrow concept), so you get two identical distributions. On a slow RPC, Monad's ~400ms blocks make the impatient re-click more likely, not less.

### P1-2 · The send wall appears only after all the work is done

`execute-panel.tsx` · `config/contracts.ts`

On a production (mainnet-only) build the contract is unwired, so `ExecutePanel` renders "Distro isn't deployed on this network yet." But that only shows **after** the user has named the distribution, imported hundreds of recipients, reviewed, and saved. The dead-end should be surfaced at the top of the flow (or the landing), not at the finish line.

### P1-3 · No "install a wallet" state

`connect-wallet-button.tsx` · `use-auth.ts`

A first-timer with no wallet extension clicks "Connect Wallet" → `connectAsync({ injected() })` throws → they see a raw error string. UX_SPEC S1 specified a real "no Ethereum wallet detected — install one" state; it isn't implemented. This is quite literally the first interaction a new user has.

---

## P2 — Medium

### P2-1 · The only working network has the roughest token step

`registry.ts` · `token-selector.tsx`

`getSupportedTokens` returns `[]` off mainnet (correct — testnet token addresses are unrelated and shipping an unverified list is forbidden). But that means on **staging/testnet — the one place the flow completes** — the token step shows no quick-pick list, only a paste-an-address box, with no hint explaining why or what to paste. The happy path has the least guidance.

### P2-2 · Review's transaction count can disagree with what actually happens

`distribution-review.tsx` (batches via `CONSERVATIVE_GAS_PER_RECIPIENT`) vs `execute-panel.tsx` (`batchSize = 150` hardcoded)

Review computes batch count from a gas estimate; execution uses a fixed 150-per-batch. For the same list these can yield different batch counts, so the review can promise "2 transactions to sign" and the wallet then asks for a different number. Any mismatch in a money flow reads as a bug.

### P2-3 · Table-header tone is inconsistent across the app

`distribution-review.tsx` + its recipient-preview use `bg-muted`; dashboard and detail tables use `bg-surface`

Same component type, two different recessed tones. DESIGN.md specifies `surface` for table headers. The review/preview tables predate that and were missed.

### P2-4 · "Open the dashboard" bounces a signed-out user back to the landing

`(marketing)/page.tsx` · `middleware.ts`

The hero's secondary CTA links to `/dashboard`. Clicked while signed out, middleware redirects to `/?redirect=/dashboard`, landing the user back on the same page with a small notice. A prominent CTA that returns you to where you were is disorienting on a first visit. Consider making it trigger connect directly, or hiding it until authenticated.

### P2-5 · Gas cost is half-populated in review

`create-flow.tsx` doesn't pass `gasPriceWei` to `DistributionReview`

So the estimate shows a gas _limit_ and a transaction count but no MON figure. Not wrong (it degrades gracefully), but an incomplete number on the money screen invites doubt. Either fetch the gas price or drop the gas line entirely rather than show half of it.

---

## P3 — Polish

### P3-1 · Post-connect "now what"

After connecting on the landing (no `redirect` param), the user stays on the marketing page; only the hero link points onward. A returning user re-lands on marketing rather than their dashboard. Consider forwarding an authenticated visitor to `/dashboard`, or making the header address chip a link there.

### P3-2 · Retry has no acknowledgement either

`retry-panel.tsx` — consistent with the send lacking one (same root as P0-2). Whatever gate the send gets, retry should get the scoped version ("Retry N recipients · X USDC · irreversible").

### P3-3 · Dead fallback copy

`distribution-review.tsx` renders "Untitled distribution" when `name` is empty — but the flow requires a name to reach review, so it can't trigger. Harmless, but it implies a state that doesn't exist.

---

## Cross-cutting note: the dashboard review

The second task ("review the dashboard UI, make it production-ready") was completed the prior commit (`2a7a88d`): unified stat strip, `surface` table header, warning-not-destructive counters, responsive column collapse, clickable rows. This walkthrough confirms the **dashboard itself** is now consistent — the `bg-muted`-vs-`surface` inconsistency (P2-3) lives in the _review/preview_ tables, which that pass didn't touch.

---

## Recommended order of attack

1. **P0-1 + P0-2 + P0-3 together** — they're one fix. Collapse save-and-send into a single acknowledged action so "Distribute" means distribute, the irreversibility gate sits on the money-moving step, and "Check your wallet…" only shows when the wallet is actually involved. This is the single highest-value change in the app right now.
2. **P1-1** — falls out of the above (one button can't be double-clicked into two drafts), plus add an API idempotency key as defence in depth.
3. **P1-3, P2-1** — the first and (on staging) roughest interactions a new user hits.
4. The rest as polish.
