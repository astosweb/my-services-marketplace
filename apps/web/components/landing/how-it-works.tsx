import { SectionHeader } from "./section-header";

const STEPS = [
  {
    step: "1",
    title: "Post what you need",
    description:
      "Describe the job, pick your city, and add a budget. Takes a couple of minutes.",
  },
  {
    step: "2",
    title: "Compare local offers",
    description:
      "Providers nearby reply with prices and availability. Chat before you decide.",
  },
  {
    step: "3",
    title: "Get it done",
    description:
      "Accept an offer, track progress, and leave a review for the next neighbor.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <SectionHeader
        id="how-heading"
        title="How Bidy works"
        description="A simple path from “I need help” to “done.”"
      />
      <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((item) => (
          <li key={item.step} className="relative">
            <p
              className="flex size-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground"
              aria-hidden
            >
              {item.step}
            </p>
            <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
              {item.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
