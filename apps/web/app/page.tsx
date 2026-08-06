import {
  CategoryGrid,
  CtaBanner,
  Faq,
  FeaturedRequests,
  HomeToolbar,
  HowItWorks,
  LatestRequests,
  PopularProviders,
  Testimonials,
} from "@/components/landing";

export default function HomePage() {
  return (
    <>
      <HomeToolbar />
      <CategoryGrid />
      <FeaturedRequests />
      <HowItWorks />
      <LatestRequests />
      <PopularProviders />
      <Testimonials />
      <Faq />
      <CtaBanner />
    </>
  );
}
