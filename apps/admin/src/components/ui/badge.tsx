import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variant === "default" && "border-transparent bg-zinc-900 text-white",
        variant === "secondary" && "border-transparent bg-zinc-100 text-zinc-700",
        variant === "success" && "border-transparent bg-emerald-100 text-emerald-800",
        variant === "warning" && "border-transparent bg-amber-100 text-amber-800",
        variant === "destructive" && "border-transparent bg-red-100 text-red-800",
        variant === "outline" && "border-zinc-200 text-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
