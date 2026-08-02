import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Mounts every Better Auth endpoint (sign-up, sign-in, sign-out, session,
// password reset, email verification, rate limiting) at /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth);
