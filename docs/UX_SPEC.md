# UX Specification — Distro MVP

Every journey, screen, interaction, modal, and state for the `Multisend` MVP. No visual design here — this maps *what exists and how it behaves*. Visual system lives in [DESIGN.md](../DESIGN.md); strategic principles in [PRODUCT.md](../PRODUCT.md).

Scope is the MVP: connect → create → import → validate → review → approve → distribute → track. Scheduling, escrow, and notifications are out (Tier 2).

## Principles that shape every state below

1. **Money-states are designed, never a toast.** Funding, execution, failure, and confirmation get first-class inline UI. Toasts are only for the reversible and the trivial ("Copied", "Draft saved").
2. **Name the risk plainly.** A push distribution is irreversible; the review step says so in those words, not "please confirm."
3. **Tell the truth about state, including lag.** "Signed", "submitted", "mining", and "confirmed" are different moments and the UI distinguishes them — a user who thinks a mining tx failed will double-send.
4. **Failure is expected, not exceptional.** One blocklisted recipient in a payroll is normal; the UI treats partial failure as a routine outcome with a routine remedy (retry), not an error screen.

---

## 1. Journey map (the whole MVP)

```
                    ┌─────────────┐
 first visit ──────▶│  Landing    │
                    └──────┬──────┘
                     connect + SIWE
                           ▼
              ┌────────────────────────┐   empty ──▶ create-first CTA
   returning ▶│   Dashboard (list)     │
              └───────────┬────────────┘◀──────────────┐
                    "New distribution"                  │
                          ▼                             │
      ┌───────────────────────────────────────┐        │
      │  Create flow (4 steps + execute)       │        │
      │  1 Details → 2 Import → 3 Validate →    │        │
      │  4 Review → Approve → Distribute        │        │
      └───────────────────┬───────────────────┘        │
                     receipt parsed                     │
                          ▼                             │
              ┌────────────────────────┐   retry failed │
              │  Distribution detail   │────────────────┘
              │  (results + retry)     │
              └────────────────────────┘
```

**Named journeys** (each detailed in §4):

| # | Journey | Entry | Success exit |
|---|---|---|---|
| J1 | First-time: sign in → first distribution | Landing | Results shown |
| J2 | Returning: review past distributions | Dashboard | Detail viewed |
| J3 | Create & execute now | "New distribution" | All recipients paid |
| J4 | Partial failure → retry | Detail (partial) | Failures resolved |
| J5 | Test payment before the real run | Review step | 1 recipient confirmed |
| J6 | Abandon / resume a draft | Any create step | Draft saved or discarded |
| J7 | Disconnect / sign out | Header | Landing |

---

## 2. Screen inventory

| # | Screen / surface | Route | Auth |
|---|---|---|---|
| S1 | Landing (sign-in) | `/` | public |
| S2 | Dashboard — distribution list | `/dashboard` | required |
| S3 | Create · Step 1 · Details | `/dashboard/new` | required |
| S4 | Create · Step 2 · Import recipients | `/dashboard/new` (step) | required |
| S5 | Create · Step 3 · Validation | `/dashboard/new` (step) | required |
| S6 | Create · Step 4 · Review | `/dashboard/new` (step) | required |
| S7 | Execution — approve + distribute | `/dashboard/new` (step) | required |
| S8 | Distribution detail — results + retry | `/dashboard/[id]` | required |

The create flow is one route with client-driven steps, so a wallet round-trip never loses progress. Persistent chrome (S0) — header with wallet/network control — is on every authenticated screen.

---

## 3. Global elements

### S0 — Header (all authenticated screens)
- **Left:** Distro wordmark → dashboard.
- **Right:** wallet control (the `ConnectWalletButton`). Its own state machine: `Loading → [Connect Wallet] → [Check your wallet…] → [0x1234…abcd · Disconnect]`.
- **Network indicator:** persistent, unmissable. Correct network = quiet. Wrong network = a loud, blocking banner (see E-NET), because a wrong-network action with real funds must be hard to do by accident.

### Toast vs. inline (global rule)
- **Inline, designed:** anything touching funds or irreversibility.
- **Toast:** "Copied address", "Draft saved", "CSV downloaded" — reversible, trivial.

