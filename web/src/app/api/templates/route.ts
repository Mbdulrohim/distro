import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isAddress } from "viem";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { findUserId } from "@/lib/db/users";
import { listTemplates, createTemplate } from "@/lib/db/templates";

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  tokenAddress: z.string().refine(isAddress, "Invalid token address."),
  tokenSymbol: z.string().trim().min(1).max(32),
  tokenDecimals: z.number().int().min(0).max(36),
  recipients: z
    .array(
      z.object({
        address: z.string().refine(isAddress, "Invalid recipient address."),
        // Base units — validated as a positive integer string, not parsed as
        // a JS number, so it survives amounts bigger than 2^53.
        amount: z.string().regex(/^[1-9]\d*$/, "Amount must be a positive integer string."),
      }),
    )
    .min(1),
});

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await findUserId(session.address);
  const templates = userId ? await listTemplates(userId) : [];
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const userId = await findUserId(session.address);
  if (!userId) return NextResponse.json({ error: "Account not provisioned." }, { status: 409 });

  const id = await createTemplate(userId, parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}

export const dynamic = "force-dynamic";
