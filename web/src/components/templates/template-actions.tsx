"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Delete action for a template row. Optimistic-rollback pattern: the row
 * only disappears once the server confirms the delete, so a failure never
 * leaves the UI showing a template that's still really there.
 */
export function DeleteTemplateButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm("Delete this template? This can't be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Could not delete the template.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the template.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={deleting}
        onClick={onDelete}
        aria-label="Delete template"
      >
        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
