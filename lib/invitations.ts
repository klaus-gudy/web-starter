import { getPrisma } from "@/lib/prisma"
import { hashToken } from "@/lib/tokens"

/**
 * The invitation behind a link's token, if it can still be accepted: pending,
 * not expired, and for an organization that still exists.
 */
export async function findOpenInvitation(token: string) {
  const invitation = await getPrisma().invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      roleId: true,
      role: { select: { name: true } },
      organization: { select: { id: true, name: true, deletedAt: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  })
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt <= new Date() ||
    invitation.organization.deletedAt
  ) {
    return null
  }
  return invitation
}
