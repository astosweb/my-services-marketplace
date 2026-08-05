"use client";

import {
  BellDot,
  ChevronsUpDown,
  CircleUser,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/use-session";

export function HeaderUser() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <Skeleton className="h-10 w-56 rounded-lg sm:w-72" />;
  }

  if (!user) {
    return null;
  }

  const avatar = user.avatar ?? "";
  const name = user.name ?? "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-56 justify-start gap-2 rounded-lg px-2 sm:w-72"
          aria-label="User menu"
        >
          <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
            {avatar || <Logo size={20} />}
          </div>
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {user.email}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <div className="bg-muted flex size-8 items-center justify-center rounded-lg text-xs font-medium">
              {avatar || <Logo size={28} />}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/settings/account">
              <CircleUser />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/settings/system">
              <BellDot />
              System
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild className="cursor-pointer">
            <button type="submit" className="w-full">
              <LogOut />
              Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
