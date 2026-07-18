import { cn } from "@/lib/utils";

/**
 * DESIGN.md v3 §4/§6: cards float — soft purple-tinted shadow at rest,
 * deepening + lifting a few px on hover. 28px radius, generous 32px padding,
 * a whisper-hairline border (the shadow does the separating, not the border).
 * Never nest a card in a card.
 */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        className,
      )}
      {...props}
    />
  );
}

/** A card that visibly lifts on hover — for interactive/clickable cards. The
 * border warms toward the brand as it lifts, so the hover reads as the card
 * becoming interactive rather than just casting a bigger shadow. */
export function HoverCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Card
      className={cn("hover:-translate-y-1 hover:border-border-strong hover:shadow-md", className)}
      {...props}
    />
  );
}
