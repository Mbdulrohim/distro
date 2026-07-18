# Distro demo script — under 3 minutes

> Grounded in what's actually live today: `Multisend` is deployed and wired on Monad mainnet (immediate, non-custodial sends). The escrow/scheduling contract (`Distribution`/`DistributionFactory`) is built, tested, and documented (`docs/AUDIT_SCOPE.md`) but **not deployed anywhere** — it's blocked on an external audit. This script demos the real, live product and is honest about that boundary rather than staging a fake execution. See "If you need a live scheduling demo" at the bottom for the one alternative that would make that segment fully real too.

**Audience framing**: value first, mechanics second. Nobody in the room needs to hear "EIP-1167 minimal proxy" — they need to see a real problem disappear in real time.

---

## 0:00–0:25 — The problem (25s)

_(Screen: blank, or a spreadsheet/wallet screenshot — whatever you have on hand. Don't linger on tooling.)_

**Say:**

> "If you've ever had to pay ten people — a team, contributors, an airdrop list — you know what actually happens. You copy an address. You check it twice, because there's no undo. You type an amount. You sign. You wait. Then you do it again. And again. For two hundred people, that's not a task, that's a shift.
>
> Distro turns that into one workflow: upload who gets paid, review it once, approve once — and everyone gets paid, onchain, in the same transaction you sign. Nothing sits in a custodian's hands at any point."

_(Cut in as soon as the pain lands — don't over-explain it.)_

---

## 0:25–0:55 — Creating a distribution (30s)

_(Screen: `/dashboard/new`, already signed in.)_

**Do:** Connect wallet is already done off-screen (or shown in 3 seconds flat — don't let a MetaMask popup eat the demo). Name the distribution — "Q1 contributor payout" or similar, real-feeling, not "Test 123." Pick a token (USDC or WMON — whatever has a demo balance).

**Say:**

> "I name it, I pick the token — Distro reads the real onchain decimals and my live balance, so there's no guessing. That's it for setup."

---

## 0:55–1:35 — Uploading recipients (40s)

_(Screen: the recipients step.)_

**Do:** Upload a prepared CSV (10–20 rows, one deliberately duplicated address, one deliberately malformed to show validation). Let the summary bar populate live. Point at the duplicate warning. Click "Merge duplicates" once, live.

**Say:**

> "I drop in a CSV — address, amount, one per line. Distro validates every address and every amount instantly. This one has a duplicate — that's not blocked, because paying someone twice is sometimes intentional, but it's flagged, and merging it is one click. Zero recipients silently wrong, zero manual double-checking."

_(This is the segment worth the most screen time — it's the actual "instead of doing this 200 times by hand" payoff.)_

---

## 1:35–2:00 — Scheduling (25s)

_(Screen: the schedule step.)_

**Do:** Show both options — "Send now" and "Schedule for later" — and pick a date/time on the picker. Let the live countdown render for a second.

**Say:**

> "I can send this the moment I approve it — which is what we'll do today — or schedule it for later, so it fires automatically even if I'm not online when it does. That's a separate contract we've built and tested end-to-end; it's sitting behind an external security audit before it touches real funds, because it's the one piece of Distro that ever holds money in between. We don't skip that step for a demo."

_(Say this plainly and move on — it's a credibility point, not an apology. Then click back to "Send now" for the rest of the demo.)_

---

## 2:00–2:35 — Review and execute (35s)

_(Screen: the review step, then the send.)_

**Do:** Scroll the review screen once — name, token, recipient count, total in both human and base units, estimated gas, the irreversibility notice. Check the acknowledgement box. Click confirm. Let the wallet prompt appear and approve it. Watch the live status stream — submitted → confirmed, per-recipient Paid/Failed.

**Say:**

> "One review screen, everything on it, one signature. It sends directly from my wallet to every recipient — not through Distro, not through any pooled contract. Watch the status update live as it lands onchain."

_(If a token approval is needed, narrate it as "approving the exact amount, no more" — a real trust detail, not filler.)_

---

## 2:35–2:55 — History (20s)

_(Screen: `/dashboard/history`, then click into the just-created distribution's detail page.)_

**Do:** Show the filtered history list (Active/Scheduled/Completed/Failed), then the detail page: every recipient's individual status, the transaction hash linking out to the explorer.

**Say:**

> "Every distribution, filterable, forever — and every single payment traceable to its own transaction hash. Nothing here is Distro's word for it; it's a link to the chain."

---

## 2:55–3:00 — Close (5s)

**Say:**

> "That's the whole loop: upload, review, send, verify — for one recipient or one thousand."

---

## If you need a live scheduling demo

The escrow contract can be deployed to **Monad testnet** for demo purposes with no audit requirement (no real value at risk there) — that would let 1:35–2:00 become a real "schedule it, watch the countdown, come back and watch it execute automatically" segment instead of a walkthrough-and-explain. That deployment needs to run from a machine with real network access to `testnet-rpc.monad.xyz` (this preparation was done from a sandboxed environment with no internet egress) — say the word and I'll hand you the exact `forge script`/`cast` commands to run it yourself, using the existing agent wallet at `~/.monskills/keystore`.
