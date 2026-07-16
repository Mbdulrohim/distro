# Wireframes — Distro

Low-fidelity ASCII wireframes for every page. **Structure and UX only** — no color, type, or spacing decisions (those live in [DESIGN.md](../DESIGN.md); flows and states in [UX_SPEC.md](UX_SPEC.md)).

**Scope tags:** `[MVP]` ships with the Multisend release · `[MVP+]` small addition, low cost · `[Tier 2]` needs escrow/scheduling or is a later convenience.

Overlap resolved up front: **Dashboard** is the working surface (recent + act now); **History** is the full searchable archive; **Receipts** is the proof/export layer over any completed distribution. They share the distribution row but answer different questions.

Legend: `[ Button ]` · `( ) / (•)` radio · `[ ]/[x]` checkbox · `▸` expandable · `▾` dropdown · `≡` menu · `···` overflow · `▓▓` skeleton/loading.

---

## 1. Landing `[MVP]`

Unauthenticated. One job: explain Distro in a line and get the wallet connected. Also the redirect target for any protected route hit while signed out.

```
+──────────────────────────────────────────────────────────────────+
|  Distro                                        [ Connect Wallet ] |
+──────────────────────────────────────────────────────────────────+
|                                                                    |
|                                                                    |
|        Pay many wallets at once. On Monad.                         |
|                                                                    |
|        Payroll, rewards, grants, and payouts —                     |
|        one workflow instead of a hundred transactions.             |
|                                                                    |
|        [ Connect Wallet ]     Monad Mainnet only                   |
|                                                                    |
|                                                                    |
+────────────────────────────────────────────────────────────────── +
|   How it works                                                     |
|                                                                    |
|   1  Import          2  Review           3  Distribute            |
|   Upload a CSV of    Check every         Approve once —           |
|   addresses and      address and the     Distro sends to          |
|   amounts.           total, once.        everyone, tracked.       |
|                                                                    |
+──────────────────────────────────────────────────────────────────+
|   Verifiable onchain · Non-custodial · Distro never holds keys    |
|   [ Read the security model → ]                                    |
+──────────────────────────────────────────────────────────────────+
|   Docs   ·   GitHub   ·   Contract on explorer                    |
+──────────────────────────────────────────────────────────────────+
```

**Redirected-here state** (hit `/dashboard` while signed out): a slim notice sits above the hero — `Connect your wallet to continue to /dashboard` — and the page forwards automatically once authenticated.

**Connect states** (inline on the button, never a modal): `Connect Wallet` → `Check your wallet…` (signing SIWE) → success redirect. Rejection → calm inline line under the button. No-wallet-installed → install link, not a dead button.

**UX intent:** a single primary action repeated (header + hero). No pricing, no feature grid, no marketing scroll — this is infrastructure, and the fastest path is in.

---

## 2. Dashboard `[MVP]`

The working home: what's recent, what needs attention, and the way to start.

```
+──────────────────────────────────────────────────────────────────+
|  Distro     Dashboard  History  Templates          0x12…ab  ▾     |
+──────────────────────────────────────────────────────────────────+
|                                                                    |
|   Distributions                          [ + New distribution ]   |
|                                                                    |
|   ┌ Needs attention ───────────────────────────────────────────┐  |
|   │ ▲ March Payroll — 4 of 240 payments failed                 │  |
|   │   [ Review & retry → ]                                     │  |
|   └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|   Recent                                     Search [__________]  |
|   +──────────────────────────────────────────────────────────── + |
|   | Name            Token   Recipients  Total     Status  Date  | |
|   +──────────────────────────────────────────────────────────── + |
|   | March Payroll   USDC        240   48,300   ▲ Partial  Mar 1 | |
|   | Q1 Grants       USDC         12   25,000   ✓ Done     Feb 20| |
|   | Contributor …   MON         318    9,540   ✓ Done     Feb 14| |
|   | Airdrop test    DTO           5       50   ✓ Done     Feb 10| |
|   | Draft — unti…   —             —        —   • Draft     —     | |
|   +──────────────────────────────────────────────────────────── + |
|                                    [ View all in History → ]      |
+──────────────────────────────────────────────────────────────────+
```

