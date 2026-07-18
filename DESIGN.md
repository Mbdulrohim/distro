---
name: Distro
description: Premium fintech infrastructure design system — white-dominant, layered lavender, Series-A-caliber editorial polish.
colors:
  background: "#FFFFFF"
  surface: "#FFFFFF"
  light-purple: "#F4F1FF"
  lavender: "#EFEAFF"
  charcoal: "#1F2430"
  charcoal-muted: "#5B6270"
  border: "#E8E4F7"
  primary: "#6D5EF7"
  primary-hover: "#5A4CE0"
  primary-text: "#5646D6"
  secondary: "#8B7CFF"
  primary-foreground: "#FFFFFF"
  success: "#1B8A5A"
  success-surface: "#E8F7EF"
  warning: "#9A6B00"
  warning-surface: "#FDF3DC"
  destructive: "#C4304B"
  destructive-surface: "#FCE9EC"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 4.75rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  h1:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  h2:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
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
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "1.75rem"
  full: "9999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
  16: "4rem"
  24: "6rem"
  32: "8rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "2rem"
---

# Design System v3: Distro

Supersedes v2 (monochrome, then enterprise-violet-utility). This is a ground-up redesign at the user's explicit instruction: Distro must read as a **funded Series A fintech infrastructure company** — Stripe / Mercury / Linear / Vercel / PolicyMesh register — not a utility dashboard, and not a token-launch site.

**Reconciling two docs with this brief, on the record:**

- PRODUCT.md's anti-reference banned "glassmorphism-heavy **dashboards**." That target was the crypto dashboard cliché (glass panels everywhere, low legibility). This system uses glass **sparingly, on marketing surfaces only** (see §7) — the dashboard itself stays solid white for data legibility. Anti-reference updated to say this exactly.
- PRODUCT.md's "understated" personality line is updated to **"confidently premium — editorial, not shy."** Terse copy and honest error states still stand; the visual register is now expressive where it earns it (hero, section identity), not decorative everywhere.

## 1. Overview

**Creative north star: "The funded fintech, on day one of its Series A deck."**

White is the surface of record — never black, never a dark section. Depth comes from **layering**: white, then the faintest lavender, then a soft purple wash, in that order, section by section, so the page has visual rhythm without ever going dark. The brand purple appears with intention — a floating card, a gradient wash, a headline accent — not as background noise.

### Non-negotiables from the brief

- White is the dominant surface. **No black backgrounds, no dark sections, anywhere.**
- Text is soft charcoal `#1F2430`, never pure black.
- Sections alternate identity: white → light lavender → soft gradient → glass, in sequence (§7).
- Corners are generous: 12–28px. Nothing reads as a default utility component.
- Everything breathes — large whitespace, editorial pacing, never a cramped Tailwind-starter grid.

## 2. Color

### Core

- **Primary** `#6D5EF7` — the brand purple. Button fills, primary icons, active states, gradient anchor.
- **Primary-hover** `#5A4CE0` — deepened for hover/pressed, keeps contrast comfortable at every state.
- **Secondary** `#8B7CFF` — lighter, cooler violet. **Decorative and large-scale only**: gradient stops, glows, hover washes, large display accents. See the AA rule below — it is not a text or small-button-fill color.
- **Light purple** `#F4F1FF` and **Lavender** `#EFEAFF` — the two "soft layered background" tones. Light purple is the gentler wash; lavender is one step deeper, used for the sections that need to feel slightly more grounded (Problem, Security).

### Text

- **Charcoal** `#1F2430` — all body and heading text. 15.5:1 on white — soft, never harsh, but unambiguous.
- **Charcoal-muted** `#5B6270` — secondary text, captions, meta. Passes AA on white and both lavender tones.

### Functional (payment meaning only — never brand)

- **Success** `#1B8A5A` / surface `#E8F7EF` — a payment landed.
- **Warning** `#9A6B00` / surface `#FDF3DC` — partial, attention without alarm.
- **Destructive** `#C4304B` / surface `#FCE9EC` — failed, irreversible warnings.

### Verified, not assumed — two real constraints from the actual numbers

Checked against WCAG AA before these were written down as rules, not after:

1. **`#6D5EF7` white-text-on-fill is 4.57:1 — passes, but has almost no margin.** Use `primary-hover` (`#5A4CE0`, 5.4:1+) for any dense or small-label button, and never drop the fill lighter than `#6D5EF7` itself.
2. **`#8B7CFF` (secondary) fails AA as a solid fill with normal-size white text (3.27:1).** It is **decorative only** — gradients, glows, large (≥24px) display numerals, background washes. Never a standalone button or a small text color.
3. **`#6D5EF7` as small link/text color on the light-purple surface drops to 4.11:1 — short of AA body text.** For text-on-tint (a link inside a lavender card), use **`primary-text` `#5646D6`**, a deepened variant reserved for exactly this case. On plain white, `#6D5EF7` text is fine (4.57:1).

