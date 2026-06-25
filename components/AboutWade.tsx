"use client";

import { useState } from "react";

// ABOUT WADE — but written like a product spec sheet on a late-night
// shopping channel. Polaroid stack on the left, "PRODUCT
// SPECIFICATIONS" panel on the right, announcer copy throughout.

type Polaroid = {
  src: string;
  alt: string;
  caption: string;
  rotation: number;
};

const POLAROIDS: Polaroid[] = [
  { src: "/photos/wade-2.jpg", alt: "wade with the cat", caption: "with the supervisor", rotation: -4 },
  { src: "/photos/wade-3.jpg", alt: "wade photo 3", caption: "natural habitat", rotation: 3 },
  { src: "/photos/wade-1.jpg", alt: "wade photo 1", caption: "off-the-grid mode", rotation: -2 },
  { src: "/photos/wade-4.jpg", alt: "wade photo 4", caption: "in the wild", rotation: 5 },
  { src: "/photos/wade-5.jpg", alt: "wade photo 5", caption: "this guy", rotation: -3 },
  { src: "/photos/wade-6.jpg", alt: "wade photo 6", caption: "denver, co", rotation: 2 },
  { src: "/photos/wade-7.jpg", alt: "wade photo 7", caption: "documentation", rotation: -1 },
];

const SPECS: Array<{ key: string; value: string }> = [
  { key: "MODEL", value: "Wade, V.27" },
  { key: "MFG. LOCATION", value: "Denver, Colorado" },
  { key: "OCCUPATION", value: "Founder, startup" },
  { key: "CO-PILOT", value: "One cat. Tabby. Strong opinions." },
  { key: "HUMOR", value: "Quietly funny. Not the loudest in the room." },
  { key: "ENERGY", value: "Homebody by default. Outdoorsy on request." },
  { key: "TASTE", value: "Slightly nerdy / alt. Likes weird people." },
  { key: "WARRANTY", value: "Lifetime, if mutually entered into." },
];

export default function AboutWade() {
  const [order, setOrder] = useState<number[]>(POLAROIDS.map((_, i) => i));

  function shuffle() {
    const next = [...order];
    const moved = next.pop();
    if (moved !== undefined) next.unshift(moved);
    setOrder(next);
  }

  return (
    <section className="relative px-4 sm:px-6 py-20 bg-[var(--color-bg)] overflow-hidden">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <div className="inline-block as-seen-on-tv text-sm sm:text-base mb-5">
          ★ MEET THE UNIT ★
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,84px)] leading-[0.9] text-[var(--color-navy)] uppercase">
          So,{" "}
          <span className="text-[var(--color-red)]">Who Is Wade?</span>
        </h2>
        <p className="mt-5 max-w-2xl mx-auto text-lg text-[var(--color-ink-soft)] leading-snug font-medium">
          A brief, third-party overview of the product on offer. Read
          carefully. There is no replacement available in this make
          or model.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Polaroid stack */}
        <div className="relative h-[460px] flex items-center justify-center">
          <button
            type="button"
            onClick={shuffle}
            aria-label="Shuffle photo stack"
            className="relative w-[280px] h-[360px] cursor-pointer"
          >
            {order.map((polaroidIndex, stackIndex) => {
              const p = POLAROIDS[polaroidIndex];
              const isTop = stackIndex === order.length - 1;
              return (
                <div
                  key={polaroidIndex}
                  className="absolute inset-0 w-[280px] bg-[var(--color-paper)] p-3 pb-12 border-4 border-[var(--color-navy)]"
                  style={{
                    transform: `rotate(${p.rotation + stackIndex * 0.4}deg) translateY(${(order.length - 1 - stackIndex) * -2}px)`,
                    zIndex: stackIndex,
                    transition: "transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)",
                    pointerEvents: isTop ? "auto" : "none",
                    boxShadow: `${4 + stackIndex}px ${4 + stackIndex}px 0 var(--color-navy)`,
                  }}
                >
                  <img
                    src={p.src}
                    alt={p.alt}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute left-0 right-0 mt-2 text-center font-[family-name:var(--font-display-2)] text-base tracking-wider text-[var(--color-navy)]">
                    {p.caption}
                  </div>
                </div>
              );
            })}
          </button>

          <span className="absolute -bottom-1 font-[family-name:var(--font-display-2)] text-xs tracking-widest text-[var(--color-ink-muted)]">
            ▸ CLICK TO ROTATE PHOTOS ◂
          </span>
        </div>

        {/* Spec sheet */}
        <div className="borderbox p-6 sm:p-8">
          <div className="font-[family-name:var(--font-display-2)] tracking-[0.18em] text-sm text-[var(--color-red)] mb-2">
            ★ PRODUCT SPECIFICATIONS ★
          </div>
          <div className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-navy)] uppercase mb-6">
            What You&rsquo;re Working With
          </div>

          <table className="w-full text-left">
            <tbody>
              {SPECS.map((s) => (
                <tr
                  key={s.key}
                  className="border-b-2 border-dashed border-[var(--color-navy)]/25 last:border-b-0"
                >
                  <td className="py-3 pr-4 font-[family-name:var(--font-display-2)] text-xs tracking-[0.14em] text-[var(--color-ink-muted)] uppercase whitespace-nowrap align-top">
                    {s.key}
                  </td>
                  <td className="py-3 text-[var(--color-navy)] font-medium leading-snug">
                    {s.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 pt-4 border-t-4 border-[var(--color-navy)]">
            <div className="text-xs font-[family-name:var(--font-display-2)] tracking-widest text-[var(--color-ink-muted)] mb-2">
              ★ MANUFACTURER&rsquo;S NOTE ★
            </div>
            <p className="text-sm text-[var(--color-ink-soft)] leading-snug italic">
              &ldquo;Cool guy. Replies to messages. Owns a cat. Genuinely
              kind. You could do a lot worse.&rdquo; — His Mom
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
