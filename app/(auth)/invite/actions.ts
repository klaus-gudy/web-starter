"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { findOpenInvitation } from "@/lib/invitations";
import { getPrisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { setFlash } from "@/lib/set-flash";

export async function acceptInvitation(token: string) {
  const page = `/invite/${encodeURIComponent(token)}`;
  const session = await readSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(page)}`);

  const invitation = await findOpenInvitation(token);
  // The page explains what's wrong; just show it again.
  if (!invitation || invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    redirect(page);
  }

  const prisma = getPrisma();
  const joined = await prisma.$transaction(async (tx) => {
    // Claim the invitation first, so a link can't be used twice at once.
    const { count } = await tx.invitation.updateMany({
      where: { id: invitation.id, status: "pending", expiresAt: { gt: new Date() } },
      data: { status: "accepted", acceptedAt: new Date(), acceptedById: session.userId },
    });
    if (!count) return false;

    const organizationId = invitation.organization.id;
    const existing = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.userId } },
      select: { id: true },
    });
    if (!existing) {
      await tx.membership.create({
        data: { organizationId, userId: session.userId, roleId: invitation.roleId },
      });
    }
    // Following the emailed link proves they own the address.
    await tx.user.updateMany({
      where: { id: session.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: organizationId },
    });
    return true;
  });
  if (!joined) redirect(page);

  revalidatePath("/", "layout");
  await setFlash({ type: "success", message: `You joined ${invitation.organization.name}.` });
  redirect("/dashboard");
}
