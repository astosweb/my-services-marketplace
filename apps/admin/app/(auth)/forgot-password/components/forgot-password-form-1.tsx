"use client";

import { useActionState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { forgotPasswordAction, type AuthActionState } from "@/actions/auth";
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
const schema = z.object({
  email: z.string().email("Invalid email address"),
});

type FormValues = z.infer<typeof schema>;
const initialState: AuthActionState = { success: false };

export function ForgotPasswordForm1({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form action={formAction} className="grid gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending..." : "Send reset link"}
              </Button>
              <div className="text-center text-sm">
                <Link href="/sign-in" className="underline underline-offset-4">
                  Back to sign in
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
