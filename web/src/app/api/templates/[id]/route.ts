import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { getTemplate, deleteTemplate } from "@/lib/db/templates";
import { getDistribution, getRecipients } from "@/lib/db/distribution";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await findUserId(session.address);
  if (!userId) return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });

  // Try to load as a saved template first
  const template = userId ? await getTemplate(id, userId) : null;
  if (template) {
    return NextResponse.json({ template });
  }

  // If not a template, try to load as a draft distribution (so drafts can be reused)
  const dist = await getDistribution(id, userId);
  if (dist && dist.status === "draft") {
    const recipients = await getRecipients(id);
    const converted = {
      id: dist.id,
      name: dist.name,
      tokenAddress: dist.tokenAddress,
      tokenSymbol: dist.tokenSymbol,
      tokenDecimals: dist.tokenDecimals,
      recipientCount: recipients.length,
      recipients: recipients.map((r) => ({
        address: r.address,
        amount: r.amount,
      })),
      createdAt: dist.createdAt,
    };
    return NextResponse.json({ template: converted });
  }

  return NextResponse.json({ error: "Template not found." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await findUserId(session.address);
  if (!userId) return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });

  const deleted = await deleteTemplate(id, userId);
  if (!deleted) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