- **Empty state** (first run): no table. A centered block — "Create your first distribution. Import a CSV of addresses and amounts, and pay them all at once." — a prominent `[ + New distribution ]`, and a `Download CSV template` link. Teaches, doesn't apologize.
- **Loading:** skeleton rows in the table shape, not a spinner.
- **Needs-attention band** only renders when a distribution has unresolved failures or an unfinished draft; otherwise the page opens straight into Recent.
- **Row → Distribution Details.** A `Draft` row → resumes the Create flow at its last step. `···` per row: Duplicate, Save as template, Delete draft.

---

## 3. Create Distribution `[MVP]`

One route, client-driven steps, persistent progress rail — a wallet round-trip never loses work. Steps 1→4 then Execute.

### Step rail (persistent across all steps)
```
   ( • Details )──( 2 Import )──( 3 Review )──( 4 Send )
```

### Step 1 · Details
```
+──────────────────────────────────────────────────────────────────+
|  ← Back to dashboard                          Draft saved ✓        |
|                                                                    |
|  New distribution                                                  |
|  ( • Details )──( 2 Import )──( 3 Review )──( 4 Send )             |
|                                                                    |
|  Name                                                              |
|  [ March Payroll___________________________ ]                     |
|                                                                    |
|  Token                                                             |
|  [ 0xA0b8…c2d5________________________ ] [ Paste ]  ▾ my tokens    |
|  ┌────────────────────────────────────────────────────────────┐  |
|  │ ✓ USDC · 6 decimals · Your balance: 82,140.00              │  |
|  └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|                                        [ Continue → ]  (disabled   |
|                                         until token resolves)      |
+──────────────────────────────────────────────────────────────────+
```
States: token *resolving* ("Reading token…"), *resolved* (symbol/decimals/balance shown), *not an ERC-20* (inline error, blocks), *unsupported* (fee-on-transfer/rebasing → explains, blocks).

### Step 2 · Import recipients
```
+──────────────────────────────────────────────────────────────────+
|  New distribution                    Draft saved ✓                 |
|  ( ✓ Details )──( • Import )──( 3 Review )──( 4 Send )             |
|                                                                    |
|  ┌────────────────────────────────────────────────────────────┐  |
|  │        Drop a CSV here, or [ Choose file ]                 │  |
|  │        Format: address,amount   [ Download template ]     │  |
|  │        …or [ Paste a list ]                               │  |
|  └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|  Preview                              240 rows · 48,300.00 USDC    |
|  +──────────────────────────────────────────────────────────── + |
|  | #   Address              Amount        Status               | |
|  +──────────────────────────────────────────────────────────── + |
|  | 1   0x1a2b…9f3c          200.00        ✓                    | |
|  | 2   0x4d5e…7a1b          200.00        ✓                    | |
|  | 3   0x9999…0000          200.00        ✗ invalid address    | |
|  | …   (virtualized)                                          | |
|  +──────────────────────────────────────────────────────────── + |
|  [ Clear all ]                              [ Continue → ]         |
+──────────────────────────────────────────────────────────────────+
```
States: *parsing* (progress for big files), *unreadable/empty* (inline error + template link). Rows editable/removable inline. `[ Continue ]` disabled while blocking errors exist.

### Step 3 · Review (validation + the irreversibility moment)
```
+──────────────────────────────────────────────────────────────────+
|  New distribution                                                  |
|  ( ✓ Details )──( ✓ Import )──( • Review )──( 4 Send )            |
|                                                                    |
|  ┌ Validation ───────────────────────────────────────────────┐   |
|  │ ✓ 236 valid   ✗ 4 errors                                  │   |
|  │   ▸ 3 invalid addresses                                    │   |
|  │   ▸ 1 amount over the maximum                              │   |
|  │   (each expands to the rows · fix or remove inline)       │   |
|  │ ⚠ 2 duplicate addresses — they'll be paid each time. Keep?│   |
|  └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|  ┌ Summary ──────────────────────────────────────────────────┐    |
|  │ Recipients   240                                          │    |
|  │ Total        48,300.00 USDC   (48,300,000,000 base units) │    |
|  │ Token        USDC · 0xA0b8…c2d5                           │    |
|  │ Sends in     2 transactions   · est. gas ~0.0x MON        │    |
|  │ Your balance 82,140.00 USDC  ✓ covers it                  │    |
|  └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|  ⚠ Distributing is irreversible. Tokens sent to a wrong           |
|     address cannot be recovered.                                   |
|  [ ] I've reviewed the recipients and amounts.                    |
|                                                                    |
|  [ Send a $1 test first ]              [ Continue to send → ]      |
+──────────────────────────────────────────────────────────────────+
```
`[ Continue ]` stays disabled until errors are clear **and** the checkbox is ticked. Errors block; warnings (duplicates) inform. Insufficient balance → its own prominent blocking row with the shortfall.

