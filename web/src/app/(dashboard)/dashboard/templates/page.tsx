import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookmarkPlus, Layers } from "lucide-react";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { listTemplates } from "@/lib/db/templates";
import { Button } from "@/components/ui/button";
import { DeleteTemplateButton } from "@/components/templates/template-actions";

/**
 * Saved distribution shapes (token + recipient list), reusable as a starting
 * point for a new distribution — built for recurring payroll/rewards rather
 * than one-off runs. Real rows only: a template exists here because it was
 * explicitly saved from the create flow's review step.
 */
export default async function TemplatesPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const userId = await findUserId(session.address);
  const templates = userId ? await listTemplates(userId) : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved token + recipient lists, ready to reuse for a recurring distribution.
          </p>
        </div>
        <Button size="sm" render={<Link href="/dashboard/new" />}>
          New distribution
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-xl border border-border p-5">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {t.tokenSymbol} · {t.recipientCount} recipient{t.recipientCount === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saved {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <Button size="sm" render={<Link href={`/dashboard/new?template=${t.id}`} />}>
                  Use template
                </Button>
                <DeleteTemplateButton id={t.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-background">
        <Layers className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-base font-medium">No templates yet</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Templates save time on recurring distributions — save one from a distribution&apos;s review
        step, and start the next run from it instead of re-entering everything.
      </p>
      <div className="mt-6">
        <Button size="sm" render={<Link href="/dashboard/new" />}>
          <BookmarkPlus />
          Create a distribution
        </Button>
      </div>
    </div>
  );
}
