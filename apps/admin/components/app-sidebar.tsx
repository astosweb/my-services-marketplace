"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  filterNavigationGroups,
  navigationGroups,
} from "@/config/navigation";
import { useSession } from "@/hooks/use-session";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, permissions, isLoading } = useSession();

  const visibleGroups = React.useMemo(
    () => filterNavigationGroups(navigationGroups, isLoading ? [] : permissions),
    [isLoading, permissions],
  );

  const navUser = user
    ? {
        name: user.name ?? "User",
        email: user.email,
        avatar: user.avatar ?? "",
      }
    : {
        name: "Guest",
        email: "",
        avatar: "",
      };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Bidy Admin</span>
                  <span className="truncate text-xs">Production Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {isLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-32" />
            </div>
          </div>
        ) : (
          <NavUser user={navUser} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
