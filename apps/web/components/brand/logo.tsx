import Image from "next/image";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

export function GobidMark({
  className,
  size = 32,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/gobid-mark.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-[22%]", className)}
      aria-hidden
    />
  );
}

export function SiteLogo({
  className,
  markSize = 32,
  showWordmark = true,
  inverse = false,
  priority = false,
}: {
  className?: string;
  markSize?: number;
  showWordmark?: boolean;
  inverse?: boolean;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <GobidMark size={markSize} priority={priority} />
      {showWordmark ? (
        <span
          className={cn(
            "font-display text-2xl font-bold tracking-tight",
            inverse ? "text-primary-foreground" : "text-primary",
          )}
        >
          {SITE_NAME}
        </span>
      ) : null}
    </span>
  );
}
