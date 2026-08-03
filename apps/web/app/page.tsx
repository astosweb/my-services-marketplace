import {
  CategoryGrid,
  CtaBanner,
  Faq,
  FeaturedRequests,
  HowItWorks,
  LandingHero,
  LatestRequests,
  PopularProviders,
  Testimonials,
} from "@/components/landing";

export default function HomePage() {
  return (
    <>
      <LandingHero />
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
