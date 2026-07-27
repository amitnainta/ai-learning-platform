import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Optimistic, cookie-presence-only route protection (FR-ACC-008).
 *
 * IMPORTANT: this is a UX fast path, not the security boundary. Middleware
 * runs on the Edge runtime and cannot call Prisma, so it can only check
 * whether a session cookie *looks* present — it never validates the
 * session against the database. The authoritative check is
 * `requireUser()`/`requireOnboardedUser()` (src/lib/auth/session.ts),
 * called from every protected server component and route handler. An
 * expired/revoked cookie that passes this check is still correctly
 * rejected there.
 *
 * Only the "no cookie -> bounce off a protected path" direction lives here.
 * The reverse ("already signed in -> bounce off /sign-in or /sign-up") is
 * deliberately NOT handled by a presence-only check: a stale cookie left
 * over from a revoked session (password reset, logout elsewhere) would
 * otherwise ping-pong forever between a protected page (whose authoritative
 * check redirects to /sign-in because the session is actually invalid) and
 * /sign-in (which this middleware would then bounce back to /dashboard
 * purely because the — invalid — cookie is still present). That redirect
 * instead lives in the sign-in/sign-up pages themselves
 * (src/app/(auth)/sign-in/page.tsx, sign-up/page.tsx), which call the real
 * `getCurrentUser()` check and only redirect when a session actually
 * validates.
 */

const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/account"];

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE_NAME) ||
    request.cookies.has(`__Secure-${SESSION_COOKIE_NAME}`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasSessionCookie(request) && PROTECTED_PATHS.some((path) => pathname.startsWith(path))) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/account/:path*"],
};
