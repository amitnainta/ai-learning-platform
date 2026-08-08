import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// GET /api/account/export — FR-ACC-007, NFR-COMP-004: a downloadable JSON
// export of the requesting user's own personal data. Deliberately
// excludes the password hash and every session/verification token — only
// non-secret metadata about sessions (created/last-used timestamps, IP,
// user agent) is included. Also includes the user's progress rows
// (decision #9, factory/work/progress-tracking/PLAN.md) and, as of the
// ratings-and-feedback work item, the user's ratings and rating flags
// (decision #9, factory/work/ratings-and-feedback/PLAN.md) — "what I rated"
// and "what I reported" are unambiguously the user's own data. Carries
// target **slugs and titles**, never cuids, so the file is meaningful to a
// human reading it — the one exception is the rating id inside
// `ratingFlags`, the only identifier a flagged rating has, already exposed
// to the client by the flag control.
export async function GET() {
  const user = await requireUser();

  const [profile, sessions, progress, ratings, ratingFlags] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        roleArchetype: true,
        level: true,
        onboardingCompletedAt: true,
        minimumAgeAcknowledgedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.session.findMany({
      where: { userId: user.id },
      select: {
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
    prisma.progress.findMany({
      where: { userId: user.id },
      select: {
        status: true,
        createdAt: true,
        lastViewedAt: true,
        completedAt: true,
        contentItem: { select: { slug: true, title: true } },
      },
    }),
    prisma.rating.findMany({
      where: { userId: user.id },
      select: {
        stars: true,
        feedback: true,
        hiddenAt: true,
        createdAt: true,
        updatedAt: true,
        course: { select: { slug: true, title: true } },
        path: { select: { slug: true, title: true } },
      },
    }),
    prisma.ratingFlag.findMany({
      where: { userId: user.id },
      select: { ratingId: true, reason: true, note: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    profile,
    sessions,
    progress: progress.map((row) => ({
      slug: row.contentItem.slug,
      title: row.contentItem.title,
      status: row.status,
      startedAt: row.createdAt,
      lastViewedAt: row.lastViewedAt,
      completedAt: row.completedAt,
    })),
    ratings: ratings.map((row) => ({
      targetType: row.course ? ("course" as const) : ("path" as const),
      targetSlug: row.course ? row.course.slug : row.path!.slug,
      targetTitle: row.course ? row.course.title : row.path!.title,
      stars: row.stars,
      feedback: row.feedback,
      hidden: row.hiddenAt !== null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    ratingFlags: ratingFlags.map((row) => ({
      ratingId: row.ratingId,
      reason: row.reason,
      note: row.note,
      createdAt: row.createdAt,
      resolved: row.resolvedAt !== null,
    })),
  };

  const fileName = `account-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
