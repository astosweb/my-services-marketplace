import {
  CategoryGrid,
  CtaBanner,
  Faq,
  FeaturedRequests,
  HomeToolbar,
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
