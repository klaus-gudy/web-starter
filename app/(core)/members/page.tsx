import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { InviteDialog } from "./invite-dialog";
import {
  RemoveMemberMenu,
  RevokeInvitationMenu,
  RoleSelect,
} from "./member-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { assignableRoles, readActiveMember } from "@/lib/membership";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Members",
};

export default function MembersPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          Who&apos;s in your organization, and who&apos;s been invited.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Members />
      </Suspense>
    </>
  );
}

function NewOrganizationEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2 />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/organizations/new">Create an organization</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

async function Members() {
  await connection();
  const member = await readActiveMember();
  if (!member) {
    return (
      <NewOrganizationEmpty
        title="No organization selected"
        description="Pick one from the menu at the top of the sidebar, or create a new one."
      />
    );
  }

  const { organization, permissions } = member;
  const isOwner = member.role.key === "owner";
  const canInvite = permissions.has("members.invite") && !organization.isPersonal;
  const canUpdate = permissions.has("members.update");
  const canRemove = permissions.has("members.remove");

  const prisma = getPrisma();
  const [memberships, invitations, roles] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: organization.id },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        status: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { id: true, key: true, name: true } },
      },
    }),
    canInvite
      ? prisma.invitation.findMany({
          where: { organizationId: organization.id, status: "pending" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            expiresAt: true,
            role: { select: { name: true } },
            invitedBy: { select: { name: true, email: true } },
          },
        })
      : [],
    assignableRoles(member),
  ]);
  const now = new Date();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>{organization.name}</CardTitle>
            <CardDescription>
              {memberships.length === 1 ? "1 member" : `${memberships.length} members`}
            </CardDescription>
          </div>
          {canInvite ? <InviteDialog roles={roles} /> : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((row) => {
                const self = row.id === member.membershipId;
                const name = row.user.name || row.user.email;
                const touchesOwner = row.role.key === "owner" && !isOwner;
                const editable = canUpdate && !touchesOwner && !organization.isPersonal;
                const removable =
                  !organization.isPersonal && (self || (canRemove && !touchesOwner));
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {name}
                        {self ? <span className="text-muted-foreground"> (you)</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.user.email}</div>
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <RoleSelect
                          membershipId={row.id}
                          roleId={row.role.id}
                          roles={roles}
                          label={`Role for ${name}`}
                        />
                      ) : (
                        <Badge variant="secondary">{row.role.name}</Badge>
                      )}
                      {row.status === "suspended" ? (
                        <Badge variant="destructive" className="ml-2">
                          Suspended
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(row.joinedAt)}
                    </TableCell>
                    <TableCell>
                      {removable ? (
                        <RemoveMemberMenu
                          membershipId={row.id}
                          name={name}
                          organizationName={organization.name}
                          self={self}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {organization.isPersonal ? (
        <NewOrganizationEmpty
          title="This is your personal workspace"
          description="It's just for you. Create an organization to work with other people."
        />
      ) : null}

      {canInvite && invitations.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              Each link works once. Inviting the same email again replaces its link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Invited by</TableHead>
                  <TableHead className="hidden sm:table-cell">Expires</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invitation.role.name}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {invitation.invitedBy?.name || invitation.invitedBy?.email || "Someone"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {invitation.expiresAt <= now ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {formatDate(invitation.expiresAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RevokeInvitationMenu
                        invitationId={invitation.id}
                        email={invitation.email}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
