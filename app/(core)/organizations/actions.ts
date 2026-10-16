"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createOrganizationWithOwner } from "@/lib/organizations";
import { getPrisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { setFlash } from "@/lib/set-flash";

/** Makes another of the user's organizations the active one for this session. */
export async function switchOrganization(organizationId: string) {
  const session = await readSession();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.userId } },
    select: { status: true, organization: { select: { name: true, deletedAt: true } } },
  });
  if (!membership || membership.status !== "active" || membership.organization.deletedAt) {
    return { success: false, message: "You're not a member of that organization." };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeOrganizationId: organizationId },
  });
  // Everything on screen belongs to the old organization: drop the client cache.
  revalidatePath("/", "layout");
  return { success: true, message: `Switched to ${membership.organization.name}.` };
}

export async function createOrganization(formData: FormData) {
  const session = await readSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) {
    await setFlash({ type: "error", message: "Enter a name for the organization." });
    redirect("/organizations/new");
  }

  const prisma = getPrisma();
  const organization = await prisma.$transaction((tx) =>
    createOrganizationWithOwner(tx, { name, userId: session.userId })
  );
  await prisma.session.update({
    where: { id: session.id },
    data: { activeOrganizationId: organization.id },
  });

  revalidatePath("/", "layout");
  await setFlash({ type: "success", message: `Created ${name}. Invite your team.` });
  redirect("/members");
}
