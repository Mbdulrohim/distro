# Design

Generated from the shadcn/ui `base-nova` preset scaffold (`web/src/app/globals.css`) — the real starting tokens, not invented ones. This is a foundation baseline; expect to revisit once real screens exist (see PRODUCT.md's Design Principles).

## Color

Neutral, near-grayscale system (OKLCH, no hue on base tokens) with full light/dark pairs already wired:

- `background` / `foreground` — near-white / near-black, inverted in dark mode
- `primary` — near-black in light mode, near-white in dark mode (monochrome-first, no default accent hue)
- `secondary`, `muted`, `accent` — light neutral grays for layered surfaces
- `destructive` — a single warm red (`oklch(0.577 0.245 27.325)` light / `oklch(0.704 0.191 22.216)` dark) reserved for destructive/error states
- `border`, `input`, `ring` — light gray, transparent-white in dark mode
- `chart-1..5` — a 5-step grayscale ramp for data visualization (campaign/claim charts will need this)

No accent/brand hue is defined yet — the palette is intentionally neutral. Given the anti-reference against generic crypto visual language (no neon gradients), a restrained accent color (if any) should be chosen deliberately later, not defaulted.

## Typography

- Sans: Geist (`--font-geist-sans`), applied as the base `font-sans`
- Mono: Geist Mono (`--font-geist-mono`)
- No display/heading font distinct from body — `--font-heading` currently aliases `--font-sans`

## Shape

- Base radius `0.625rem` (10px), with a full scale derived from it: `sm` (0.6×) through `4xl` (2.6×) — consistent rounding across component sizes rather than ad hoc values.

## Components

Only shadcn/ui's `button.tsx` exists so far (`web/src/components/ui/button.tsx`) — the base component library (radix primitives) is installed but no application components have been built.

## Motion

Not yet defined — `tw-animate-css` is installed but unused. No motion decisions have been made; follow the anti-reference (no excessive/decorative motion) when this is addressed.

## Open items

- No accent/brand color chosen — neutral-only palette is a placeholder, not a final decision.
- No component inventory beyond the shadcn base (button) — will grow once dashboard/claim-portal screens are built.
- Motion language undefined.
- Re-run `/impeccable document` once real screens exist to capture the true, evolved token set.
