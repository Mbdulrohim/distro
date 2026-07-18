"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookmarkPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TokenSelector } from "@/components/tokens/token-selector";
import { RecipientManager } from "@/components/recipients/recipient-manager";
import { DistributionReview } from "@/components/distributions/distribution-review";
import { useAccount } from "wagmi";
import {
  isMultisendDeployed,
  getMultisendAddress,
  getMultisendNativeAddress,
  isDistributionFactoryDeployed,
} from "@/config/contracts";
import { ExecutePanel } from "@/components/distributions/execute-panel";
import { ScheduledExecutePanel } from "@/components/distributions/scheduled-execute-panel";
import { SchedulePicker } from "@/components/distributions/schedule-picker";
import { formatAmount } from "@/lib/recipients/format";
import type { TokenRef, TokenSelection } from "@/lib/tokens/types";
import type { ValidRecipient } from "@/lib/recipients/types";
import type { ScheduleDraft } from "@/lib/schedule/types";
import type { TemplateDetail } from "@/lib/db/templates";

type Step = "details" | "recipients" | "schedule" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "details", label: "Token" },
  { id: "recipients", label: "Recipients" },
  { id: "schedule", label: "Schedule" },
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
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const { chainId } = useAccount();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [token, setToken] = useState<TokenSelection | undefined>();
  const [recipients, setRecipients] = useState<ValidRecipient[]>([]);
  const [recipientsOk, setRecipientsOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [escrowSalt, setEscrowSalt] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  // Two distinct failure modes, kept in separate state: loading the starting
  // template (details step) and saving a new one (review step) can fail
  // independently, and conflating them into one variable would let a stale
  // message from one step bleed into the other's error slot.
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  // A template only pre-fills — it never auto-submits. The user still walks
  // Token -> Recipients -> Review, so nothing sends without the same
  // deliberate review every other distribution gets.
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    fetch(`/api/templates/${templateId}`, { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load that template.");
        const body = (await res.json()) as { template: TemplateDetail };
        if (cancelled) return;
        setTemplate(body.template);
        setName(body.template.name);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setTemplateLoadError(e instanceof Error ? e.message : "Failed to load template.");
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const [schedule, setSchedule] = useState<ScheduleDraft>({ mode: "now" });
  const [scheduleValid, setScheduleValid] = useState(true);
  const schedulingAvailable = chainId !== undefined && isDistributionFactoryDeployed(chainId);

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

  // Native MON (address undefined) is only ever `distributable` in scheduled
  // mode (see useTokenInfo), so this doesn't need its own mode check here.
  const tokenReady =
    token !== undefined && token.distributable && (token.address !== undefined || token.isNative);
  const canLeaveDetails = name.trim() !== "" && tokenReady;
  const canLeaveRecipients = canLeaveDetails && recipients.length > 0 && recipientsOk;
  const canReview = canLeaveRecipients && scheduleValid;

  async function onConfirm() {
    if (!token || (!token.address && !token.isNative)) return;
    const scheduled = schedule.mode === "scheduled";
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
          // Native MON has no ERC-20 address; the escrow's own address(0)
          // sentinel is what the scheduled path actually needs on-chain, but
          // the DB column stores a real value for the immediate/ERC-20 case
          // only — token.address is always present for ERC-20.
          tokenAddress: token.address ?? "0x0000000000000000000000000000000000000000",
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          // Whichever immediate-path contract will actually execute this —
          // MultisendNative for native MON, Multisend for everything else —
          // so the recorded address matches what really moves the money.
          multisendAddress: scheduled
            ? undefined
            : token.isNative
              ? getMultisendNativeAddress(chainId!)
              : getMultisendAddress(chainId!),
          recipients: recipients.map((r) => ({
            address: r.address,
            amount: r.amount.toString(),
          })),
          kind: scheduled ? "scheduled" : "immediate",
          executeAfter: scheduled ? (schedule.executeAt ?? 0) : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save the distribution.");
      }
      const { id, salt: savedSalt } = (await res.json()) as {
        id: string;
        salt: `0x${string}` | null;
      };
      setSavedId(id);
      setEscrowSalt(savedSalt);
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSaving(false);
    }
  }

  async function onSaveTemplate() {
    if (!token?.address) return;
    setSavingTemplate(true);
    setTemplateSaveError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          recipients: recipients.map((r) => ({
            address: r.address,
            amount: r.amount.toString(),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save the template.");
      }
      setTemplateSaved(true);
    } catch (e) {
      setTemplateSaveError(e instanceof Error ? e.message : "Could not save the template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-12">
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Distributions
      </button>

      <h1 className="mb-8 text-3xl font-semibold tracking-tight">New distribution</h1>
      <StepRail current={step} />

      <Card className="mt-8 p-6 sm:p-8">
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

            {templateLoadError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2 text-sm text-destructive">
                {templateLoadError}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Token</span>
              <TokenSelector
                onSelect={setToken}
                initialRef={template?.tokenAddress as TokenRef | undefined}
              />
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
              initialRows={template?.recipients.map((r) => ({
                address: r.address,
                amount: formatAmount(BigInt(r.amount), token.decimals),
              }))}
            />
            <div className="flex justify-between">
              <Button variant="secondary" size="sm" onClick={() => setStep("details")}>
                Back
              </Button>
              <Button size="sm" disabled={!canLeaveRecipients} onClick={() => setStep("schedule")}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === "schedule" ? (
          <div className="flex flex-col gap-6">
            <SchedulePicker
              value={schedule}
              schedulingAvailable={schedulingAvailable}
              onChange={(draft, valid) => {
                setSchedule(draft);
                setScheduleValid(valid);
              }}
            />
            <div className="flex justify-between">
              <Button variant="secondary" size="sm" onClick={() => setStep("recipients")}>
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
              {schedule.mode === "scheduled" && escrowSalt ? (
                <ScheduledExecutePanel
                  distributionId={savedId}
                  token={token}
                  recipients={recipients}
                  executeAfter={schedule.executeAt ?? 0}
                  salt={escrowSalt}
                  onComplete={() => router.push(`/dashboard/${savedId}`)}
                />
              ) : (
                <ExecutePanel
                  distributionId={savedId}
                  token={token}
                  recipients={recipients}
                  onComplete={() => router.push(`/dashboard/${savedId}`)}
                />
              )}
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

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={savingTemplate || templateSaved}
                  onClick={onSaveTemplate}
                >
                  <BookmarkPlus />
                  {templateSaved
                    ? "Saved as template"
                    : savingTemplate
                      ? "Saving…"
                      : "Save as template"}
                </Button>
                {templateSaveError ? (
                  <span className="text-xs text-destructive">{templateSaveError}</span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Saves the token and recipient list for reuse — not this run itself. Reuse it from{" "}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/templates")}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Templates
                </button>
                .
              </p>

              {chainId !== undefined && !isMultisendDeployed(chainId) ? (
                <p className="text-xs text-muted-foreground">
                  Heads up: Distro isn&apos;t deployed on this network, so this distribution can be
                  saved as a draft but not sent from here.
                </p>
              ) : null}
            </div>
          )
        ) : null}
      </Card>
    </div>
  );
}

function StepRail({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-light-purple text-primary-text"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                aria-hidden
                className={cn(
                  "mx-2 h-px flex-1 transition-colors sm:mx-4",
                  done ? "bg-primary" : "bg-border",
                )}
                style={{ marginBottom: "1.25rem" }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
