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
    <section id="testimonials" className="bg-mist/50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Stories from around Estonia
          </h2>
          <p className="mt-2 text-muted-foreground">
            Neighbors helping neighbors — that’s the whole point.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <blockquote key={item.name} className="flex flex-col gap-4">
              <p className="text-base leading-relaxed text-foreground/90">
                “{item.quote}”
              </p>
              <footer className="mt-auto text-sm font-medium text-primary">
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
