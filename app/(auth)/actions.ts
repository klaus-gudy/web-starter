"use server";

import { redirect } from "next/navigation";

import { Prisma } from "@/lib/generated/prisma/client";
import {
  createOrganizationWithOwner,
  isOrganizationNameTaken,
  normalizeOrganizationName,
} from "@/lib/organizations";
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

// Where to go after signing in: a path inside this app, from the form's
// "next" field (set when an invitation link sent someone to log in).
function nextPath(formData: FormData) {
  const next = field(formData, "next");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

// Back to the form, keeping where to go after signing in.
function formPath(path: string, next: string | null) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export type OrganizationCheck = { message: string; name?: string; available?: string };

/** Sign-up step 1: whether the organization name is still free. */
export async function checkOrganizationName(
  _previous: OrganizationCheck,
  formData: FormData
): Promise<OrganizationCheck> {
  const name = normalizeOrganizationName(field(formData, "organization"));
  if (!name) return { message: "Enter your organization's name." };
  if (await isOrganizationNameTaken(name)) {
    return { message: `${name} is already taken. Try another name.`, name };
  }
  return { message: "", available: name };
}

export type SignUpState = {
  message: string;
  /** Set when the organization name was taken after step 1: go back to it. */
  organizationTaken?: boolean;
  name?: string;
  email?: string;
};

/** Sign-up step 2. Errors come back to the form so it keeps what was typed. */
export async function signUp(
  _previous: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const name = field(formData, "name").slice(0, 100);
  const organizationName = normalizeOrganizationName(field(formData, "organization"));
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = nextPath(formData);
  const error = (message: string): SignUpState => ({ message, name, email });
  const taken: SignUpState = {
    message: `${organizationName} was just taken. Pick another name.`,
    organizationTaken: true,
  };

  // Someone following an invitation joins that organization instead.
  const invited = next?.startsWith("/invite/") ?? false;

  if (!invited && !organizationName) {
    return { message: "Enter your organization's name.", organizationTaken: true };
  }
  if (!name) return error("Enter your name.");
  if (!EMAIL.test(email)) return error("Enter a valid email address.");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return error(`Use a password of at least ${MIN_PASSWORD} characters.`);
  }

  const prisma = getPrisma();
  const emailTaken = "An account with this email already exists. Log in instead.";
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return error(emailTaken);
  }
  if (!invited && (await isOrganizationNameTaken(organizationName))) return taken;

  const passwordHash = await hashPassword(password);

  // The user, their sign-in method and their organization (with them as
  // owner) are created together or not at all.
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, lastSignInAt: new Date() },
      select: { id: true },
    });
    await tx.authAccount.create({
      data: { userId: user.id, provider: "password", providerAccountId: user.id, passwordHash },
    });
    const organization = invited
      ? null
      : await createOrganizationWithOwner(tx, { name: organizationName, userId: user.id });
    return { userId: user.id, organizationId: organization?.id ?? null };
  }).catch((error: unknown) => {
    // Someone took the email or organization name between the check and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  });
  if (!created) {
    return !invited && (await isOrganizationNameTaken(organizationName))
      ? taken
      : error(emailTaken);
  }

  await createSession(created.userId, created.organizationId);
  if (!invited) {
    await setFlash({ type: "success", message: `Welcome! ${organizationName} is ready.` });
  }
  redirect(next ?? "/dashboard");
}

export async function login(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "").slice(0, MAX_PASSWORD);
  const invalid = "Incorrect email or password.";
  const next = nextPath(formData);
  const back = formPath("/login", next);

  if (!email || !password) return fail(back, invalid);

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
  if (!user || !valid) return fail(back, invalid);

  // Resume in the oldest organization they're in.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "active", organization: { deletedAt: null } },
    orderBy: { joinedAt: "asc" },
    select: { organizationId: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
  await createSession(user.id, membership?.organizationId ?? null);
  redirect(next ?? "/dashboard");
}

export async function signOut() {
  await deleteSession();
  redirect("/login");
}
