---
name: Distro
description: Onchain distribution engine for Monad — the design system for a payments product that moves real money on a schedule.
colors:
  # Neutrals — monochrome-first, OKLCH, chroma 0. Light is canonical; dark is first-class.
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  surface: "oklch(0.985 0 0)"
  surface-2: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.505 0 0)"
  border: "oklch(0.922 0 0)"
  ring: "oklch(0.50 0.17 255)"
  # Primary = ink. Monochrome by intent; the accent is NOT the primary action color.
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  # Functional semantic set — every hue means a payment state, nothing decorative.
  info: "oklch(0.50 0.17 255)"
  info-surface: "oklch(0.965 0.02 255)"
  success: "oklch(0.50 0.14 150)"
  success-surface: "oklch(0.965 0.03 150)"
  warning: "oklch(0.55 0.12 75)"
  warning-surface: "oklch(0.97 0.04 85)"
  destructive: "oklch(0.55 0.22 27)"
  destructive-surface: "oklch(0.965 0.02 27)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
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
    letterSpacing: "0"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 450
    lineHeight: 1.4
    letterSpacing: "0"
    fontFeature: "'tnum' 1, 'zero' 1"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  full: "9999px"
spacing:
  px: "1px"
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
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.destructive-surface}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  status-badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  table-cell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    padding: "0.625rem 1rem"
    typography: "{typography.mono}"
---

# Design System: Distro

## 1. Overview

**Creative North Star: "The Instrument Panel"**

Distro moves payroll. The interface should feel the way a good instrument panel feels: everything legible at a glance, nothing decorative competing with the reading you actually need, and total confidence that what it shows is true. This is not a marketing surface and must never behave like one. It is a precise tool a finance or ops lead trusts with real money on a deadline — closer to the transfer confirmation screen of a bank you respect than to a token-launch site.

The system is **monochrome-first**. Structure comes from a near-grayscale surface hierarchy and a disciplined type scale; **color is reserved almost entirely for meaning** — a green figure is money that landed, a red one is money that didn't. This is the deliberate reject of the category's defaults: no neon, no gradients, no glassmorphism, no purple crypto sheen, no ornamental motion. Restraint is the brand. When every screen is quiet, the one colored thing on it — a failed payment, an irreversible-action warning — is impossible to miss, which is exactly the point.

Density is earned. Where the user is scanning a thousand recipients, the UI goes dense and tabular; where the user is making an irreversible decision, it goes spacious and slow. The system supports both without changing its vocabulary.

**Key Characteristics:**

- Monochrome-first; color always carries a payment meaning, never decoration.
- Geist for everything human, Geist Mono for everything financial (addresses, amounts, hashes).
- Flat by default — depth is a response to state, not an ambient texture.
- Light is canonical, dark is fully first-class (both wired in OKLCH).
- Calm at rest so that signal is loud when it matters.

### Spatial system

A **4px base grid**. Every margin, padding, and gap is a multiple of 4 (`spacing` tokens `1`=4px … `16`=64px). Component internal rhythm favors 8/12/16; section rhythm favors 24/32/48. Vary spacing for hierarchy — a dense table row (10px vertical) and a review-step section (32px) are the same system at two densities, not two systems.

