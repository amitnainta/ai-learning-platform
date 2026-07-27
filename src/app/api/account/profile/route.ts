import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { profileSchema } from "@/lib/validation/account";
import { prisma } from "@/lib/prisma";

// PATCH /api/account/profile — FR-ACC-004/005/006: set or change role and
// level. Setting both for the first time also stamps
// `onboardingCompletedAt`.
export async function PATCH(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = profileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      roleArchetype: result.data.roleArchetype,
      level: result.data.level,
      onboardingCompletedAt: user.onboardingCompletedAt ?? new Date(),
    },
    select: {
      roleArchetype: true,
      level: true,
      onboardingCompletedAt: true,
    },
  });

  return NextResponse.json({ success: true, profile: updated });
}
