"use client";

import { useState } from "react";

// About Wade. Polaroid stack on the left, intro paragraph on the right.
// The polaroid stack is the personality piece — pictures fan out, you
// can shuffle them with a click. Each carries a tiny handwritten caption.

type Polaroid = {
  src: string;
  alt: string;
  caption: string;
  rotation: number;
};

// Roster of the photos in /public/photos. Wade-2 already lives in the
// hero, so this stack pulls the other six. Captions are kept short and
// in his voice; he should sweep these for accuracy when he picks
// final shots.
const POLAROIDS: Polaroid[] = [
  { src: "/photos/wade-3.jpg", alt: "wade photo 3", caption: "trying to be outsidey", rotation: -4 },
  { src: "/photos/wade-1.jpg", alt: "wade photo 1", caption: "garage hangs", rotation: 3 },
  { src: "/photos/wade-4.jpg", alt: "wade photo 4", caption: "a candid", rotation: -2 },
  { src: "/photos/wade-5.jpg", alt: "wade photo 5", caption: "look at this guy", rotation: 5 },
  { src: "/photos/wade-6.jpg", alt: "wade photo 6", caption: "denver", rotation: -3 },
  { src: "/photos/wade-7.jpg", alt: "wade photo 7", caption: "the look", rotation: 2 },
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
    <section className="py-24 px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        {/* Stack — click anywhere on it to cycle. */}
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
                  className="polaroid absolute inset-0 w-[280px]"
                  style={{
                    transform: `rotate(${p.rotation + stackIndex * 0.4}deg) translateY(${(order.length - 1 - stackIndex) * -2}px)`,
                    zIndex: stackIndex,
                    transition: "transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 0.3s ease",
                    pointerEvents: isTop ? "auto" : "none",
                  }}
                >
                  <img
                    src={p.src}
                    alt={p.alt}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute mt-3 text-center w-[252px] font-[family-name:var(--font-caveat)] text-lg text-[var(--color-ink-soft)]">
                    {p.caption}
                  </div>
                </div>
              );
            })}
          </button>

          <span className="absolute -bottom-1 text-xs text-[var(--color-ink-muted)] tracking-wide">
            click the stack to flip through
          </span>
        </div>

        <div>
          <div className="text-sm font-medium text-[var(--color-coral)] tracking-wide uppercase mb-3">
            about me
          </div>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl leading-tight text-[var(--color-ink)] mb-6">
            here&rsquo;s the actual{" "}
            <span className="italic font-[family-name:var(--font-caveat)] text-[var(--color-coral)]">
              gist
            </span>
            .
          </h2>

          <div className="space-y-4 text-[var(--color-ink-soft)] leading-relaxed">
            <p>
              i&rsquo;m 27, i live in denver, i run a startup called
              credscore that does wallet risk intelligence (it&rsquo;s
              fine if that meant nothing to you — most of my dates have
              no idea what i do). i used to compete in esports, i still
              think about it more than i should.
            </p>
            <p>
              i have a cat. her name is in the application — you&rsquo;ll
              meet her if this works out. i&rsquo;m more of a homebody
              than not, but i&rsquo;ll go on a hike or to a show if
              there&rsquo;s a good reason. nerdy and slightly alt by
              default.
            </p>
            <p>
              the kind of person i&rsquo;m hoping to meet is kind,
              actually funny, a little weird, and genuine. not the
              performance of those things. the things themselves.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {["denver", "cat dad", "nerd", "homebody (mostly)", "founder", "former esports"].map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium px-3 py-1.5 bg-[var(--color-paper)] border border-[var(--color-ink-muted)]/20 rounded-full text-[var(--color-ink-soft)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
