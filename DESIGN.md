---
name: Distro
description: Enterprise onchain distribution platform on Monad — a premium, white-dominant, violet fintech design system.
colors:
  # --- Canvas & ink (white-dominant, cool-tinted toward the brand) ---
  background: "oklch(1 0 0)"
  surface: "oklch(0.985 0.012 290)"
  lavender: "oklch(0.975 0.018 290)"
  lavender-strong: "oklch(0.955 0.028 290)"
  foreground: "oklch(0.21 0.015 285)"
  muted-foreground: "oklch(0.48 0.03 285)"
  border: "oklch(0.91 0.015 290)"
  border-strong: "oklch(0.86 0.02 290)"
  ring: "oklch(0.53 0.22 285)"
  # --- Brand: violet. The interactive + brand colour, NOT a payment state. ---
  primary: "oklch(0.53 0.22 285)"
  primary-hover: "oklch(0.47 0.21 285)"
  primary-foreground: "oklch(1 0 0)"
  primary-surface: "oklch(0.965 0.03 290)"
  # --- Functional semantics: each hue carries a payment MEANING. ---
  success: "oklch(0.52 0.15 150)"
  success-surface: "oklch(0.965 0.03 150)"
  warning: "oklch(0.52 0.11 70)"
  warning-surface: "oklch(0.97 0.05 80)"
  destructive: "oklch(0.55 0.22 27)"
  destructive-surface: "oklch(0.965 0.02 27)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  h1:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 450
    lineHeight: 1.4
    fontFeature: "'tnum' 1, 'zero' 1"
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.875rem"
  xl: "1.125rem"
  full: "9999px"
spacing:
  0.5: "0.125rem"
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
  12: "3rem"
  16: "4rem"
  20: "5rem"
  24: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.375rem"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.375rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.375rem"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.375rem"
  status-badge:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
    typography: "{typography.label}"
---

# Design System: Distro

## 1. Overview

**Creative North Star: "Quiet Infrastructure."**

Distro moves other people's payroll. The interface has to feel the way an enterprise treasury tool feels when it's trustworthy: calm, exact, and unmistakably premium — the kind of surface a finance lead relaxes when they see, because it signals _this was built by people who take money seriously._ The reference points are Stripe, Linear, Vercel, and Mercury: white-dominant, softly violet, generous with space, restrained with ornament.

The system is **white-first with a violet soul.** White and the faintest lavender carry almost every surface; a single considered violet is the brand and the interactive language — primary actions, focus, selection, links. It is used with discipline, never sprayed. Color that _means something specific_ — a payment landed, a payment failed — comes from a separate functional set (green, amber, red) so the brand violet never has to double as a status.

This is the deliberate correction of the crypto default. **No neon, no gradients on everything, no glassmorphism, no dark degen dashboards.** The violet is enterprise violet — deep, slightly cool, worn like Stripe wears its indigo — not a token-launch sheen. Premium here is subtraction: soft shadows instead of borders-everywhere, one accent instead of five, air instead of density where the stakes are high.

**Key characteristics**

- White-dominant canvas; soft lavender for grouping and depth.
- One violet, used for brand + interaction only — never as a payment status.
- Functional green / amber / red carry payment meaning, and only that.
- Geist for everything human; Geist Mono, tabular, for every address and amount.
- Soft, low elevation — premium calm, not flat austerity.
- Light is canonical; dark is a first-class violet-on-near-black companion.

### Brand values, made visual

- **Reliability** — nothing decorative competes with the data; every state is designed, including failure.
- **Transparency** — amounts shown in full, both representations; every payment one click from its onchain proof.
- **Simplicity** — one accent, one type family, a tight scale. Restraint reads as confidence.
- **Security** — irreversible actions are spacious and slow; the loudest colour (red) is used the least.
- **Automation** — motion is functional and quiet; the product feels like it runs itself, not like it's performing.

### Spatial system (spacing)

A **4px base grid**; every gap, pad, and margin is a multiple of 4 (`spacing` tokens `1`=4px … `24`=96px). Rhythm, not uniformity: dense data (table rows ~10–12px) and decisive moments (review sections 32–48px) are the same scale at two densities. Enterprise surfaces earn trust through _air_ — sections breathe at 64–96px; cards pad at 24px, never cramped.

### Grid & layout

12-column grid inside a **1200px** max for dashboards, **760px** for focused money flows (review, send) — narrower on purpose so an irreversible decision is never spread thin. App shell: a **left sidebar** (240px, `lavender` recessed fill) + top bar on wide screens; the sidebar collapses to a top bar below `lg`. Responsive behaviour is **structural** (collapse the nav, reflow columns, stack dense tables) — never fluid type.

