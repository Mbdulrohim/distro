import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Route protection. Any path under /dashboard requires a valid SIWE session;
 * unauthenticated requests are redirected to the sign-in surface (home) with
 * a `redirect` param so the user lands back where they intended after login.
 *
 * Runs on the Edge runtime — jose (not node:crypto) is used for verification
 * precisely so this works here.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