### Global error surfaces
- **Session expired mid-flow** → non-destructive modal: "Your session expired. Reconnect to continue — your draft is safe." Re-auth returns to the exact step.
- **RPC unreachable** → inline banner on any screen doing chain reads: "Can't reach Monad right now. Retrying…" with a manual retry.

---

## 4. Screen-by-screen: states & interactions

Each screen lists its **states** (empty / loading / error / success as applicable), **interactions**, and **modals**.

### S1 — Landing / sign-in

Purpose: explain Distro in one line and get the user authenticated. Also the redirect target for any protected route hit while signed out.

| State | Design |
|---|---|
| **Default** | Value prop, single primary action (wallet control in header + a hero CTA). "Monad Mainnet only" stated. |
| **Redirected here** (from a protected route) | Inline notice: "Connect your wallet to continue to `/dashboard`." Forwards automatically once authenticated. |
| **Connecting** (wallet popup open) | CTA → "Check your wallet…", disabled, spinner. |
| **Signing** (SIWE message) | Same treatment; copy hints the signature is gasless and authorizes nothing. |
| **Error — no wallet installed** | Inline: "No Ethereum wallet detected." + link to install, not a dead button. |
| **Error — user rejected** | Inline under the CTA, calm: "Sign-in cancelled. Try again when ready." No red alarm — rejection is a choice, not a fault. |
| **Error — wrong network at sign-in** | Prompt to switch; the switch is one click (wallet `switchChain`). |
| **Success** | Redirect to `/dashboard` (or the original target). |

Interactions: connect, sign, switch network. Modals: none (all inline — this is the trust-establishing screen).

### S2 — Dashboard (distribution list)

Purpose: the home base — see past distributions, start a new one.

| State | Design |
|---|---|
| **Loading** | Skeleton rows (not a spinner) — the shape of the list, so the layout doesn't jump. |
| **Empty** (no distributions ever) | Purposeful empty state: one-line explanation of what a distribution is, a prominent **New distribution** CTA, and a link to a CSV template. Not an apologetic "nothing here". |
| **Populated** | Table/list: name, token, recipient count, total, status chip, date. Row → detail. Sortable by date/status; searchable by name/token once the list grows. Server-side pagination from the start. |
| **Error** (list failed to load) | Inline panel with the reason + retry. Never a blank page. |
| **Row status chips** | `Draft` (neutral), `Completed` (calm positive), `Partial — n failed` (attention, not alarm), `Failed` (clear but not catastrophic). |

