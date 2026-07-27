import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { auth } from "@/lib/auth";
import { deleteConfirmationMatches } from "@/lib/validation/account";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail/mailer";
import { accountDeletedTemplate } from "@/lib/mail/templates";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

// DELETE /api/account — FR-ACC-007, decision #2: immediate hard delete on
// typed confirmation. `prisma.user.delete` cascades Session/Account rows.
// The confirmation email is best-effort and logged-not-thrown on failure —
// it must never leave the account undeleted.
export async function DELETE(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const confirmEmail =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).confirmEmail
      : undefined;
  if (typeof confirmEmail !== "string") {
    return NextResponse.json(
      { success: false, error: "confirmEmail is required" },
      { status: 400 },
    );
  }

  if (!deleteConfirmationMatches({ confirmEmail, accountEmail: user.email })) {
    return NextResponse.json(
      { success: false, error: "Typed email does not match your account email" },
      { status: 400 },
    );
  }

  const { name, email } = user;

  await prisma.user.delete({ where: { id: user.id } });

  // Clears the session cookie in the response. The session row is already
  // gone (cascaded by the user delete above); this only needs to stop the
  // browser from sending a now-meaningless token.
  await auth.api.signOut({ headers: await nextHeaders() }).catch(() => {
    // Best-effort: the underlying session row no longer exists either way.
  });

  try {
    const template = accountDeletedTemplate({ name });
    await sendMail({ to: email, ...template });
  } catch (error) {
    // NFR requirement (decision #2): a failed confirmation email must
    // never roll back or block the deletion that already happened.
    console.error("Failed to send account-deleted confirmation email", error);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
