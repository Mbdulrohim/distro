"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TokenSelector } from "@/components/tokens/token-selector";
import { RecipientManager } from "@/components/recipients/recipient-manager";
import { DistributionReview } from "@/components/distributions/distribution-review";
import { useAccount } from "wagmi";
import { isMultisendDeployed, getMultisendAddress } from "@/config/contracts";
import { ExecutePanel } from "@/components/distributions/execute-panel";
import type { TokenSelection } from "@/lib/tokens/types";
import type { ValidRecipient } from "@/lib/recipients/types";
import type { ScheduleDraft } from "@/lib/schedule/types";

type Step = "details" | "recipients" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "details", label: "Token" },
  { id: "recipients", label: "Recipients" },
  { id: "review", label: "Review" },
];

/**
 * The create flow — one route, client-driven steps, so a wallet round-trip or a
 * back-navigation never loses work.
 *
 * Client validation is for fast feedback only; the server re-validates
 * authoritatively on submit and recomputes the total from the rows.
 *
 * Saving and sending are two distinct acts, in that order. The draft is
 * persisted first so a record exists no matter what the wallet does next —
 * then `ExecutePanel` moves the money. The send only appears once the draft
 * is saved, and only on a chain where `Multisend` is actually deployed;
 * otherwise it says so plainly rather than offering a button that can't work.
 */
export function CreateFlow() {
  const router = useRouter();
  const { chainId } = useAccount();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [token, setToken] = useState<TokenSelection | undefined>();
  const [recipients, setRecipients] = useState<ValidRecipient[]>([]);
  const [recipientsOk, setRecipientsOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execute-now is the only mode the deployed stack supports; the scheduled
  // branch needs the escrow contracts.
  const schedule: ScheduleDraft = { mode: "now" };

  // Stable identity: RecipientManager emits on every validation change, so an
  // inline closure would re-fire its effect on every render.
  //
  // The emitted total is deliberately dropped: the review component derives its
  // own from `recipients`, and the server recomputes it authoritatively. Three
  // copies of one number is three chances for them to disagree about money.
  const handleRecipients = useCallback(
    (v: { valid: ValidRecipient[]; total: bigint; ok: boolean }) => {
      setRecipients(v.valid);
      setRecipientsOk(v.ok);
    },
    [],
  );

  const tokenReady = token !== undefined && token.distributable && token.address !== undefined;
  const canLeaveDetails = name.trim() !== "" && tokenReady;
  const canReview = canLeaveDetails && recipients.length > 0 && recipientsOk;

  async function onConfirm() {
    if (!token?.address) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          chainId: chainId!,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          multisendAddress: getMultisendAddress(chainId!),
          recipients: recipients.map((r) => ({
            address: r.address,
            amount: r.amount.toString(),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save the distribution.");
      }
      const { id } = (await res.json()) as { id: string };
      setSavedId(id);
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Distributions
      </button>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New distribution</h1>
      <StepRail current={step} />

      <div className="mt-8">
        {step === "details" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dist-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="dist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="March payroll"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Token</span>
              <TokenSelector onSelect={setToken} />
            </div>

            <div className="flex justify-end">
              <Button size="sm" disabled={!canLeaveDetails} onClick={() => setStep("recipients")}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === "recipients" && token ? (
          <div className="flex flex-col gap-6">
            <RecipientManager
              decimals={token.decimals}
              tokenSymbol={token.symbol}
              balance={token.balance}
              onChange={handleRecipients}
            />
            <div className="flex justify-between">
              <Button variant="secondary" size="sm" onClick={() => setStep("details")}>
                Back
              </Button>
              <Button size="sm" disabled={!canReview} onClick={() => setStep("review")}>
                Review
              </Button>
            </div>
          </div>
        ) : null}

        {/* Review and send are two acts, and only one is ever on screen. Before
            save: the review, whose button says "Continue to send" (it saves a
            draft — it must not claim to distribute). After save: the send step
            alone, so there are never two competing distribute buttons (punch
            list P0). */}
        {step === "review" && token ? (
          savedId ? (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Send {name || "distribution"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Draft saved. This step moves real tokens and cannot be undone.
                </p>
              </div>
              <ExecutePanel
                distributionId={savedId}
                token={token}
                recipients={recipients}
                onComplete={() => router.push(`/dashboard/${savedId}`)}
              />
              <button
                onClick={() => router.push(`/dashboard/${savedId}`)}
                className="self-start text-sm text-muted-foreground hover:text-foreground"
              >
                View distribution →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <DistributionReview
                name={name}
                token={token}
                recipients={recipients}
                schedule={schedule}
                balance={token.balance}
                confirmLabel="Continue to send"
                onEdit={() => setStep("recipients")}
                onCancel={() => router.push("/dashboard")}
                onConfirm={onConfirm}
                isConfirming={saving}
              />
              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}
              {chainId !== undefined && !isMultisendDeployed(chainId) ? (
                <p className="text-xs text-muted-foreground">
                  Heads up: Distro isn&apos;t deployed on this network, so this distribution can be
                  saved as a draft but not sent from here.
                </p>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function StepRail({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={
                active
                  ? "font-medium text-foreground"
                  : done
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span aria-hidden className="text-muted-foreground/40">
                —
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
