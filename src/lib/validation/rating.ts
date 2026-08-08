import { z } from "zod";
import { normalizeMultilineText } from "./text";

/**
 * Zod schemas for `POST`/`DELETE /api/ratings` and `POST /api/ratings/flags`
 * (task 5). Follows the conventions in `src/lib/validation/account.ts` and
 * `src/lib/validation/progress.ts` (trim, length cap, explicit messages).
 * Every write is addressed by slug (decision #1's targets are
 * `Course`/`Path`, resolved server-side against published content), never
 * by a client-supplied cuid.
 */

const TARGET_SLUG_MAX_LENGTH = 200;
export const FEEDBACK_MAX_LENGTH = 2000;
export const FLAG_NOTE_MAX_LENGTH = 500;
const RATING_ID_MAX_LENGTH = 50;

// Lowercase alphanumerics and hyphens, must start with an alphanumeric —
// matches the shape every real course/path slug takes
// (src/lib/content/loader.ts), same pattern as progress.ts's
// `contentItemSlug`.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// Prisma cuid()s are lowercase alphanumeric, ~25 characters. Not a strict
// cuid format check (Prisma doesn't guarantee the exact charset forever) —
// just a shape/length sanity cap so a pathological id can't be POSTed.
const ID_PATTERN = /^[a-z0-9]+$/;

export const ratingTargetSchema = z.object({
  targetType: z.enum(["course", "path"], { message: "targetType must be course or path" }),
  targetSlug: z
    .string()
    .trim()
    .min(1, "targetSlug is required")
    .max(TARGET_SLUG_MAX_LENGTH, `targetSlug must be ${TARGET_SLUG_MAX_LENGTH} characters or fewer`)
    .regex(SLUG_PATTERN, "targetSlug must be lowercase alphanumerics and hyphens"),
});
export type RatingTargetInput = z.infer<typeof ratingTargetSchema>;

const starsSchema = z
  .number({ message: "stars must be a number" })
  .int("stars must be a whole number")
  .min(1, "stars must be between 1 and 5")
  .max(5, "stars must be between 1 and 5");

// Empty-after-normalization feedback becomes `null` (decision #7) so "rated
// without commenting" is one state, not two. The max-length check runs
// *after* normalization so padding tricks can't smuggle length past the cap.
const feedbackSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return null;
    }
    const normalized = normalizeMultilineText(value);
    return normalized.length === 0 ? null : normalized;
  })
  .refine((value) => value === null || value.length <= FEEDBACK_MAX_LENGTH, {
    message: `feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer`,
  });

export const ratingSubmissionSchema = ratingTargetSchema.extend({
  stars: starsSchema,
  feedback: feedbackSchema,
});
export type RatingSubmissionInput = z.infer<typeof ratingSubmissionSchema>;

export const ratingRemovalSchema = ratingTargetSchema;
export type RatingRemovalInput = z.infer<typeof ratingRemovalSchema>;

export const ratingFlagReasonSchema = z.enum(
  ["INAPPROPRIATE", "SPAM", "OUTDATED_OR_INCORRECT", "OTHER"],
  { message: "reason must be one of: INAPPROPRIATE, SPAM, OUTDATED_OR_INCORRECT, OTHER" },
);

const flagNoteSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return null;
    }
    const normalized = normalizeMultilineText(value);
    return normalized.length === 0 ? null : normalized;
  })
  .refine((value) => value === null || value.length <= FLAG_NOTE_MAX_LENGTH, {
    message: `note must be ${FLAG_NOTE_MAX_LENGTH} characters or fewer`,
  });

export const ratingFlagSchema = z.object({
  ratingId: z
    .string()
    .trim()
    .min(1, "ratingId is required")
    .max(RATING_ID_MAX_LENGTH, `ratingId must be ${RATING_ID_MAX_LENGTH} characters or fewer`)
    .regex(ID_PATTERN, "ratingId is not a valid id"),
  reason: ratingFlagReasonSchema,
  note: flagNoteSchema,
});
export type RatingFlagInput = z.infer<typeof ratingFlagSchema>;
