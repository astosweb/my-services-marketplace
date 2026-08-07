import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageStatusTicks({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const normalized = status.toUpperCase();
  const read = normalized === "READ";
  const delivered = normalized === "DELIVERED" || read;
  const sending = normalized === "SENDING";

  return (
    <span
      className={cn(
        "inline-flex items-center",
        read ? "text-sky-300" : "opacity-70",
        className,
      )}
      aria-label={
        sending
          ? "Sending"
          : read
            ? "Read"
            : delivered
              ? "Delivered"
              : "Sent"
      }
    >
      {sending ? (
        <Clock className="size-3" />
      ) : delivered ? (
        <CheckCheck className="size-3.5" />
      ) : (
        <Check className="size-3.5" />
      )}
    </span>
  );
}
