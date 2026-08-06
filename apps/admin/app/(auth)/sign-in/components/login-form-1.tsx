"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { loginAction, type AuthActionState } from "@/actions/auth";
import { cn } from "@/lib/utils";
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
const loginFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const initialState: AuthActionState = { success: false };

export function LoginForm1({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const noticedQuery = useRef(false);
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "admin@gobid.test",
      password: "password123",
    },
  });

  useEffect(() => {
    if (noticedQuery.current) return;

    const reset = searchParams.get("reset") === "true";
    const expired = searchParams.get("expired") === "1";
    if (!reset && !expired) return;

    noticedQuery.current = true;
    if (reset) {
      toast.success("Password reset successfully. You can now sign in.");
    }
    if (expired) {
      toast.info("Your session has expired. Please sign in again.");
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("reset");
    params.delete("expired");
    const query = params.toString();
    router.replace(query ? `/sign-in?${query}` : "/sign-in");
  }, [searchParams, router]);

  useEffect(() => {
    if (state.message && !state.success) {
      toast.error(state.message);
    }
    if (state.errors) {
      for (const [field, messages] of Object.entries(state.errors)) {
        form.setError(field as keyof LoginFormValues, {
          message: messages[0],
        });
      }
    }
  }, [state, form]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form action={formAction} className="grid gap-6">
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@gobid.test"
                          autoComplete="email"
                          disabled={pending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          disabled={pending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  disabled={pending}
                >
                  {pending ? "Signing in..." : "Login"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        {process.env.NODE_ENV !== "production"
          ? "Dev: pre-filled admin@gobid.test / password123"
          : "Protected admin access"}
      </div>
    </div>
  );
}
