import { randomBytes } from "node:crypto"

import type { Prisma } from "@/lib/generated/prisma/client"

// "Acme Inc." -> "acme-inc-3f9a1c": readable, and the suffix keeps it unique.
export function uniqueSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`
}

/** Creates an organization with the user as its owner. Run inside a transaction. */
export async function createOrganizationWithOwner(
  tx: Prisma.TransactionClient,
  { name, userId, isPersonal = false }: { name: string; userId: string; isPersonal?: boolean }
) {
  const owner = await tx.role.findFirstOrThrow({
    where: { organizationId: null, key: "owner" },
    select: { id: true },
  })
  const organization = await tx.organization.create({
    data: { name, slug: uniqueSlug(name), isPersonal, createdById: userId },
    select: { id: true },
  })
  await tx.membership.create({
    data: { organizationId: organization.id, userId, roleId: owner.id },
  })
  return organization
}
