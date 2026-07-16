/**
 * Client-side auth API helpers. Thin typed wrappers over the /api/auth
 * routes. No secrets, no server-only imports — safe in client components.
 */

export interface SessionResponse {
  address: string | null;
  chainId?: number;
}

export async function fetchSession(): Promise<SessionResponse> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load session.");
  return res.json();
}

export async function fetchNonce(): Promise<string> {
  const res = await fetch("/api/auth/nonce", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to obtain a sign-in nonce.");
  const { nonce } = (await res.json()) as { nonce: string };
  return nonce;
}

export async function verifySignature(message: string, signature: string): Promise<string> {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ message, signature }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error ?? "Sign-in verification failed.");
  }
  const { address } = (await res.json()) as { address: string };
  return address;
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to sign out.");
}
