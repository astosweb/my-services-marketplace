/** Short clock time for chat bubbles (e.g. "14:32"). */
export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
