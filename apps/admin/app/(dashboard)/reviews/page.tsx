import type { Metadata } from "next";
import { ReviewsPageClient } from "./reviews-page-client";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Moderate marketplace reviews",
};

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">Ratings left after completed jobs</p>
      </div>
      <ReviewsPageClient />
    </>
  );
}