### Step 4 · Send (execution)
```
+──────────────────────────────────────────────────────────────────+
|  Sending March Payroll                                             |
|  ( ✓ Details )──( ✓ Import )──( ✓ Review )──( • Send )            |
|                                                                    |
|  Step 1 · Approve                                                  |
|  ┌────────────────────────────────────────────────────────────┐  |
|  │ ✓ Approved Distro to send 48,300 USDC                     │  |
|  └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|  Step 2 · Distribute                                               |
|  ┌────────────────────────────────────────────────────────────┐  |
|  │ Transaction 1 of 2   ✓ confirmed   0xabc…123  [explorer ↗]│  |
|  │ Transaction 2 of 2   ⏳ submitted, waiting…   0xdef…456    │  |
|  │                                                            │  |
|  │   412 paid   ·   0 failed   ·   828 remaining             │  |
|  └────────────────────────────────────────────────────────────┘  |
|                                                                    |
|  Keep this tab open until all transactions confirm.               |
+──────────────────────────────────────────────────────────────────+
```
`submitted` and `confirmed` are always visually distinct — a mining tx never reads as done. Wallet rejection mid-run → clear statement of who is/isn't paid + resume/stop. On all-confirmed → Distribution Details.

---

## 4. Distribution Details `[MVP]`

The record of what happened and the remedy for what didn't.

```
+──────────────────────────────────────────────────────────────────+
|  ← Distributions                                          ···      |
|                                                                    |
|  March Payroll                              ▲ Partial · 4 failed   |
|  USDC · Mar 1, 2026 · 0x12…ab (you)                                |
|                                                                    |
|  +──────────+──────────+──────────+──────────────────────────+    |
|  | Paid     | Failed   | Total    | Transactions             |    |
|  | 236      | 4        | 48,300   | 2  [view on explorer ↗]  |    |
|  +──────────+──────────+──────────+──────────────────────────+    |
|                                                                    |
|  ┌ 4 payments failed ───────────────────────────────────────┐     |
|  │ These weren't sent. Their tokens are still in your wallet.│     |
|  │                              [ Retry 4 failed → ]         │     |
|  └────────────────────────────────────────────────────────────┘   |
|                                                                    |
|  Recipients                 [All ▾] [Failed only] Search[______]  |
|  +──────────────────────────────────────────────────────────── + |
|  | Address           Amount    Status     Tx                   | |
|  +──────────────────────────────────────────────────────────── + |
|  | 0x1a2b…9f3c       200.00    ✓ Paid     0xabc…123 ↗          | |
|  | 0x4d5e…7a1b       200.00    ✓ Paid     0xabc…123 ↗          | |
|  | 0x8c7d…2e1f       200.00    ✗ Failed   recipient blocked    | |
|  | …                                                          | |
|  +──────────────────────────────────────────────────────────── + |
|                                                                    |
|  [ Export CSV ]   [ Download receipt ]   [ Duplicate ]            |
+──────────────────────────────────────────────────────────────────+
```

- **All-paid state:** the failed band disappears; header reads `✓ Completed`; summary leads with a calm success line.
- **All-failed state:** band explains the likely systemic cause (approval revoked, token paused) + `Retry all`.
- **Failed rows** show the honest reason and distinguish "recipient rejected" from "Distro failed."
- **`···`** overflow: Save as template, Rename, Delete.
- **Retry** routes back through a scoped Review→Send with only the failed subset (same irreversibility gate).

---

## 5. History `[MVP+]`

