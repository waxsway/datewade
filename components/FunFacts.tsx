"use client";

import { useState } from "react";

// "BUT WAIT, THERE'S MORE!" — the classic infomercial mid-roll where
// the host reveals additional features. CRT-TV-frame interactive widget
// that cycles through wade-fact tidbits. Edit FACTS freely.

const FACTS: string[] = [
  "Has a full Avatar: The Last Airbender sleeve. Can rank the nations.",
  "Lives with Mushroom and Pickle — two Scottish Fold sisters. They have a group chat.",
  "Has never gone on a hike voluntarily. Will not start now.",
  "Quietly competitive at trivia. Pretends he isn't.",
  "Has opinions about coffee but won't push them on you.",
  "Owns one nice shirt. Knows exactly when to wear it.",
  "Makes most decisions while pacing.",
  "Has never said \"my truth.\" Has used \"frankly\" twice this week.",
];

export default function FunFacts() {
  const [index, setIndex] = useState(0);

  function next() {
    setIndex((i) => (i + 1) % FACTS.length);
  }

  return (
    <section className="relative px-4 sm:px-6 py-20 bg-[var(--color-bg)] overflow-hidden">
      <div className="max-w-4xl mx-auto text-center mb-10">
        <div className="inline-block as-seen-on-tv text-sm sm:text-base mb-5">
          ★ BUT WAIT — THERE&rsquo;S MORE ★
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,84px)] leading-[0.9] text-[var(--color-navy)] uppercase">
          Bonus{" "}
          <span className="text-[var(--color-red)]">Wade Facts</span>
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-lg text-[var(--color-ink-soft)] leading-snug font-medium">
          Press the screen for the next one. There&rsquo;s {FACTS.length}.
          None are dealbreakers.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={next}
          aria-label="Next fact"
          className="w-full block group focus:outline-none"
        >
          {/* CRT bezel — boxy beige/cream housing */}
          <div className="relative bg-[var(--color-cream)] border-4 border-[var(--color-navy)] p-5 shadow-[10px_10px_0_var(--color-navy)]">
            {/* Channel/REC chrome */}
            <div className="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-2.5">
              <span className="w-4 h-4 rounded-full bg-[var(--color-navy)]" />
              <span className="w-4 h-4 rounded-full bg-[var(--color-navy)]" />
              <span className="w-4 h-4 rounded-full bg-[var(--color-navy)]" />
            </div>

            {/* Screen */}
            <div className="relative bg-[#101e1c] aspect-[16/10] overflow-hidden flex items-center justify-center px-8">
              {/* Scanlines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 3px)",
                }}
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#5fa39d]/15 to-transparent" />

              <div className="absolute top-3 left-4 font-[family-name:var(--font-display-2)] text-[var(--color-yellow)]/90 text-sm tracking-widest">
                CH. {String(index + 1).padStart(2, "0")}
              </div>
              <div className="absolute top-3 right-4 text-[10px] text-[var(--color-yellow)]/80 font-[family-name:var(--font-display-2)] tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--color-red)] blink" />
                LIVE
              </div>

              <p
                key={index}
                className="relative font-[family-name:var(--font-body)] text-lg sm:text-2xl text-[var(--color-paper)] text-center leading-snug font-medium"
                style={{
                  animation: "factIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)",
                  textShadow: "0 0 8px rgba(245,197,24,0.25)",
                }}
              >
                &ldquo;{FACTS[index]}&rdquo;
              </p>

              <div className="absolute bottom-3 right-4 text-[10px] text-[var(--color-paper)]/50 group-hover:text-[var(--color-paper)] transition-colors font-[family-name:var(--font-display-2)] tracking-widest">
                CLICK FOR NEXT ↻
              </div>
            </div>
          </div>
        </button>

        {/* Channel indicator */}
        <div className="flex justify-center gap-1.5 mt-5">
          {FACTS.map((_, i) => (
            <span
              key={i}
              className="block h-1.5 transition-all border border-[var(--color-navy)]/30"
              style={{
                width: i === index ? 22 : 8,
                background: i === index ? "var(--color-red)" : "var(--color-cream)",
              }}
            />
          ))}
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