**Breakpoints:** `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

### Radius system

Softer than a utility tool, tighter than a consumer app — the enterprise-fintech middle. Base **10px** (`md`), scaling `sm` 6 · `md` 10 · `lg` 14 · `xl` 18 · `full`. Controls (buttons, inputs) use `md`; cards and panels use `lg`; modals `xl`; pills and avatars `full`. One family of curvature, applied consistently.

### Motion principles

Motion conveys **state and continuity**, never spectacle. Durations **140–220ms**; easing **ease-out** (`cubic-bezier(0.16, 1, 0.3, 1)`) — no bounce, no elastic. The permitted budget: hover and focus transitions, a card's ~1px shadow-lift on hover, menu/dialog enter-exit, skeleton→content crossfade, and the live tally ticking during a distribution. **One expressive moment only:** a completed distribution settles once, calmly. Everything honours `prefers-reduced-motion: reduce` with a crossfade or instant substitute. No page-load choreography — an enterprise tool loads into the task.

## 2. Colors

White-dominant, softly violet, with a strictly functional status set. Light is canonical; every token has a dark pair.

### Primary — the brand violet

- **Primary** `oklch(0.53 0.22 285)` — Distro violet, an indigo-leaning fintech purple (Stripe/Linear register). White text passes AA on it (5.8:1). Primary buttons, active nav, links, focus, current selection. **This is brand and interaction — never a payment status.**
- **Primary-hover** `oklch(0.47 0.21 285)` · **Primary-foreground** white · **Primary-surface** `oklch(0.965 0.03 290)` for tinted chips, selected rows, focus halos.

### Secondary

No second brand colour by design. A second accent would dilute the one that matters. "Secondary" actions are neutral (see Buttons).

### Neutral (white & lavender)

- **Background** white — the dominant surface.
- **Surface** `oklch(0.985 0.012 290)` — the faintest lavender, for inset panels and table headers.
- **Lavender** `oklch(0.975 0.018 290)` / **Lavender-strong** `oklch(0.955 0.028 290)` — section backgrounds and the sidebar; the "soft lavender" that signals grouping without weight.
- **Foreground** `oklch(0.21 0.015 285)` — near-black, faintly cool toward the brand (a tinted neutral, not pure gray). 17:1 on white.
- **Muted-foreground** `oklch(0.48 0.03 285)` — secondary text, labels, meta. **The floor** — it clears AA on _both_ white (6.6:1) and lavender (6.1:1), which is where muted grays usually fail.
- **Border** `oklch(0.91 0.015 290)` hairlines · **Border-strong** for emphasis dividers.

### Semantic — functional, meaning-bearing

Each has a solid (text/icon/border) tuned to ≥4.5:1 on white, and a surface tint (chip/banner):

- **Success / Paid** `oklch(0.52 0.15 150)` — a confirmed payment. The product's best moment.
- **Warning / Partial** `oklch(0.52 0.11 70)` — a partial run, a balance change; attention without alarm.
- **Destructive / Failed** `oklch(0.55 0.22 27)` — failed payments, irreversible-action warnings. Loudest, so used least.

### Named rules

**The Brand-Isn't-A-Status Rule.** Violet is brand and interaction. Payment states are green / amber / red. A "Distribute" button is violet because it's the primary action — never green, because green means _paid_, and a button is not yet a payment.

**The One-Violet Rule.** A single violet, used for primary action, current selection, focus, and links — nothing else. Its restraint is what makes it read premium rather than crypto.

**The Never-Color-Alone Rule.** Status is never colour alone: `Paid` is green + a check + the word. The meaning survives a grayscale print and doesn't depend on hue discrimination.

## 3. Typography

**Primary family:** Geist (with `ui-sans-serif, system-ui`). **Numeric / mono:** Geist Mono.

One humanist-geometric sans across the whole product — headings, labels, body, data — in multiple weights. No display/body pairing: enterprise UI earns trust through consistency, not contrast. Geist Mono is load-bearing, not stylistic: **every address, amount, hash, and token quantity is monospaced with tabular figures**, so columns align to the digit and two addresses compare character by character.

### Scale (fixed rem, ~1.2 ratio)

- **Display** 48px / 600 / -0.03em — marketing hero only.
- **H1** 30px / 600 — page titles, one per screen.
- **H2** 22px / 600 — section headers, the total on a review.
- **Title** 16px / 600 — card headers, modal titles.
- **Body** 14px / 400 — the default; prose caps 65–75ch.
- **Label** 13px / 500 — form labels, buttons, column heads, badges. Sentence case, **never all-caps tracked eyebrows.**
- **Mono** 13px / 450, tabular — all financial values.

### Named rules

**The Monospace Money Rule.** No financial value ever renders in the proportional sans. Addresses, amounts, hashes, gas — always Geist Mono, tabular. Misaligned or ambiguous numbers are how money moves wrong.

**The No-Eyebrow Rule.** No tiny uppercase tracked kickers, no `01 / 02 / 03` section markers as scaffolding. Hierarchy is size and weight.

## 4. Elevation (shadows)

Unlike a pure utility tool, this system uses **soft, restrained elevation** — the Stripe/Mercury register — because premium enterprise surfaces read as gently lifted, not flat. Shadows are low-opacity and faintly cool (tinted toward the brand), never hard or gray.

### Shadow scale

- **xs** `0 1px 2px oklch(0.21 0.015 285 / 0.05)` — resting buttons, inputs on focus.
- **sm** `0 1px 3px oklch(0.21 0.015 285 / 0.06), 0 1px 2px oklch(0.21 0.015 285 / 0.04)` — **cards at rest.** The default premium lift.
- **md** `0 4px 12px oklch(0.21 0.015 285 / 0.08)` — card hover, popovers, dropdowns.
- **lg** `0 12px 32px oklch(0.21 0.015 285 / 0.12)` — modals, over a `oklch(0.21 0.015 285 / 0.4)` scrim.

Dark mode conveys the same hierarchy through **lighter surfaces + subtle violet-tinted borders**, not stronger shadows (shadows read poorly on dark).

### Named rules

**The Soft-Lift Rule.** Cards rest on `sm` and lift to `md` on hover — a ~3px travel, 160ms. This gentle response is the system's core premium tell. Never a hard drop shadow, never a colored glow.

**The Z-Index Ladder.** Semantic only: base → dropdown 10 → sticky nav 20 → scrim 30 → modal 40 → toast 50 → tooltip 60.

## 5. Components

Every interactive component ships **default, hover, focus-visible, active, disabled, loading, error**. Half a component is a bug. Vocabulary is identical across every screen.

### Buttons

- **Shape:** 10px radius, 38px height, label type (500), `xs` shadow.
- **Primary:** violet fill, white text, `sm` shadow; hover → `primary-hover` + `md` lift; active nudges 1px; focus-visible → 2px violet ring, 2px offset. The one strong action per view.
- **Secondary:** white fill, ink text, hairline border; hover fills `surface`. Neutral actions (Back, Cancel).
- **Ghost:** transparent, ink text, hover fills `primary-surface`. Toolbar / low-emphasis.
- **Destructive:** `destructive-surface` fill, destructive text — reserved emphasis, not a solid red block. Irreversible/removing only.
- **Loading:** spinner replaces or precedes the label, width held, disabled. No layout shift.
- **The primary action is never a semantic color.** Distribute is violet.

### Cards

- **Corner** 14px · **fill** white · **shadow** `sm` at rest, `md` on hover (`Soft-Lift`) · **padding** 24px.
- Border optional and hairline; on lavender sections, shadow alone separates the card. **Never nest a card in a card.**

### Dashboard cards (stat / metric)

- White card, `sm` shadow, 20–24px pad. A **label** (muted, 13px) above a **value** (mono, tabular, 28–32px). A metric that is a payment total is mono; a count is mono. Optional delta uses a semantic colour + icon, never colour alone.
- Grouped counters render as **one unified strip** with hairline dividers rather than floating boxes — calmer, more enterprise.

### Inputs

- White fill, hairline border, 10px radius, 38px height. Mono for address/amount fields, sans for names.
- **Focus:** border → violet + 2px violet ring (no glow). **Error:** border/ring → destructive, message _below_ in words, never a bare outline. **Disabled:** `surface` fill, muted text.
- Validation inline and specific ("Not a valid address" on the row), never a summary toast.

### Tables (the recipient ledger — signature surface)

- **Density:** 10–12px cell padding; mono tabular for address/amount/hash, sans for labels.
- **Header:** `surface` (faint lavender) fill, muted-ink labels, sticky on scroll.
- **Row:** hairline bottom border, hover fills `surface`; the whole row is a link where it opens a detail. No zebra — noise at scale.
- **Status column:** a status badge, right-aligned with the amount.
- **Loading:** skeleton rows in the table's shape. **Empty:** teaches, never "No data." **Scale:** server-side pagination, sortable heads, "failures only" filter, virtualize beyond ~200 rows; below `md`, collapse to stacked rows.

### Modals

- `lg` shadow over a scrim; 18px radius; title / body / actions bottom-right.
- **Reserved for the genuinely dismissible** (network switch, discard draft, help). Review and execution are **full screens, not modals** — a money decision must not feel dismissible.

### Toasts

- Bottom-right, `md` shadow, 10px radius, auto-dismiss ~4s, stack max 3, dismissible, `role="status"`.
- **Only for the reversible and trivial** — "Copied", "Draft saved", "CSV exported". A financial outcome is **never** a toast; it is designed inline (`Never-Toast-The-Money`). Success toast carries a check; error a cross — colour never alone.

### Empty states

- Centered in a lavender-tinted, hairline-bordered panel: a soft-violet icon in a white rounded tile, a one-line title, one sentence that teaches, one primary action. Purposeful, never "nothing here." First-run empty states point at the first action (import a CSV).

### Navigation

- **Sidebar** (wide): 240px, `lavender` fill, hairline right border. Items are label type; the current item gets `primary-surface` fill + violet text + a 2px violet left indicator. Wordmark top, wallet/account bottom.
- **Top bar** (mobile / marketing): white, hairline bottom border, 56px. Wordmark left, wallet control right.
- **Network indicator:** silent on the supported chain; a full-width **warning** banner (amber, not red — a recoverable mistake) when wrong, one click to switch.
- **Command palette (⌘K):** expected at this tier — jump to a distribution, start a new one.

### Icons

- **Lucide**, 1.5px stroke, 16–20px, matched to label/body optical size. One family, no mixing. Icons reinforce state (never replace the text label), align to the 4px grid, and inherit their context's semantic colour.

### Illustration

- **Geometric, line-first, monochrome-violet.** The recurring motif is _distribution_: one node branching to many — thin violet strokes on white, occasional `primary-surface` fills, no 3D, no gradients, no crypto coins or mascots. Spot illustrations for empty states and the marketing hero; everywhere else, real product surfaces (a distribution table) beat decoration. Restraint is the style: an illustration should look like a diagram an engineer would draw, refined.

## 6. Do's and Don'ts

### Do

- **Do** keep white and lavender dominant and let a single violet carry brand + interaction — its rarity is the premium signal.
- **Do** reserve green / amber / red for payment meaning, always paired with an icon and a word.
- **Do** set every address, amount, and hash in Geist Mono, tabular (`Monospace Money`).
- **Do** lift cards softly on hover (`sm`→`md`, ~3px, 160ms) — the system's core premium tell.
- **Do** give irreversible actions full-screen weight, spacious layout, and plain-word warnings.
- **Do** distinguish `submitted` from `confirmed` during execution — a mining tx must never read as done.
- **Do** verify contrast: body ≥4.5:1, and check muted text on **lavender**, not just white.
- **Do** ship all seven component states, skeletons for loading, and teaching empty states.

### Don't

- **Don't** let the violet become neon, gradient, or glassmorphic — that's the crypto tell this brand explicitly rejects. One deep, restrained violet.
- **Don't** color a primary action a semantic hue. **Distribute is violet, not green.**
- **Don't** use more than one accent, or tint neutrals toward warmth — neutrals lean faintly cool toward the brand or stay at chroma 0.
- **Don't** put a financial outcome in a toast; design it inline.
- **Don't** use hard/black drop shadows or colored glows; shadows are soft, low-opacity, faintly violet.
- **Don't** use uppercase tracked eyebrows or `01/02/03` scaffolding.
- **Don't** nest cards, zebra-stripe tables, or reach for a modal before exhausting inline and full-screen.
- **Don't** fluidly scale headings or money figures with the viewport.
- **Don't** animate for decoration, choreograph page loads, or use bounce/elastic easing.

---

## Migration note (not this pass)

This supersedes the previous monochrome DESIGN.md. The shipped app — landing, dashboard, detail, create flow, and ~15 components — is themed against the old system and does **not** yet reflect this. Re-theming is a separate, deliberate pass: rewire `globals.css` tokens (introduce `--primary` violet, `--lavender`, the shadow scale; retire the monochrome primary), then sweep components. Until then, treat this document as the target, and PRODUCT.md's anti-reference as "no _neon crypto_ purple" — which this restrained enterprise violet honours.
