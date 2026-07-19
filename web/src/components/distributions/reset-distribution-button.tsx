"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResetDistributionButton({ distributionId }: { distributionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (!window.confirm("Reset this failed distribution to a draft?")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/distributions/${distributionId}/reset`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not reset the distribution.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset the distribution.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={reset} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Reset to draft
      </Button>
      {error ? <p className="max-w-64 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
