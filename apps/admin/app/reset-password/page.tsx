import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ResetPasswordPage from "./reset-password-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-64 w-full max-w-md rounded-xl" />
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
