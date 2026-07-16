import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { CreateFlow } from "./create-flow";

/**
 * Create a distribution. Middleware guards the route; this re-verifies the
 * session server-side (defence in depth) before rendering anything
 * authenticated.
 */
export default async function NewDistributionPage() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  return <CreateFlow />;
}
