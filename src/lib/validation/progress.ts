import { z } from "zod";

/**
 * Zod schema for `POST /api/progress` (task 3). Follows the conventions in
 * `src/lib/validation/account.ts` (trim, length cap, explicit messages).
 * The endpoint is addressed by slug, not id (decision #3,
 * factory/work/progress-tracking/PLAN.md) — every UI surface already
 * carries slugs, and this keeps the client from ever supplying a cuid.
 */

const CONTENT_ITEM_SLUG_MAX_LENGTH = 200;

// Lowercase alphanumerics and hyphens, must start with an alphanumeric —
// matches the shape every real content-item slug takes
// (src/lib/content/loader.ts) and rejects path traversal (`../`) or
// uppercase input outright, rather than relying on the database lookup to
// reject it.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const progressActionSchema = z.object({
  contentItemSlug: z
    .string()
    .trim()
    .min(1, "contentItemSlug is required")
    .max(
      CONTENT_ITEM_SLUG_MAX_LENGTH,
      `contentItemSlug must be ${CONTENT_ITEM_SLUG_MAX_LENGTH} characters or fewer`,
    )
    .regex(SLUG_PATTERN, "contentItemSlug must be lowercase alphanumerics and hyphens"),
  action: z.enum(["view", "complete", "reopen"], {
    message: "action must be one of: view, complete, reopen",
  }),
});

export type ProgressActionInput = z.infer<typeof progressActionSchema>;