## 3. Typography

**Huge headlines, minimal paragraphs, strong hierarchy** — the fintech-editorial register.

- **Display** — `clamp(2.75rem, 5vw, 4.75rem)`, 600, -0.035em, 1.02 line-height. Hero only, one per page. Fluid is _intentional_ here (marketing, not product UI) — it's how the headline stays huge on desktop without breaking on mobile.
- **H1** 36px / 600 — section headers.
- **H2** 28px / 600 — sub-section headers, card group titles.
- **Body** 17px / 400 / 1.65 — noticeably larger and airier than a utility product's 14px; this is an editorial read, not a dense tool. Cap prose at 60ch — short paragraphs, not blocks.
- **Label** 13px / 500 — buttons, form labels, badges. Sentence case, no tracked eyebrows.
- **Mono** 13px, tabular — every address, amount, and hash, without exception. This is the one rule that survives every register change: financial values are never proportional-font.

## 4. Radius, Shadow, Glass

### Radius — generous, editorial

`sm` 12px (small controls, badges) · `md` 16px (buttons, inputs) · `lg` 24px (cards) · `xl` 28px (hero panels, large feature cards) · `full` pills. This is a deliberate step up from a utility product's 8–10px — soft geometry reads premium and consumer-fintech (Mercury), not enterprise-terminal (Linear's tighter radius).

### Shadow — soft, colored, floating

Cards **float**: a soft, purple-tinted shadow at rest, lifting further on hover.

- **Resting:** `0 2px 8px rgba(109, 94, 247, 0.06), 0 1px 2px rgba(31, 36, 48, 0.04)`
- **Hover / raised:** `0 12px 32px rgba(109, 94, 247, 0.14), 0 4px 12px rgba(31, 36, 48, 0.06)` — pair with a 4–6px translateY lift.
- **Floating hero card:** `0 24px 64px rgba(109, 94, 247, 0.18)` — the heaviest shadow in the system, reserved for the one hero visual.

### Gradients — the brand's signature move

Two sanctioned gradients, used sparingly and only where named in §7:

- **Section wash:** `linear-gradient(180deg, #FFFFFF 0%, #F4F1FF 100%)` — a whisper-soft vertical fade, not a hard color block.
- **Feature/CTA mesh:** a layered radial mix of `primary` and `secondary` at 8–14% opacity over white, soft-blurred — "gradient mesh," never a flat linear band. This is what makes Features and the final CTA feel expensive rather than templated.

### Glass — scoped, not everywhere

Glassmorphism appears in exactly one place: **Templates**, as floating cards (`rgba(255,255,255,0.6)` + `backdrop-blur(20px)` + a hairline `rgba(109,94,247,0.15)` border) over a lavender or gradient-mesh backdrop. **The product dashboard and data tables never use glass** — legibility of money data comes first, and this is also where the PRODUCT.md anti-reference still fully applies.

## 5. Motion (Framer Motion)

