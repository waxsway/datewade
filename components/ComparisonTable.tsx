"use client";

// "WADE VS. OTHER MEN" — the classic infomercial product comparison
// table. Loud, satirical, two columns. Other men get the grim grayscale
// strip; Wade gets the bright winning column with the gold star.

type Row = {
  topic: string;
  others: string;
  wade: string;
};

// Edit these freely. The point is satirical contrast, not literal claim.
const ROWS: Row[] = [
  {
    topic: "First text",
    others: '"wyd"',
    wade: '"started a book i can\'t put down — what\'s the last one that did that to you?"',
  },
  {
    topic: "Cats",
    others: "Allergic. Also emotionally.",
    wade: "Co-parents Mushroom & Pickle. They run the household; he just lives there.",
  },
  {
    topic: "Plans for Saturday",
    others: "Will figure it out by 9:43pm.",
    wade: "Coffee in the morning. Dinner reservation in the evening. Cat in between.",
  },
  {
    topic: "Replies to messages",
    others: "When the moon is waxing.",
    wade: "Same day, mostly within hours, like a functioning adult.",
  },
  {
    topic: "Career",
    others: "Crypto, vaguely.",
    wade: "Runs a startup. Can explain it without using the word \"disrupting\".",
  },
  {
    topic: "Outdoors",
    others: "Posts a single mountain photo once a year. Hasn't read a book since 2019.",
    wade: "Will not go on a hike. Refuses, politely. Will take you to dinner instead.",
  },
  {
    topic: "Photos",
    others: "Fish, sunglasses, group shot you can't identify him in.",
    wade: "Scroll up. The cat one is the cat one.",
  },
  {
    topic: "Tattoos",
    others: "A barbed wire bicep band his uncle gave him in 2008.",
    wade: "Full Avatar: The Last Airbender sleeve. Knows every nation by heart.",
  },
];

export default function ComparisonTable() {
  return (
    <section className="relative px-4 sm:px-6 py-20 bg-[var(--color-cream)] overflow-hidden">
      {/* Big section header in infomercial voice. */}
      <div className="max-w-5xl mx-auto text-center mb-12">
        <div className="inline-block as-seen-on-tv text-sm sm:text-base mb-5">
          ★ COMPARE THE COMPETITION ★
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,84px)] leading-[0.9] text-[var(--color-navy)] uppercase">
          Why Settle for{" "}
          <span className="text-[var(--color-red)]">Other Men</span>
          {" "}When You Could Have{" "}
          <span className="text-[var(--color-red)]">Wade?</span>
        </h2>
        <p className="mt-5 max-w-2xl mx-auto text-lg text-[var(--color-ink-soft)] leading-snug font-medium">
          An impartial side-by-side comparison. Conducted by a panel of
          experts. The experts were Wade&rsquo;s friends.
        </p>
      </div>

      <div className="max-w-5xl mx-auto borderbox p-0 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-[var(--color-navy)] text-[var(--color-paper)]">
          <div className="px-4 py-4 font-[family-name:var(--font-display-2)] text-sm sm:text-base tracking-[0.14em] border-r-2 border-[var(--color-navy-deep)]">
            FEATURE
          </div>
          <div className="px-4 py-4 font-[family-name:var(--font-display)] text-base sm:text-xl uppercase tracking-wide text-center border-r-2 border-[var(--color-navy-deep)] bg-[var(--color-ink-soft)]">
            <span className="block text-xs font-[family-name:var(--font-display-2)] tracking-widest opacity-70 mb-1">
              ✗ THE COMPETITION
            </span>
            Other Men
          </div>
          <div className="px-4 py-4 font-[family-name:var(--font-display)] text-base sm:text-xl uppercase tracking-wide text-center bg-[var(--color-red)]">
            <span className="block text-xs font-[family-name:var(--font-display-2)] tracking-widest text-[var(--color-yellow)] mb-1">
              ★ NEW & IMPROVED
            </span>
            Wade
          </div>
        </div>

        {ROWS.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1.1fr_1fr_1fr] ${
              i % 2 === 0 ? "bg-[var(--color-paper)]" : "bg-[var(--color-cream)]"
            } border-t-2 border-[var(--color-navy)]/15`}
          >
            <div className="px-4 py-4 font-[family-name:var(--font-display-2)] text-[15px] sm:text-base tracking-wider uppercase text-[var(--color-navy)] border-r-2 border-[var(--color-navy)]/15 flex items-center">
              {row.topic}
            </div>
            <div className="px-4 py-4 text-sm sm:text-[15px] text-[var(--color-ink-muted)] border-r-2 border-[var(--color-navy)]/15 grayscale flex items-center">
              <span className="line-through decoration-[var(--color-red)]/40 decoration-2">
                {row.others}
              </span>
            </div>
            <div className="px-4 py-4 text-sm sm:text-[15px] text-[var(--color-navy)] font-medium flex items-start gap-2">
              <span className="text-[var(--color-red)] font-[family-name:var(--font-display)] shrink-0">
                ✓
              </span>
              <span>{row.wade}</span>
            </div>
          </div>
        ))}

        {/* Footer row — the cheesy infomercial close */}
        <div className="bg-[var(--color-yellow)] grid grid-cols-[1.1fr_1fr_1fr] border-t-4 border-[var(--color-navy)]">
          <div className="px-4 py-4 font-[family-name:var(--font-display)] text-base sm:text-lg uppercase tracking-wide text-[var(--color-navy)] border-r-2 border-[var(--color-navy)]/30 flex items-center">
            Verdict
          </div>
          <div className="px-4 py-4 text-center font-[family-name:var(--font-display-2)] tracking-widest text-sm text-[var(--color-ink-muted)] border-r-2 border-[var(--color-navy)]/30 flex items-center justify-center">
            ELSEWHERE
          </div>
          <div className="px-4 py-4 text-center font-[family-name:var(--font-display)] text-base sm:text-xl text-[var(--color-red-deep)] uppercase">
            CLEAR WINNER
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <a href="#apply" className="btn-pop btn-pop-yellow text-lg sm:text-xl inline-block">
          ★ Apply Now — Limited Time ★
        </a>
      </div>
    </section>
  );
}
