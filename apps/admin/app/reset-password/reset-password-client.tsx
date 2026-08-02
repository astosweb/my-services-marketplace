"use client";

import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { resetPasswordAction, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;
const initialState: AuthActionState = { success: false };

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (state.message && !state.success) toast.error(state.message);
  }, [state]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid reset link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password">
              <Button className="w-full">Request new link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form action={formAction} className="grid gap-4">
              <input type="hidden" name="token" value={token} />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" disabled={pending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" disabled={pending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
