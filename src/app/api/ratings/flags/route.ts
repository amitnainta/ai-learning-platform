import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ratingFlagSchema } from "@/lib/validation/rating";
import { prisma } from "@/lib/prisma";
import { flagRating } from "@/lib/ratings/mutations";

/**
 * POST /api/ratings/flags (task 11, FR-RATE-006). Deliberately reveals
 * nothing about the rating beyond existence: an absent or already-hidden
 * rating and a self-flag both return generic, non-leaking errors. Flagging
 * your own rating is rejected (decision #5) — a report is only meaningful
 * from someone other than the author.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ratingFlagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const rating = await prisma.rating.findFirst({
    where: { id: parsed.data.ratingId, hiddenAt: null },
    select: { id: true, userId: true },
  });
  if (!rating) {
    return NextResponse.json({ success: false, error: "Rating not found" }, { status: 404 });
  }

  if (rating.userId === user.id) {
    return NextResponse.json(
      { success: false, error: "You cannot flag your own rating" },
      { status: 400 },
    );
  }

  await flagRating({
    ratingId: rating.id,
    userId: user.id,
    reason: parsed.data.reason,
    note: parsed.data.note,
  });

  return NextResponse.json({ success: true });
}
