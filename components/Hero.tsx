"use client";

import { useRef, useState } from "react";

// The hero. Tasteful and warm by default; the 90s-infomercial energy
// lives in (1) the marquee strip up top, (2) the "watch the ad" CTA
// that opens a modal playing Kenny's audio video. Keep the rest of
// the page charming and earnest — bait with the joke, engage with
// sincerity.

export default function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function openVideo() {
    setVideoOpen(true);
    // Defer to the next paint so the <video> exists.
    window.requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  }

  function closeVideo() {
    videoRef.current?.pause();
    setVideoOpen(false);
  }

  return (
    <section className="relative pt-3 pb-24 px-6 overflow-hidden">
      {/* Marquee strip — the only loud-90s element on the page above the
          fold. Reads as an Easter egg, not a brand commitment. */}
      <div className="absolute top-0 left-0 right-0 bg-[var(--color-ink)] text-[var(--color-bg)] py-1.5 overflow-hidden">
        <div className="flex marquee-track whitespace-nowrap text-xs font-bold tracking-[0.15em] uppercase">
          {Array.from({ length: 2 }).map((_, batch) => (
            <div key={batch} className="flex shrink-0">
              {[
                "● now accepting applications",
                "★ as seen on hinge",
                "● cat dad certified",
                "★ no fees, no commitment, no obligation",
                "● operators standing by",
                "★ limited time offer",
                "● residents of denver receive priority routing",
              ].map((s, i) => (
                <span key={`${batch}-${i}`} className="px-8">
                  {s}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto pt-20 grid md:grid-cols-[1.1fr_0.9fr] gap-12 md:gap-16 items-center">
        <div>
          <div className="text-sm font-medium text-[var(--color-coral)] tracking-wide uppercase mb-4">
            apparently i need to start dating again
          </div>

          <h1 className="font-[family-name:var(--font-serif)] text-6xl md:text-7xl leading-[0.95] text-[var(--color-ink)] mb-6">
            hi,{" "}
            <span className="font-[family-name:var(--font-caveat)] text-[var(--color-coral)] italic">
              i&rsquo;m wade.
            </span>
          </h1>

          <p className="text-lg leading-relaxed text-[var(--color-ink-soft)] mb-8 max-w-md">
            i made this because hinge has six prompts and a 150-character
            bio, and that&rsquo;s not really enough to know if we&rsquo;d
            like each other. so: a real application. it takes about
            three minutes. i read every one.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#apply"
              className="inline-flex items-center gap-2 bg-[var(--color-ink)] text-[var(--color-paper)] px-6 py-3.5 rounded-full text-sm font-semibold hover:bg-[var(--color-coral)] transition-colors"
            >
              start the application →
            </a>
            <button
              type="button"
              onClick={openVideo}
              className="inline-flex items-center gap-2 bg-transparent border border-[var(--color-ink)] text-[var(--color-ink)] px-6 py-3.5 rounded-full text-sm font-semibold hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              watch the ad (30s)
            </button>
          </div>

          <div className="mt-10 flex items-center gap-4 text-xs text-[var(--color-ink-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-coral)]" />
              denver, co
            </span>
            <span>·</span>
            <span>cat dad</span>
            <span>·</span>
            <span>27</span>
            <span>·</span>
            <span>founder of credscore</span>
          </div>
        </div>

        {/* Hero polaroid (the cat shot — wade-2). Tilted slightly for
            charm, hover unrotates it. The caption is a fragment of
            voice not a description. */}
        <div className="flex justify-center md:justify-end">
          <div
            className="polaroid w-[280px] md:w-[320px]"
            style={{ transform: "rotate(2.5deg)" }}
          >
            <img
              src="/photos/wade-2.jpg"
              alt="wade and his cat"
              className="w-full aspect-[4/5] object-cover"
            />
            <div className="absolute mt-3 text-center w-[252px] md:w-[292px] font-[family-name:var(--font-caveat)] text-xl text-[var(--color-ink-soft)]">
              me and the boss
            </div>
          </div>
        </div>
      </div>

      {videoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeVideo}
        >
          <div
            className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeVideo}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/15 text-white text-lg hover:bg-white/25 transition-colors"
              aria-label="Close video"
            >
              ×
            </button>
            <video
              ref={videoRef}
              src="/videos/video-1.mp4"
              controls
              playsInline
              className="w-full aspect-video bg-black"
            />
          </div>
        </div>
      )}
    </section>
  );
}
