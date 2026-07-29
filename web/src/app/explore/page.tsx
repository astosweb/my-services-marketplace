import { Suspense } from "react";
import ExplorePage from "./explore-client";

export const metadata = {
  title: "Explore",
};

export default function ExploreRoute() {
  return (
    <Suspense fallback={<p className="page-shell empty-state">Loading…</p>}>
      <ExplorePage />
    </Suspense>
  );
}