Interactions: new distribution; open row; resume draft; sort/search; delete draft (→ M-DELDRAFT).
Modals: **M-DELDRAFT** — "Discard this draft? Recipients you imported will be lost." (only for drafts; a submitted distribution is history and can't be deleted).

### S3 — Create · Step 1 · Details

Purpose: name the distribution and choose the token.

| State | Design |
|---|---|
| **Default** | Name field; token selector (paste an address or pick from tokens the wallet holds). |
| **Token loading** | Resolving symbol/decimals/balance from chain — inline "Reading token…". |
| **Token resolved** | Show symbol, decimals, and the connected wallet's balance — so the user sees what they're working with before importing amounts. |
| **Error — not a token** | "That address isn't an ERC-20 on Monad." Inline, blocks Next. |
| **Error — unsupported token** | If detectable (fee-on-transfer/rebasing heuristics): "This token isn't supported — its transfers don't move exact amounts." Explains, doesn't just reject. |
| **Success** | Next enables. |

Interactions: enter name, resolve token, next. Autosaves a draft on leave.

### S4 — Create · Step 2 · Import recipients

Purpose: get the recipient list in and turn it into structured rows.

| State | Design |
|---|---|
| **Empty / default** | Drop zone + paste area. **Download CSV template** link and the exact expected format (`address,amount`, human units) shown up front — never assume the user knows it. |
| **Parsing** | "Reading 1,240 rows…" progress for large files; the UI stays responsive. |
| **Parsed** | Preview table (virtualized for large lists): address, amount, and a per-row status once validation runs. Row count and running total surfaced. |
| **Error — unreadable file** | "Couldn't read that file. Expected CSV with `address,amount`." + template link. |
| **Error — empty file** | "That file has no rows." |
| **Success** | Advances to validation (S5), or validates inline within this screen. |

Interactions: upload, paste, download template, edit/remove a row, clear all.
Modals: **M-CLEAR** — "Remove all imported recipients?" (destructive within the flow).

### S5 — Create · Step 3 · Validation

Purpose: surface every problem *before* money is committed. The most safety-critical screen.

| State | Design |
|---|---|
| **Validating** | Progress if large; per-row checks (address validity, amount > 0, `uint128` cap, duplicates, total vs. balance). |
| **All clear** | Green summary: "1,240 recipients · 48,300.00 USDC · covered by your balance." Next enabled. |
| **Warnings only** (non-blocking) | Duplicates called out ("3 addresses appear twice — intentional? They'll be paid each time.") with keep/merge. Warnings never block; they inform. |
| **Errors** (blocking) | Grouped by type with counts: "4 invalid addresses · 1 zero amount · 2 over the max". Each expandable to the offending rows, each row fixable inline or removable. Next stays disabled until clear. |
| **Error — insufficient balance** | Distinct, prominent: "You need 48,300 USDC; your balance is 40,000." Shows the shortfall. Blocks. |

Interactions: fix a row, remove a row, re-validate, resolve duplicates. Everything editable here so the user never has to go back to re-import.

### S6 — Create · Step 4 · Review (the irreversibility moment)

Purpose: the single deliberate pause before real money moves.

| State | Design |
|---|---|
| **Default** | Full committed summary: recipient count; total in **both** human and base units + symbol; token; the executing `Multisend` address; number of transactions this will take (batching) and estimated gas. |
| **The irreversibility statement** | Plain language, not fine print: "Distributing is irreversible. Tokens sent to a wrong address cannot be recovered." A deliberate confirmation control (checkbox or hold-to-confirm), not a soft "Confirm". |
| **Test-payment offer (J5)** | "Send a test payment to one recipient first?" — inline option, because rehearsing an irreversible action is the universal instinct. Leads to a one-recipient execution, then back here. |
| **Error — balance changed** | If balance dropped since S5: re-block with the new shortfall before the wallet does. |

Interactions: confirm intent, start test payment, back to any prior step (non-destructive), begin execution.
Modals: none — the confirmation is inline and weighty by design; a modal would make it feel lighter, not heavier.

### S7 — Execution (approve + distribute)

Purpose: walk the user through the wallet transactions and show honest progress. The core money-state screen.

Two phases, each a distinct designed state:

**Phase A — Approve**
| State | Design |
|---|---|
| **Prompt** | "Approve Distro to send {token}" with the exact amount. Explains approval ≠ transfer. |
| **In wallet** | "Confirm the approval in your wallet…" |
| **Rejected** | Calm inline: "Approval cancelled." + retry. Nothing lost. |
| **Confirmed** | Advances to Phase B automatically. |

**Phase B — Distribute** (one or more transactions)
| State | Design |
|---|---|
| **Ready** | "Send to 1,240 recipients across 3 transactions." Start. |
| **Signing** | "Confirm transaction 1 of 3 in your wallet…" |
| **Submitted / mining** | **Explicit distinction** — "Transaction 1 submitted. Waiting for confirmation…" with the tx hash + explorer link. Never implies done. |
| **Batch confirmed** | Live tally updates: "412 paid · 0 failed · 828 remaining." |
| **Between batches** | Auto-prompts the next; a stall never looks like completion. |
| **Rejected mid-run** | "You cancelled transaction 2. Recipients in batches 2–3 haven't been paid." Clear on exactly who is and isn't paid; resume or stop. |
| **RPC timeout / stuck tx** | "Transaction 2 is taking longer than expected." Offers the explorer link and a wait/retry — never a silent hang. |
| **All confirmed** | → Results (S8) with a success summary. |

The result set is parsed from the transaction receipts (no indexer) as each batch confirms — so results are truthful the instant a batch lands.

### S8 — Distribution detail (results + retry)

Purpose: the record of what happened, and the remedy for what didn't.

| State | Design |
|---|---|
| **Loading** | Skeleton of the summary + table. |
| **Success — all paid** | Calm positive summary: "1,240 recipients paid · 48,300 USDC." Per-recipient table (paid, tx link each), export CSV, done. |
| **Partial** (the expected-failure case) | Summary leads with the remedy, not the alarm: "1,236 paid · 4 failed." A prominent **Retry 4 failed** action. Failed rows grouped, each with a reason where recoverable ("recipient blocked by token", "insufficient gas") and the honest distinction between "the token rejected this" and "Distro failed". |
| **All failed** | "No payments went through." Most likely a systemic cause (wrong token state, approval revoked) — explain the probable reason, offer retry-all. |
| **Empty (a draft opened)** | If the row is still a draft, this screen redirects into the create flow at the right step rather than showing an empty result. |

Interactions: retry failed (→ a scoped re-run through S6/S7 with only the failed subset), export CSV, copy any tx hash, open in explorer.
Modals: **M-RETRY-CONFIRM** — same irreversibility weight as S6, scoped to the failed subset: "Retry payment to 4 recipients · 1,200 USDC. Irreversible."

---

## 5. Modal inventory

| ID | Modal | Trigger | Nature |
|---|---|---|---|
| M-NET | Wrong network | Non-mainnet detected | Blocking; one-click switch |
| M-DISCONNECT | Confirm disconnect | Disconnect while a draft is unsaved-in-progress | Confirm; skip if nothing at risk |
| M-DELDRAFT | Discard draft | Delete a draft | Destructive confirm |
| M-CLEAR | Clear recipients | Remove-all in import | Destructive confirm |
| M-DUPES | Resolve duplicates | Duplicates found | Informational choice (keep/merge) |
| M-TEMPLATE | CSV format help | "How should my file look?" | Informational; shows format + template download |
| M-RETRY-CONFIRM | Confirm retry | Retry failed | Irreversibility confirm, scoped |
| M-SESSION | Session expired | JWT expired mid-flow | Non-destructive re-auth; draft preserved |

Deliberately **not** modals: the review/confirm step (S6) and execution (S7). Money-weight moments are full screens, because a modal signals "quick and dismissible" — the opposite of what these are.

---

## 6. State taxonomy (cross-cutting reference)

Every screen resolves against this. If a screen can enter a state, it has a designed treatment above.

| Class | States enumerated |
|---|---|
| **Empty** | no distributions (S2); no recipients imported (S4); a draft with no token yet (S3). Each is purposeful, with the next action — never an apology. |
| **Loading** | session hydrating (S0); list loading (S2, skeleton); token resolving (S3); CSV parsing (S4); validating (S5); tx signing/mining (S7); detail loading (S8). Skeletons for layout; spinners only for indeterminate wallet waits. |
| **Error — user** | wallet rejection (S1, S7); wrong network (M-NET); insufficient balance (S5, S6); invalid CSV (S4); invalid rows (S5). Calm, specific, fixable inline. |
| **Error — system** | RPC unreachable (global); stuck/timed-out tx (S7); list load failure (S2); session expired (M-SESSION). Never blank; always a retry. |
| **Success** | signed in (S1); draft saved (toast); validation clear (S5); approval confirmed (S7A); all paid (S7B, S8). Proportionate — a big calm confirmation for a completed distribution, a quiet toast for a saved draft. |
| **Partial** | the signature Distro state (S8): some paid, some failed. Treated as a routine outcome with a routine remedy, never as an error screen. |

---

## 7. Interaction principles carried throughout

- **Never lose a draft.** Every step autosaves; wallet round-trips, session expiry, and back-navigation all preserve it.
- **Back is always safe.** Moving backward in the create flow never discards work; only explicit destructive actions (M-CLEAR, M-DELDRAFT) do, and they confirm.
- **The wallet is the source of truth for connection; the server session for auth.** The UI never shows "signed in" on a bare wallet connection.
- **Every onchain thing is one click from its explorer.** "Verifiable onchain" is a link, not a claim.
- **Optimistic UI respects confirmation depth.** A submitted tx shows as *submitted*, not done, until it's mined — the difference is always visible.

---

## Deferred to Tier 2 (noted so the map is honest)

Scheduling UI (date/time, local+UTC), the **unfunded-and-scheduled** warning state (the sharpest edge in the escrow model — a silent no-op the UI must make impossible to miss), cancel/reclaim flows, notifications, and the indexer-lag "syncing" state. None apply to the MVP, where the creator is present and the receipt tells the whole story.
