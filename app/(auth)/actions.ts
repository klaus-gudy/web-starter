"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";

import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, verifyNothing, verifyPassword } from "@/lib/password";
import { getPrisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { setFlash } from "@/lib/set-flash";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function fail(path: string, message: string): Promise<never> {
  await setFlash({ type: "error", message });
  redirect(path);
}

// "Jane Doe" -> "jane-doe-3f9a1c": readable, and the suffix keeps it unique.
function personalSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`;
}

export async function signUp(formData: FormData) {
  const name = field(formData, "name").slice(0, 100);
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return fail("/sign-up", "Enter your name.");
  if (!EMAIL.test(email)) return fail("/sign-up", "Enter a valid email address.");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return fail("/sign-up", `Use a password of at least ${MIN_PASSWORD} characters.`);
  }

  const prisma = getPrisma();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return fail("/sign-up", "An account with this email already exists. Log in instead.");
  }

  const passwordHash = await hashPassword(password);

  // The user, their sign-in method and their personal workspace (with them
  // as owner) are created together or not at all.
  const created = await prisma.$transaction(async (tx) => {
    const owner = await tx.role.findFirstOrThrow({
      where: { organizationId: null, key: "owner" },
      select: { id: true },
    });
    const user = await tx.user.create({
      data: { email, name, lastSignInAt: new Date() },
      select: { id: true },
    });
    await tx.authAccount.create({
      data: { userId: user.id, provider: "password", providerAccountId: user.id, passwordHash },
    });
    const organization = await tx.organization.create({
      data: {
        name: `${name.split(/\s+/)[0]}'s workspace`,
        slug: personalSlug(name),
        isPersonal: true,
        createdById: user.id,
      },
      select: { id: true },
    });
    await tx.membership.create({
      data: { organizationId: organization.id, userId: user.id, roleId: owner.id },
    });
    return { userId: user.id, organizationId: organization.id };
  }).catch((error: unknown) => {
    // Someone signed up with the same email between the check and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  });
  if (!created) return fail("/sign-up", "An account with this email already exists. Log in instead.");

  await createSession(created.userId, created.organizationId);
  await setFlash({ type: "success", message: "Welcome! Your workspace is ready." });
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "").slice(0, MAX_PASSWORD);
  const invalid = "Incorrect email or password.";

  if (!email || !password) return fail("/login", invalid);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      deletedAt: true,
      authAccounts: { where: { provider: "password" }, select: { passwordHash: true } },
    },
  });
  const passwordHash = user && !user.deletedAt ? user.authAccounts[0]?.passwordHash : null;
  const valid = passwordHash
    ? await verifyPassword(password, passwordHash)
    : await verifyNothing(password);
  if (!user || !valid) return fail("/login", invalid);

  // Resume in the personal workspace, else the oldest organization they're in.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "active", organization: { deletedAt: null } },
    orderBy: [{ organization: { isPersonal: "desc" } }, { joinedAt: "asc" }],
    select: { organizationId: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
  await createSession(user.id, membership?.organizationId ?? null);
  redirect("/dashboard");
}

export async function signOut() {
  await deleteSession();
  redirect("/login");
}
