const STEPS = [
  {
    step: "01",
    title: "Post what you need",
    description:
      "Describe the job, pick your city, and add a budget if you have one. It takes a couple of minutes.",
  },
  {
    step: "02",
    title: "Compare local offers",
    description:
      "Providers nearby message you with prices and availability. Chat in-app before you decide.",
  },
  {
    step: "03",
    title: "Get it done",
    description:
      "Accept an offer, track progress, and leave a review so the next neighbor knows who to trust.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-10 max-w-xl">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          How Bidy works
        </h2>
        <p className="mt-2 text-muted-foreground">
          A simple path from “I need help” to “done.”
        </p>
      </div>
      <ol className="grid gap-8 md:grid-cols-3">
        {STEPS.map((item) => (
          <li key={item.step} className="relative">
            <p className="font-display text-4xl font-bold text-primary/20">
              {item.step}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
