const FAQS = [
  {
    q: "Is Gobid only for Tallinn?",
    a: "No — Gobid covers Tallinn, Tartu, Pärnu, and Narva. Pick your city when you post or search.",
  },
  {
    q: "Do I have to accept an offer?",
    a: "Never. You compare messages and prices, then accept only when you’re ready. You can cancel an open request anytime.",
  },
  {
    q: "How do providers get paid?",
    a: "Payment is arranged directly between you and the provider. Gobid helps you find and coordinate — not process payments yet.",
  },
  {
    q: "Are profiles verified?",
    a: "Accounts require email signup. Ratings and reviews from completed jobs help you choose trusted locals.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="mb-6 text-center sm:mb-7">
        <h2
          id="faq-heading"
          className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]"
        >
          Questions, answered
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-[0.9375rem]">
          Straight answers for first-time posters and providers.
        </p>
      </div>
      <div className="space-y-2.5">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border/80 bg-white/70 px-4 py-3.5 open:bg-white open:shadow-sm"
          >
            <summary className="cursor-pointer list-none font-display text-sm font-semibold marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-base [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-sm text-muted-foreground transition group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground"
                  aria-hidden
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
