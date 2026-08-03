import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// GET /api/account/export — FR-ACC-007, NFR-COMP-004: a downloadable JSON
// export of the requesting user's own personal data. Deliberately
// excludes the password hash and every session/verification token — only
// non-secret metadata about sessions (created/last-used timestamps, IP,
// user agent) is included. Also includes the user's progress rows
// (decision #9, factory/work/progress-tracking/PLAN.md) — "what I have
// completed" is unambiguously the user's own data. Carries the item
// **slug and title**, never the cuid, so the file is meaningful to a
// human reading it.
export async function GET() {
  const user = await requireUser();

  const [profile, sessions, progress] = await Promise.all([
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