The full archive — every distribution ever, searchable and filterable. Dashboard shows the recent slice; this is the system of record.

```
+──────────────────────────────────────────────────────────────────+
|  Distro     Dashboard  History  Templates          0x12…ab  ▾     |
+──────────────────────────────────────────────────────────────────+
|  History                                                           |
|                                                                    |
|  Search [___________]  Token [All ▾]  Status [All ▾]  [ ⇩ Export ]|
|  Date  [ From ▾ ] [ To ▾ ]                                         |
|                                                                    |
|  +──────────────────────────────────────────────────────────── + |
|  | Name          Token  Recip.  Total    Status    Date    ▾   | |
|  +──────────────────────────────────────────────────────────── + |
|  | March Payroll USDC     240  48,300  ▲ Partial   Mar 1       | |
|  | Q1 Grants     USDC      12  25,000  ✓ Done      Feb 20      | |
|  | Contributor…  MON      318   9,540  ✓ Done      Feb 14      | |
|  | Airdrop test  DTO        5      50  ✓ Done      Feb 10      | |
|  | Jan Payroll   USDC     238  47,600  ✓ Done      Jan 1       | |
|  +──────────────────────────────────────────────────────────── + |
|  Showing 5 of 42                       ‹ Prev   Page 1   Next ›   |
+──────────────────────────────────────────────────────────────────+
```

- Sortable columns; server-side pagination. Same row → Distribution Details.
- **Export** here = the whole filtered set as CSV (accounting/reconciliation), distinct from a single distribution's receipt.
- **Empty (filtered):** "No distributions match these filters. [ Clear filters ]" — never a blank page.

---

## 6. Templates `[Tier 2]`

Reusable recipient lists — the honest, low-risk form of "recurring" (monthly payroll = re-run a template). A template stores names/addresses/amounts; the token and the actual send always go through the full Review→Send gate, so a template can never auto-pay anyone.

```
+──────────────────────────────────────────────────────────────────+
|  Templates                                   [ + New template ]   |
|                                                                    |
|  +──────────────────────────────────────────────────────────── + |
|  | Name              Recipients   Last used     ···            | |
|  +──────────────────────────────────────────────────────────── + |
|  | Monthly Payroll        240     Mar 1     [ Use → ]  ···     | |
|  | Core Contributors       18     Feb 14    [ Use → ]  ···     | |
|  | Grant Cohort Q1         12     Feb 20    [ Use → ]  ···     | |
|  +──────────────────────────────────────────────────────────── + |
+──────────────────────────────────────────────────────────────────+
```
**Edit / create a template**
```
+──────────────────────────────────────────────────────────────────+
|  ← Templates                                                       |
|  Monthly Payroll                                    [ Save ]       |
|                                                                    |
|  Recipients (240)          [ + Add row ] [ Import CSV ] [ Export ] |
|  +──────────────────────────────────────────────────────────── + |
|  | Label (optional)   Address           Amount        ✎  🗑     | |
|  | Alice — eng        0x1a2b…9f3c        200.00        ✎  🗑     | |
|  | Bob — design       0x4d5e…7a1b        200.00        ✎  🗑     | |
|  | …                                                          | |
|  +──────────────────────────────────────────────────────────── + |
+──────────────────────────────────────────────────────────────────+
```
- `[ Use → ]` seeds a new Create-Distribution at Step 2 with the list pre-filled — the user still picks the token, reviews, and signs.
- **Empty:** "Save any distribution as a template to reuse its recipients." + pointer to the `···` action on a distribution.
- `···`: Rename, Duplicate, Delete.

---

## 7. Settings `[MVP+]`

Thin by design — a non-custodial tool has little to configure.

