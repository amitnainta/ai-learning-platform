import { betterAuth } from "better-auth";
import { buildAuthOptions } from "./options";

export const auth = betterAuth(buildAuthOptions());

// Re-exported for convenience: the reset-password flow already gets this
// via `emailAndPassword.revokeSessionsOnPasswordReset` and an
// `onPasswordReset` hook (see options.ts), and account deletion gets it
// implicitly via the `Session` row's `onDelete: Cascade` relation to
// `User`. This helper is the direct primitive for any other case that
// needs it (e.g. a future in-app change-password flow).
export { revokeAllSessions } from "./revoke-sessions";
