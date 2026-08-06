import { SectionHeader } from "./section-header";

const TESTIMONIALS = [
  {
    quote:
      "Posted a leaky tap on a Tuesday evening in Kristiine — had three offers by morning and it was fixed before lunch.",
    name: "Liis K.",
    place: "Tallinn",
  },
  {
    quote:
      "As a handyman in Tartu, Bidy is where real jobs show up. Clear briefs, fair budgets, less time chasing leads.",
    name: "Mart R.",
    place: "Tartu",
  },
  {
    quote:
      "Needed a deep clean after renovation in Pärnu. Felt safer hiring someone with reviews from neighbors.",
    name: "Anneli T.",
    place: "Pärnu",
  },
];

export function Testimonials() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="bg-mist/40 py-10 sm:py-12"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          id="testimonials-heading"
          title="Stories from around Estonia"
          description="Neighbors helping neighbors — that’s the whole point."
        />
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {TESTIMONIALS.map((item) => (
            <blockquote
              key={item.name}
              className="flex flex-col border-l-2 border-primary/30 pl-4"
            >
              <p className="text-sm leading-relaxed text-foreground/90 sm:text-[0.9375rem]">
                “{item.quote}”
              </p>
              <footer className="mt-3 text-sm font-medium text-primary">
                {item.name}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {item.place}
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
