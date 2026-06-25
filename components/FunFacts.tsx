"use client";

import { useState } from "react";

// "Did you know" interactive widget. Built as a vintage CRT TV frame
// that cycles facts on click — small nod to the 90s infomercial
// without forcing the whole page into camp. Wade will swap in the
// real facts list; the current set is a stand-in he should edit.

// Edit these to the actual facts.
const FUN_FACTS: string[] = [
  "i have a degree in something i don't use day-to-day.",
  "i was a competitive esports player back in the day.",
  "i'm a founder — credscore.us, wallet-risk intelligence.",
  "i can cook three meals confidently. anything beyond that is improvising.",
  "i learned to ride a bike late. i'm fine now.",
  "i make most of my decisions while pacing.",
  "i can quote almost the entire princess bride.",
  "i talk to my cat in full sentences. she does not.",
];

export default function FunFacts() {
  const [index, setIndex] = useState(0);

  function next() {
    setIndex((i) => (i + 1) % FUN_FACTS.length);
  }

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-sm font-medium text-[var(--color-coral)] tracking-wide uppercase mb-3">
            did you know
          </div>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl leading-tight text-[var(--color-ink)] mb-3">
            things that may or may not{" "}
            <span className="italic font-[family-name:var(--font-caveat)] text-[var(--color-coral)]">
              matter
            </span>
          </h2>
          <p className="text-[var(--color-ink-soft)] max-w-xl mx-auto">
            tap the screen to cycle. there&rsquo;s {FUN_FACTS.length} of these.
            none of them are dealbreakers.
          </p>
        </div>

        {/* CRT TV-style card. Rounded corners, scanline overlay, knobs.
            Click anywhere to cycle. */}
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={next}
            aria-label="Next fact"
            className="w-full block group focus:outline-none"
          >
            <div className="relative bg-[#3a2e25] rounded-[28px] p-6 shadow-[0_20px_60px_-12px_rgba(26,20,16,0.45)]">
              {/* Knobs */}
              <div className="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-3">
                <span className="w-3 h-3 rounded-full bg-[#1a1410] border border-[#8a7a6e]/40" />
                <span className="w-3 h-3 rounded-full bg-[#1a1410] border border-[#8a7a6e]/40" />
                <span className="w-3 h-3 rounded-full bg-[#1a1410] border border-[#8a7a6e]/40" />
              </div>

              {/* Screen */}
              <div className="relative bg-[#11201d] rounded-[14px] aspect-[16/10] overflow-hidden flex items-center justify-center px-8">
                {/* Scanlines */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-30"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)",
                  }}
                />
                {/* Soft glow */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#5fa39d]/10 to-transparent" />

                {/* Channel label */}
                <div className="absolute top-3 left-4 font-[family-name:var(--font-caveat)] text-[var(--color-coral-soft)]/80 text-sm tracking-wide">
                  ch. {String(index + 1).padStart(2, "0")}
                </div>
                <div className="absolute top-3 right-4 text-[10px] text-[var(--color-coral-soft)]/70 font-mono tracking-wider">
                  ● REC
                </div>

                {/* Fact */}
                <p
                  key={index}
                  className="relative font-[family-name:var(--font-serif)] text-xl md:text-2xl text-[var(--color-paper)] text-center leading-snug italic"
                  style={{
                    animation: "factIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)",
                  }}
                >
                  &ldquo;{FUN_FACTS[index]}&rdquo;
                </p>

                {/* Hover affordance */}
                <div className="absolute bottom-3 right-4 text-[10px] text-[var(--color-paper)]/40 group-hover:text-[var(--color-paper)]/80 transition-colors tracking-wider uppercase">
                  click for next ↻
                </div>
              </div>
            </div>
          </button>

          {/* Channel indicator under the TV */}
          <div className="flex justify-center gap-1.5 mt-5">
            {FUN_FACTS.map((_, i) => (
              <span
                key={i}
                className="block h-1 rounded-full transition-all"
                style={{
                  width: i === index ? 20 : 6,
                  background: i === index ? "var(--color-coral)" : "var(--color-ink-muted)",
                  opacity: i === index ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes factIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
