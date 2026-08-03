const FAQS = [
  {
    q: "Is Bidy only for Tallinn?",
    a: "No — Bidy covers Tallinn, Tartu, Pärnu, and Narva. Pick your city when you post or search.",
  },
  {
    q: "Do I have to accept an offer?",
    a: "Never. You compare messages and prices, then accept only when you’re ready. You can cancel an open request anytime.",
  },
  {
    q: "How do providers get paid?",
    a: "Payment is arranged directly between you and the provider. Bidy helps you find and coordinate — not process payments yet.",
  },
  {
    q: "Are profiles verified?",
    a: "Accounts require email signup. Ratings and reviews from completed jobs help you choose trusted locals.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Questions, answered
        </h2>
        <p className="mt-2 text-muted-foreground">
          Straight answers for first-time posters and providers.
        </p>
      </div>
      <div className="space-y-3">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-border/80 bg-white/60 px-5 py-4 open:bg-white"
          >
            <summary className="cursor-pointer list-none font-display text-base font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span className="text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
