import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { progressActionSchema } from "@/lib/validation/progress";
import {
  markComplete,
  recordView,
  reopen,
  resolvePublishedContentItemBySlug,
} from "@/lib/progress/mutations";

// POST /api/progress — decision #3 (factory/work/progress-tracking/PLAN.md):
// one write endpoint, an action vocabulary (`view` | `complete` | `reopen`),
// addressed by slug. Every write is scoped to the session user
// (NFR-SEC-004) — the body never supplies a userId or a contentItemId, only
// a slug resolved server-side against published content.
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = progressActionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const contentItem = await resolvePublishedContentItemBySlug(result.data.contentItemSlug);
  if (!contentItem) {
    return NextResponse.json({ success: false, error: "Content item not found" }, { status: 404 });
  }

  const identity = { userId: user.id, contentItemId: contentItem.id };

  const progress =
    result.data.action === "view"
      ? await recordView(identity)
      : result.data.action === "complete"
        ? await markComplete(identity)
        : await reopen(identity);

  return NextResponse.json({
    success: true,
    progress: {
      status: progress.status,
      lastViewedAt: progress.lastViewedAt,
      completedAt: progress.completedAt,
    },
  });
}
