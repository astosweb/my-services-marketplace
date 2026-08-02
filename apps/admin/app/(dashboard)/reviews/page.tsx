import type { Metadata } from "next";
import { ReviewsPageClient } from "./reviews-page-client";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Moderate marketplace reviews",
};

export default function Page() {
  return <ReviewsPageClient />;
}
