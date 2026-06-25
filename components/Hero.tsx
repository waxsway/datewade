"use client";

import { useRef, useState } from "react";

// HERO. Loud, third-person announcer voice. The infomercial video is
// the centerpiece — large container at the top, autoplay-muted poster
// frame, click-to-unmute-and-play. Below it: the announcer pitch and
// the primary CTA.

export default function Hero() {
  const [unmuted, setUnmuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function unmuteAndPlay() {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
    setUnmuted(true);
  }

  return (
    <section className="relative px-4 sm:px-6 pt-4 pb-16 overflow-hidden bg-[var(--color-bg)]">
      {/* Ticker strip — runs across the top of the page in flashing
          red/yellow. Reads like a chyron under a paid-program block. */}
      <div className="relative -mx-4 sm:-mx-6 mb-6 overflow-hidden border-y-4 border-[var(--color-navy)]">
        <div className="flash-strip py-2">
          <div className="flex marquee-track whitespace-nowrap font-[family-name:var(--font-display-2)] text-base tracking-[0.18em]">
            {Array.from({ length: 2 }).map((_, batch) => (
              <div key={batch} className="flex shrink-0">
                {[
                  "● SINGLE IN DENVER",
                  "★ NOT AVAILABLE IN STORES",
                  "● ONE-OF-A-KIND ITEM",
                  "★ CALL NOW",
                  "● CAT-TESTED, MOTHER-APPROVED",
                  "★ APPLY WITHIN",
                  "● THIS PROMOTION ENDS WHEN HE GETS A GIRLFRIEND",
                ].map((s, i) => (
                  <span key={`${batch}-${i}`} className="px-10">
                    {s}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* "AS SEEN ON TV" header chip + the announcer h1 */}
        <div className="text-center mb-6">
          <span className="as-seen-on-tv text-base sm:text-lg mb-5 inline-block">
            ★ AS SEEN ON HINGE ★
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(46px,9vw,108px)] leading-[0.88] text-[var(--color-navy)] uppercase tracking-tight">
            Introducing
            <br />
            <span className="text-[var(--color-red)]">WADE.</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg sm:text-xl text-[var(--color-ink-soft)] leading-snug font-medium">
            A revolutionary new option in the dating marketplace.
            Twenty-seven years old. Single. Denver-based. Fully assembled.
            Yours to apply for — completely free.
          </p>
        </div>

        {/* THE COMMERCIAL — large video frame inside a chunky TV bezel.
            Click to unmute and play. */}
        <div className="mt-10 mx-auto max-w-3xl">
          <div className="relative bg-[var(--color-navy-deep)] p-3 sm:p-5 border-4 border-[var(--color-navy)] shadow-[10px_10px_0_var(--color-navy)]">
            <div className="absolute -top-5 left-6 sm:left-10 starburst w-20 h-20 sm:w-24 sm:h-24 text-xs sm:text-sm leading-[1.05] rotate-[-12deg] z-10">
              ★ NEW ★<br />
              FOR<br />
              2026
            </div>
            <div className="absolute -top-4 -right-3 sm:-right-5 z-10 rotate-[8deg]">
              <span className="inline-block bg-[var(--color-yellow)] text-[var(--color-red-deep)] font-[family-name:var(--font-display)] text-xs sm:text-sm px-3 py-1.5 border-2 border-[var(--color-navy)]">
                FREE TO APPLY
              </span>
            </div>

            <div className="relative bg-black aspect-video overflow-hidden">
              <video
                ref={videoRef}
                src="/videos/video-1.mp4"
                muted
                loop
                playsInline
                autoPlay
                className="w-full h-full object-cover"
              />
              {!unmuted && (
                <button
                  type="button"
                  onClick={unmuteAndPlay}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/55 text-white transition-colors"
                  aria-label="Unmute and play"
                >
                  <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--color-red)] border-4 border-white flex items-center justify-center mb-3 shadow-[6px_6px_0_var(--color-navy)]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl tracking-wide uppercase">
                    Play the Commercial
                  </span>
                  <span className="text-xs mt-2 opacity-80 font-[family-name:var(--font-display-2)] tracking-widest">
                    SOUND ON · 30 SECONDS
                  </span>
                </button>
              )}
              {/* "REC" badge top-right when playing */}
              <div className="absolute top-3 right-3 flex items-center gap-2 text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-red)] blink" />
                <span className="font-[family-name:var(--font-display-2)] text-xs tracking-widest">
                  REC
                </span>
              </div>
            </div>

            {/* Caption strip under the commercial */}
            <div className="bg-[var(--color-paper)] mt-3 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-[family-name:var(--font-display-2)] text-sm tracking-[0.12em] text-[var(--color-navy)]">
                PAID PROGRAMMING · DATEWADE.COM
              </div>
              <div className="font-[family-name:var(--font-display-2)] text-sm tracking-[0.12em] text-[var(--color-red)]">
                APPLY BELOW →
              </div>
            </div>
          </div>
        </div>

        {/* CTA row under the video */}
        <div className="mt-10 text-center">
          <a href="#apply" className="btn-pop text-xl sm:text-2xl inline-block">
            ★ Submit Your Application ★
          </a>
          <div className="mt-5 font-[family-name:var(--font-display-2)] text-sm tracking-[0.18em] text-[var(--color-ink-muted)]">
            NO CREDIT CARD · NO COMMITMENT · NO RETURNS
          </div>
        </div>
      </div>
    </section>
  );
}
