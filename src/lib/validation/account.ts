import { z } from "zod";

/**
 * Zod schemas for every auth/account form and API route (NFR-SEC-007:
 * validated, normalized, length-capped input). Password rules follow NIST
 * SP 800-63B (length-based strength, no composition/complexity rules).
 */

const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

// Strip ASCII control characters (e.g. a pasted null byte or terminal
// escape sequence) from user-entered text before it's stored or rendered.
// Implemented as a code-point filter (not a regex control-character
// class) so this source file contains no raw control bytes.
const MAX_CONTROL_CODE_POINT = 31;
const DELETE_CODE_POINT = 127;

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint > MAX_CONTROL_CODE_POINT && codePoint !== DELETE_CODE_POINT;
    })
    .join("");
}

// Exported so server-side call sites that don't go through `signUpSchema`
// wholesale (e.g. the Better Auth `databaseHooks.user.create.before` hook
// in src/lib/auth/options.ts, which re-validates a direct
// `POST /api/auth/sign-up/email` call — see REVIEW.md C2) can reuse the
// exact same name normalization/length-cap/control-character-stripping
// rules instead of duplicating them.
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX_LENGTH, `Name must be ${NAME_MAX_LENGTH} characters or fewer`)
  .transform((value) => stripControlCharacters(value));

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`);

export const roleArchetypeSchema = z.enum([
  "TECHNICAL_BUILDER",
  "ENGINEERING_LEADER",
  "EXECUTIVE_NON_TECHNICAL",
  "INVESTOR",
  "NOT_SURE_YET",
]);

export const proficiencyLevelSchema = z.enum(["ZERO_KNOWLEDGE", "INTERMEDIATE", "ADVANCED"]);

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  minimumAgeAcknowledged: z.literal(true, {
    message: "You must confirm you meet the minimum age requirement to register",
  }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing or invalid reset token"),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const profileSchema = z.object({
  roleArchetype: roleArchetypeSchema,
  level: proficiencyLevelSchema,
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const deleteAccountSchema = z.object({
  confirmEmail: z.string(),
  accountEmail: z.string(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/**
 * Case-sensitive, whitespace-sensitive exact match between the typed
 * confirmation and the signed-in user's actual email (decision #2:
 * "the gate is the typed email only"). No trimming/normalization — a
 * mismatched case or stray space must keep the confirm action disabled.
 */
export function deleteConfirmationMatches(input: DeleteAccountInput): boolean {
  return input.confirmEmail === input.accountEmail;
}
