import { LogOut } from "lucide-react"

import { signOut } from "@/app/(auth)/actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"

function initials(name: string | null, email: string) {
  const words = (name || email).split(/[\s@.]+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

// The signed-in user and a log out button for the sidebar footer. Reads the
// session, so render it inside <Suspense fallback={<NavUserSkeleton />}>.
export async function NavUser() {
  const user = await getCurrentUser()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
          <Avatar className="size-8 rounded-lg">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="rounded-lg">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name || user.email}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <form action={signOut}>
          <SidebarMenuButton type="submit" tooltip="Log out">
            <LogOut />
            <span>Log out</span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// Not SidebarMenuSkeleton: its random width can't be in a prerendered fallback.
export function NavUserSkeleton() {
  return (
    <div className="flex h-12 items-center gap-2 p-2">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}
