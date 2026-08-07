"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  changePasswordAction,
  updateProfileAction,
  type AuthActionState,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { PASSWORD_MIN_LENGTH } from "@/lib/validations";

const initialState: AuthActionState = { success: false };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-destructive text-sm">{messages[0]}</p>;
}

function useActionToast(state: AuthActionState) {
  useEffect(() => {
    if (state.message) {
      if (state.success) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);
}

export default function AccountSettings() {
  const { user, isLoading, mutate } = useSession();
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  useActionToast(profileState);
  useActionToast(passwordState);

  useEffect(() => {
    if (profileState.success) void mutate();
  }, [profileState.success, mutate]);

  if (isLoading || !user) {
    return (
      <div className="space-y-4 px-4 lg:px-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Profile and password for {user.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update how you appear in the admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={user.name}
                required
              />
              <FieldError messages={profileState.errors?.displayName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <Button type="submit" disabled={profilePending}>
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your password. All sessions will be signed out afterward.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <FieldError messages={passwordState.errors?.currentPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                required
              />
              <FieldError messages={passwordState.errors?.password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldError messages={passwordState.errors?.confirmPassword} />
            </div>
            <Button type="submit" disabled={passwordPending} variant="secondary">
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