**Grid & app shell.** A 12-column grid inside a max content width of **1200px** (dashboard) / **720px** (focused flows like review and execution — narrower on purpose, so an irreversible decision isn't spread across a wide field). The MVP shell is a **top header + content column**; a left sidebar is reserved in the token/layout vocabulary for when navigation grows, using `surface` as its slightly-recessed background.

**Responsive rules** are structural, not fluid — type sizes are fixed rem, layouts reflow at breakpoints:

- **`sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280.**
- Below `md`: dense tables collapse from columns to stacked recipient rows (address + amount + status as a single card-like row); the header wallet control drops its address text to an icon.
- Focused flows stay single-column at every width — they are already narrow.
- Never fluid headings; a payroll total that resizes with the viewport reads as unstable.

### Motion doctrine

Motion conveys **state and continuity only** — never decoration, never a page-load performance. Durations **150–220ms**, easing **ease-out** (`cubic-bezier(0.16, 1, 0.3, 1)`), no bounce, no elastic. State changes (hover, focus, selection), enter/exit of menus and dialogs, skeleton→content swaps, and the live tally ticking up during execution are the entire motion budget. **The one place motion is allowed to be expressive** is a completed distribution's success confirmation — a single calm settle, once. Everything obeys `prefers-reduced-motion: reduce` with a crossfade or instant substitute.

## 2. Colors

A near-grayscale surface system carrying a tight, strictly functional semantic set. Light mode is canonical; every token has a dark pair.

### Primary

- **Ink** (`oklch(0.205 0 0)` light / `oklch(0.922 0 0)` dark): the primary action color and strongest text weight. Primary buttons, the active nav item, headings. **Monochrome by intent** — the main call to action is near-black, not a brand hue. This is the Vercel/Linear posture and it is the brand's confidence.

### Secondary

Distro has no secondary _brand_ color. What would be an accent elsewhere is, here, the **Info** role below — a deliberate choice, not an omission.

### Tertiary

None. Adding one would dilute the functional-color doctrine.

### Neutral

- **Canvas** (`oklch(1 0 0)` / `oklch(0.145 0 0)`): the base background.
- **Surface** (`oklch(0.985 0 0)` / `oklch(0.205 0 0)`): recessed panels, sidebars, table headers.
- **Surface-2** (`oklch(0.97 0 0)` / `oklch(0.269 0 0)`): secondary buttons, hover fills, neutral badges.
- **Ink** (foreground, above): primary text.
- **Muted ink** (`oklch(0.505 0 0)` / `oklch(0.708 0 0)`): secondary/meta text, timestamps, column headers. **This is the floor** — never lighter for body text (it sits at ~4.6:1 on canvas; going lighter fails AA, the single most common design regression).
- **Border** (`oklch(0.922 0 0)` / `oklch(1 0 0 / 10%)`): hairline dividers and rests-state component edges. Structure comes from borders, not shadows.

### Semantic (the functional palette)

Each role has a **solid** (text, icon, border) and a **surface** tint (chip/banner background). Solids are tuned to ≥4.5:1 on canvas.

- **Info / Interactive** (`oklch(0.50 0.17 255)`): focus rings, links, current selection, and the `pending`/`submitted`/scheduled state. This is the closest thing to an accent, and it appears on **≤10% of any screen**.
- **Success / Paid** (`oklch(0.50 0.14 150)`): a confirmed payment, a completed distribution, the "verifiable onchain" checkmark. The product's happiest event.
- **Warning** (`oklch(0.55 0.12 75)`): partial completion, "balance changed", unsupported-token notices — attention without alarm.
- **Destructive / Failed** (`oklch(0.55 0.22 27)`): failed payments, irreversible-action warnings, destructive confirmations. The loudest thing in the system, so it is used the least.

### Named Rules

**The Functional Color Rule.** Color always carries a payment meaning. If an element is colored, a user must be able to say _what state that color denotes_. Nothing is tinted for brand flavor, warmth, or visual interest — the monochrome surface is the flavor.

**The One Voice Rule.** Info/interactive blue appears on ≤10% of any screen. Its rarity is what makes a focused field or the current nav item legible instantly.

**The Never-Color-Alone Rule.** State is never signaled by color alone. `Paid` is green _and_ a check _and_ the word; `Failed` is red _and_ an icon _and_ the word. This is both accessibility (color-blind users, ~8% of men) and the product's honesty principle — the meaning survives a grayscale screenshot.

## 3. Typography

**Display / Body / Label Font:** Geist (with `ui-sans-serif, system-ui, sans-serif`)
**Financial / Mono Font:** Geist Mono (with `ui-monospace, SFMono-Regular, monospace`)

**Character:** One humanist-geometric sans across the entire interface, in multiple weights — no display/body pairing, because a product UI earns trust through consistency, not contrast. Geist Mono is not a stylistic flourish; it is load-bearing. Every address, token amount, hash, and quantity is monospaced with **tabular figures**, so columns of numbers align to the digit and two addresses can be compared character by character.

### Hierarchy

Fixed rem, not fluid. Scale ratio ~1.2. More type roles than a brand site, lower contrast between them — noise is the enemy in dense UI.

- **Display** (600, 1.875rem/30px, 1.15, -0.02em): page titles only (Dashboard, a distribution name). One per screen.
- **Headline** (600, 1.375rem/22px, 1.25, -0.015em): section headers, the total on a review screen.
- **Title** (600, 1rem/16px, 1.4): card headers, table captions, modal titles.
- **Body** (400, 0.875rem/14px, 1.55): the default. Prose caps at 65–75ch; help text and explanations.
- **Label** (500, 0.8125rem/13px, 1.3): form labels, buttons, column headers, badges. Sentence case, **never all-caps tracked eyebrows**.
- **Mono** (450, 0.8125rem/13px, 1.4, tabular): addresses, amounts, tx hashes, token symbols, gas figures.

### Named Rules

**The Monospace Money Rule.** Every address, amount, token quantity, and hash is set in Geist Mono with tabular figures (`font-feature-settings: 'tnum'`). No financial value ever appears in the proportional sans. This is non-negotiable — misaligned or ambiguous numbers are how money moves wrong.

**The No-Eyebrow Rule.** No tiny uppercase letter-spaced kickers above sections, and no `01 / 02 / 03` numbered section markers. They are the marketing-page reflex this product explicitly rejects. Hierarchy comes from size and weight.

## 4. Elevation

**Flat by default.** Depth is structural and comes from **borders and tonal surface layering**, not ambient shadow. A card is a card because of its border and its `surface` fill, not because it floats. Shadows appear only when an element is genuinely _above_ the plane as a response to state — a menu, a dialog, a popover — never at rest, never on a card or a table.

### Shadow Vocabulary

- **Raised** (`0 1px 2px oklch(0 0 0 / 0.05)`): the single resting elevation permitted, and only on interactive controls that must read as pressable (primary buttons). Optional; borders alone are also correct.
- **Overlay** (`0 8px 24px oklch(0 0 0 / 0.12)`): dropdowns, popovers, command palette. The element has left the plane.
- **Dialog** (`0 16px 48px oklch(0 0 0 / 0.18)`): modals over a `oklch(0 0 0 / 0.4)` scrim.

Dark mode conveys the same hierarchy through **lighter surfaces**, not stronger shadows (shadows read poorly on dark); a raised element gets a brighter fill and a `oklch(1 0 0 / 0.1)` border.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. If you are adding a shadow to a card, table, or panel, you are wrong — reach for a border or a `surface` step instead. Shadow is exclusively the language of "temporarily above the page" (menus, dialogs).

**The Z-Index Ladder.** Semantic scale only, never arbitrary values: base → dropdown (10) → sticky header (20) → scrim (30) → dialog (40) → toast (50) → tooltip (60).

## 5. Components

Every interactive component ships all seven states: **default, hover, focus-visible, active, disabled, loading, error**. Half a component is a bug. Affordances are consistent across every screen — the same button shape, the same field vocabulary, the same icon family, everywhere.

### Buttons

- **Shape:** gently rounded (`0.5rem` / 8px), height 2.25rem (36px), label type (500).
- **Primary:** Ink fill, canvas-colored text. The one strong action per view (Continue, Distribute, Confirm). Hover darkens ~5%; `active` nudges down 1px; focus-visible shows a 2px info ring with offset.
- **Secondary:** Surface-2 fill, ink text. Neutral secondary actions (Back, Cancel).
- **Ghost:** transparent, ink text, hover fills Surface-2. Toolbar and low-emphasis actions.
- **Destructive:** destructive-surface fill, destructive text (not a solid red block — reserved emphasis). Only for irreversible/removing actions.
- **Loading:** label is replaced or preceded by a spinner; width holds; button disables. Never a layout shift.
- **The primary action is never a semantic color.** Distribute is Ink, not green — green means _paid_, and a button is not yet a payment.

### Status badges (signature)

The vocabulary that makes distribution state readable at a glance. Small, `label` type, `sm` radius, **surface-tint fill + solid text + a leading icon**:

- `Draft` — neutral Surface-2 / muted ink, dot icon.
- `Scheduled` / `Pending` / `Submitted` — info surface / info, clock icon.
- `Completed` / `Paid` — success surface / success, check icon.
- `Partial` — warning surface / warning, alert icon, with a count ("Partial · 4 failed").
- `Failed` — destructive surface / destructive, cross icon.

### Cards / Containers

- **Corner:** 0.625rem (10px).
- **Background:** canvas; **border** (hairline) provides definition. `surface` fill only when recessed inside another canvas region.
- **Shadow:** none (see Flat-By-Default). **Never nest a card in a card.**
- **Padding:** 1.25rem (20px) default; 1rem for dense contexts.

### Inputs / Fields

- **Style:** canvas fill, hairline border, 8px radius, 36px height, mono font for address/amount fields and sans for name fields.
- **Focus:** border shifts to info + a 2px info ring (no glow). Calm, precise.
- **Error:** border and ring shift to destructive; an icon + message sit _below_ the field, in words — never a bare red outline. The message says what to fix.
- **Disabled:** Surface-2 fill, muted text, `not-allowed` cursor.
- **Validation is inline and specific** ("Not a valid address" on the row), never a summary toast.

### Tables (signature — the recipient ledger)

The most important component in the product; distributions run to thousands of rows.

- **Density:** 10px vertical cell padding; mono, tabular figures for address/amount/hash columns; sans for labels.
- **Header:** `surface` fill, muted-ink label type, sticky on scroll.
- **Row:** hairline bottom border only (no full grid, no zebra by default — zebra is noise at scale). Hover fills Surface-2.
- **Status column:** a status badge, right-aligned with the amount.
- **Loading:** skeleton rows in the table's own shape, not a centered spinner.
- **Empty:** teaches ("Import a CSV to add recipients") with the primary action, never "No data."
- **Scale:** server-side pagination, sortable headers, a filter for "failures only." Virtualize beyond ~200 rows.

### Navigation

- **Header:** canvas with a hairline bottom border, 56px tall. Wordmark left, wallet/network control right.
- **Wallet control states:** `Loading` (skeleton) → `Connect Wallet` (primary) → `Check your wallet…` (disabled, spinner) → `0x1234…abcd · Disconnect` (mono address chip + ghost button).
- **Network indicator:** silent when on Monad Mainnet; a full-width warning banner (warning role) when wrong — persistent and blocking, because a wrong-network action with real funds must be hard to do.

### Modals / Dialogs

- Dialog shadow over a scrim; `md`-radius; title (Title type), body, actions bottom-right.
- **Reserved for the genuinely dismissible** (network switch, discard draft, CSV help). The review and execution steps are **full screens, not modals** — a money decision must not feel dismissible.

### Icons

- **Lucide** (already the dependency), **1.5px stroke, 16–20px**, matched to `label`/`body` optical size. One family, no mixing. Icons reinforce state (they never replace the text label), align to the 4px grid, and inherit the semantic color of their context.

## 6. Do's and Don'ts

### Do:

- **Do** keep the interface monochrome and let the one green or red thing on the screen carry the weight. Calm-at-rest is what makes signal loud.
- **Do** set every address, amount, hash, and token quantity in **Geist Mono with tabular figures** (The Monospace Money Rule).
- **Do** pair every state color with an icon and a word (The Never-Color-Alone Rule) — the meaning must survive a grayscale screenshot.
- **Do** convey depth with borders and `surface` layering; reserve shadows for menus and dialogs only (The Flat-By-Default Rule).
- **Do** label irreversible actions in plain words ("Distributing is irreversible — tokens sent to a wrong address cannot be recovered") and give them full-screen weight, not a modal.
- **Do** distinguish `submitted` from `confirmed` visually during execution — a mining transaction must never read as done or as failed.
- **Do** verify contrast: body text ≥4.5:1, muted ink is the floor, focus rings and semantic solids ≥4.5:1 on their surface.
- **Do** ship all seven component states, skeletons for loading, and empty states that teach.
- **Do** keep motion to 150–220ms ease-out state transitions, and honor `prefers-reduced-motion`.

### Don't:

- **Don't** use neon gradients, glassmorphism, or the purple crypto sheen — this includes removing the scaffold's leftover `sidebar-primary` purple. These are the named anti-references; Distro reads like Stripe, Linear, Mercury, and Vercel, never a token-launch site.
- **Don't** color the primary action a semantic hue. **Distribute is Ink, not green** — green means _paid_, and a button is not a payment.
- **Don't** let muted gray text go lighter than the muted-ink floor for anything a user must read. Light gray "for elegance" is the top readability failure.
- **Don't** use tiny uppercase tracked eyebrows or `01 / 02 / 03` section numbers. Hierarchy is size and weight (The No-Eyebrow Rule).
- **Don't** put shadows on cards, tables, or panels; **don't** nest a card inside a card.
- **Don't** use `border-left`/`border-right` colored stripes on cards, rows, or alerts. Use full borders, surface tints, or a leading icon.
- **Don't** reach for a modal as the first thought — exhaust inline and full-screen alternatives; money moments are screens.
- **Don't** animate for decoration, run page-load choreography, or use bounce/elastic easing.
- **Don't** fluidly scale headings or financial figures with the viewport — fixed rem; a resizing payroll total reads as unstable.
- **Don't** invent affordances for standard tasks (custom scrollbars, non-standard form controls). Earned familiarity is the bar.