- **Library:** Framer Motion, for real spring/parallax primitives beyond CSS transitions.
- **Fades:** sections fade + rise 12–16px on scroll-into-view, ease `[0.16, 1, 0.3, 1]`, 500–700ms, staggered ~80ms per child — never identical across every section (that reflex is the AI-slop tell; vary it per section's content shape).
- **Parallax:** the hero's floating card and background gradient blobs drift at a slightly different scroll speed (0.85–1.1×) than the foreground text — subtle, never disorienting.
- **Card hover:** lift + shadow deepen (§4), 180ms ease-out. Buttons: 140ms fill/shadow transition, no bounce.
- **Premium loading states:** skeleton shimmer uses a soft lavender-to-white sweep, not a gray pulse — the loading state should look like the brand, not like a placeholder library default.
- Everything respects `prefers-reduced-motion`: fades become instant or crossfade, parallax disables.

## 6. Components

Every component is custom — nothing should read as an unstyled shadcn default.

- **Buttons (Stripe-grade):** `primary` fill, 16px radius, 44px height, soft shadow at rest, deepens + lifts 1px on hover, `primary-hover` fill. `secondary`/`ghost` are white with a hairline lavender border. Never a flat, shadowless rectangle.
- **Cards:** float per §4, 24px radius, generous 32px padding, hairline `border` (`#E8E4F7`) as a whisper, not a definer — the shadow does the separating.
- **Tables (Linear-grade):** clean hairline rows, generous 16px vertical padding (airier than a dense utility table), mono tabular numerics, a soft lavender header, row hover lifts to a barely-there lavender tint. Status as a pill badge (full radius), colored by function only.
- **Forms (Stripe-grade):** 16px radius inputs, soft focus ring in `primary` at 20% opacity + a solid border shift, floating labels where the field has room, generous 14px vertical padding — never a cramped 32px-tall input.
- **Illustration:** editorial line-art in charcoal + primary, one clear motif — nodes branching to many (distribution) — no stock-crypto iconography, no coins, no 3D renders. Used in empty states and the marketing hero only.

## 7. Landing Page — Section-by-Section Identity

No repeating white blocks. Each section has its own surface and visual treatment:

| Section          | Surface                                                                                         | Notes                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Hero**         | Soft purple gradient (`section wash`, top-weighted)                                             | Huge display headline, one floating product card with the heaviest shadow in the system, gradient-blob parallax behind it.           |
| **Problem**      | Light lavender `#F4F1FF` flat                                                                   | Editorial list, generous line-height, no card chrome — quiet section, sets up the contrast into Solution.                            |
| **Solution**     | White                                                                                           | The reset — after two tinted sections, plain white feels like relief and clarity. Centered, huge statement, minimal supporting copy. |
| **How it works** | White                                                                                           | Numbered steps, but rendered as icon + short line, not a tracked "01/02/03" eyebrow scaffold.                                        |
| **Features**     | Gradient mesh (§4)                                                                              | The brand's signature moment — soft radial primary/secondary wash behind a grid of floating feature cards.                           |
| **Templates**    | Glass cards over lavender or mesh                                                               | The one sanctioned glassmorphism location.                                                                                           |
| **Use cases**    | White                                                                                           | Pills/tags, dense but airy — a palette-cleanser after Templates' visual weight.                                                      |
| **Why Monad**    | Editorial                                                                                       | Generous asymmetric layout, pull-quote-style statement type, not a 3-card grid — reads like a magazine spread, not a spec sheet.     |
| **Security**     | Soft purple (light-purple flat, not gradient — calmer, since this section carries trust claims) | Restrained: the honest guarantees carry weight without needing gradient drama.                                                       |
| **FAQ**          | White                                                                                           | Accordion, generous spacing between items.                                                                                           |
| **Final CTA**    | Beautiful gradient (heaviest mesh in the page, echoing Hero)                                    | Bookends the page — the two most visually rich moments are the open and the close.                                                   |
| **Footer**       | White                                                                                           | Quiet landing after the CTA's intensity.                                                                                             |

## 8. Do's and Don'ts

### Do

- Do keep white as the base of every section; use lavender/mesh/glass as **overlays and washes**, never as a competing dark surface.
- Do use `primary-hover` (not `primary`) for any small or dense button label — it carries real AA margin where `primary` barely clears it.
- Do reserve `secondary` (`#8B7CFF`) for gradients, glows, and large-scale accents — never a small solid button or text color (verified: fails AA at those sizes).
- Do use `primary-text` (`#5646D6`) for any link or small text sitting on a lavender/purple tint.
- Do let each landing section have a different surface identity (§7) — repetition is the tell of a template.
- Do keep the product dashboard and data tables on plain white/soft-shadow cards — no glass, ever, where money data needs to be read at a glance.

### Don't

- Don't use black or any dark section background, anywhere, for any reason.
- Don't use pure black text — charcoal `#1F2430` always.
- Don't apply glassmorphism outside Templates — the dashboard stays solid for legibility.
- Don't use a flat linear gradient band — the sanctioned gradients are soft, radial-mesh, or a whisper vertical fade, never a hard diagonal SaaS-template stripe.
- Don't repeat the same section treatment twice in a row — alternate per §7.
- Don't use uppercase tracked eyebrows or `01/02/03` numbered scaffolding for hierarchy — size and weight only.
- Don't animate identically across every section — vary stagger and fade shape per section's actual content.

---

## Migration note

This is the design system only, per instruction — no application code changed this pass. The app currently reflects **v2** (enterprise-violet-utility, tight 10px radii, flat cards, no motion library). Implementing v3 means: install Framer Motion, rebuild the marketing page section-by-section per §7, restyle Button/Card/Input/Table primitives to the new radius/shadow/gradient language, and — deliberately — leave the authenticated dashboard and data tables closer to the flatter, denser treatment where legibility matters most, per the Do's above.