```
+──────────────────────────────────────────────────────────────────+
|  Settings                                                          |
|                                                                    |
|  Account                                                           |
|  +──────────────────────────────────────────────────────────── + |
|  | Wallet     0x12…ab            [ Copy ]  [ Disconnect ]       | |
|  | Network    Monad Mainnet (143)          ✓ connected         | |
|  +──────────────────────────────────────────────────────────── + |
|                                                                    |
|  Preferences                                                       |
|  +──────────────────────────────────────────────────────────── + |
|  | Theme            ( ) Light   ( ) Dark   (•) System           | |
|  | Amount display   (•) Human (200.00)   ( ) Base units         | |
|  | Explorer         [ MonadVision ▾ ]                           | |
|  +──────────────────────────────────────────────────────────── + |
|                                                                    |
|  Notifications  [Tier 2]                                           |
|  +──────────────────────────────────────────────────────────── + |
|  | Email me when a distribution completes or fails             | |
|  | [ your@email____________ ]   [ Save ]   (off in MVP)        | |
|  +──────────────────────────────────────────────────────────── + |
|                                                                    |
|  Data                                                              |
|  | [ Export all history (CSV) ]                                   |
+──────────────────────────────────────────────────────────────────+
```
No password, no billing (MVP), no API keys. Wrong-network here mirrors the global banner with a one-click switch.

---

## 8. Receipts `[MVP+]`

Proof-of-distribution: a clean, exportable record per distribution for the creator's own accounting/audit — every payment with its onchain transaction. Not a new data source; a formatted view over a completed distribution.

**Receipts index**
```
+──────────────────────────────────────────────────────────────────+
|  Receipts                                      [ ⇩ Export all ]   |
|                                                                    |
|  +──────────────────────────────────────────────────────────── + |
|  | Distribution    Date    Paid/Total   Amount    Receipt      | |
|  +──────────────────────────────────────────────────────────── + |
|  | March Payroll   Mar 1   236/240      48,100    [ View ][PDF]| |
|  | Q1 Grants       Feb 20   12/12       25,000    [ View ][PDF]| |
|  | Contributor…    Feb 14  318/318       9,540    [ View ][PDF]| |
|  +──────────────────────────────────────────────────────────── + |
+──────────────────────────────────────────────────────────────────+
```
**Single receipt**
```
+──────────────────────────────────────────────────────────────────+
|  ← Receipts                          [ ⇩ CSV ]  [ ⇩ PDF ]  [Print]|
|                                                                    |
|   RECEIPT — March Payroll                                          |
|   Distro · Onchain distribution                                    |
|  ────────────────────────────────────────────────────────────────|
|   From        0x12…ab                                              |
|   Token       USDC · 0xA0b8…c2d5                                   |
|   Date        Mar 1, 2026  14:32 UTC                               |
|   Recipients  240   ·   Paid 236   ·   Failed 4                    |
|   Total paid  48,100.00 USDC                                       |
|   Txns        0xabc…123 ↗   0xdef…456 ↗                            |
|  ────────────────────────────────────────────────────────────────|
|   #   Address            Amount     Status    Tx                   |
|   1   0x1a2b…9f3c        200.00     Paid      0xabc…123            |
|   2   0x4d5e…7a1b        200.00     Paid      0xabc…123            |
|   …                                                               |
|  ────────────────────────────────────────────────────────────────|
|   Every line verifiable onchain. Generated by Distro.             |
+──────────────────────────────────────────────────────────────────+
```
- Reachable from Distribution Details (`[ Download receipt ]`) and its own index.
- **CSV** for spreadsheets, **PDF/Print** for filing. Failed rows included and marked — a receipt tells the whole truth, not just the successes.

---

## Navigation map

```
Landing ──connect──▶ Dashboard ──┬─▶ Create Distribution ─▶ Distribution Details
                                 ├─▶ History ──▶ Distribution Details
                                 ├─▶ Templates ──use──▶ Create Distribution (Step 2)
                                 ├─▶ Receipts ──▶ Single receipt
                                 └─▶ Settings

Distribution Details ──▶ Receipt · Retry (→ Review→Send) · Duplicate/Template
```

**Primary nav (header):** Dashboard · History · Templates. **Receipts** and **Settings** live under the wallet `▾` menu (secondary, task-driven, not everyday). This keeps the top bar to the three surfaces a user opens daily and avoids a crowded nav — consistent with the restrained, tool-first posture.

## MVP cut line

Ships with Multisend: **Landing, Dashboard, Create, Distribution Details** (+ History and Receipts are cheap, since the data already exists from receipts, and Settings is thin). **Templates** waits for Tier 2 alongside scheduling — it's the "recurring" convenience, and it's the one surface here that carries no risk to defer.
