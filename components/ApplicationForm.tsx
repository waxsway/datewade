"use client";

import { useState, type FormEvent } from "react";

// Application form. Two modes:
//   1. "applying for yourself" (default) — substantive questions, photo
//      upload, the whole real thing.
//   2. "applying for a friend" — reshaped to a recommendation form.
//
// The fields stay the same shape across both modes (uploaded photo +
// answers payload), so the API route doesn't need to branch on mode.

type Mode = "self" | "friend";

const SELF_QUESTIONS: { id: string; label: string; placeholder?: string; rows?: number }[] = [
  { id: "weekend", label: "how do you spend a saturday when you have nothing planned?", rows: 3 },
  { id: "nerd_about", label: "what's something you nerd out about that you wouldn't usually lead with?", rows: 3 },
  { id: "funny_thing", label: "what's the funniest thing that's happened to you this week?", rows: 3 },
  { id: "care_about", label: "tell me about something or someone you genuinely care about.", rows: 4 },
  { id: "changed_mind", label: "one thing you've changed your mind about in the last year.", rows: 3 },
  { id: "what_drew_you", label: "what made you click on this? what about the video or my bio actually got you here?", rows: 3 },
  { id: "working_on", label: "if you're being honest with yourself, the thing about you you're working on is...", rows: 3 },
  { id: "anything_else", label: "anything else you want me to know? a song you've had on repeat, a weird fact, a question for me — whatever.", rows: 3 },
];

const FRIEND_QUESTIONS: { id: string; label: string; rows?: number }[] = [
  { id: "your_relation", label: "how do you know her? (friend, sister, coworker, etc.)" },
  { id: "her_city", label: "where does she live?" },
  { id: "why_us", label: "in one sentence, why do you think we'd be a good fit?", rows: 3 },
  { id: "best_thing", label: "what's the best thing about her?", rows: 3 },
  { id: "anything_else", label: "anything else you want me to know about her? a story, a quirk, a warning — whatever.", rows: 3 },
];

export default function ApplicationForm() {
  const [mode, setMode] = useState<Mode>("self");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; message?: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setDone(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("mode", mode);
      if (photoFile) formData.set("photo", photoFile);

      const res = await fetch("/api/apply", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDone({ ok: false, message: body?.error || "Something went wrong. Try again?" });
        return;
      }
      setDone({ ok: true });
    } catch (err) {
      setDone({ ok: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (done?.ok) {
    return (
      <section id="apply" className="py-32 px-6 bg-[var(--color-bg-subtle)]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-sm font-medium text-[var(--color-coral)] tracking-wide uppercase mb-3">
            received
          </div>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl leading-tight text-[var(--color-ink)] mb-6">
            thank you,{" "}
            <span className="italic font-[family-name:var(--font-caveat)] text-[var(--color-coral)]">
              actually
            </span>
            .
          </h2>
          <p className="text-lg text-[var(--color-ink-soft)] leading-relaxed">
            it&rsquo;s in my inbox. i&rsquo;ll read it tonight. if it
            feels like a real fit i&rsquo;ll write back. if not,
            i&rsquo;ll still read it — that&rsquo;s the whole point of
            this thing.
          </p>
        </div>
      </section>
    );
  }

  const questions = mode === "self" ? SELF_QUESTIONS : FRIEND_QUESTIONS;

  return (
    <section id="apply" className="py-24 px-6 bg-[var(--color-bg-subtle)]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-sm font-medium text-[var(--color-coral)] tracking-wide uppercase mb-3">
            the application
          </div>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl leading-tight text-[var(--color-ink)] mb-3">
            tell me about{" "}
            <span className="italic font-[family-name:var(--font-caveat)] text-[var(--color-coral)]">
              you
            </span>
            .
          </h2>
          <p className="text-[var(--color-ink-soft)] max-w-md mx-auto">
            no wrong answers. takes about three minutes. goes straight
            to my inbox, nowhere else.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1 bg-[var(--color-paper)] rounded-full border border-[var(--color-ink-muted)]/20">
            <button
              type="button"
              onClick={() => setMode("self")}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-colors ${
                mode === "self"
                  ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "text-[var(--color-ink-soft)]"
              }`}
            >
              applying for myself
            </button>
            <button
              type="button"
              onClick={() => setMode("friend")}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-colors ${
                mode === "friend"
                  ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "text-[var(--color-ink-soft)]"
              }`}
            >
              applying for a friend
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-7">
          {/* Identity row — same regardless of mode, just relabeled. */}
          <div className="grid sm:grid-cols-3 gap-4">
            <FieldText
              id="name"
              label={mode === "self" ? "your name" : "your name"}
              required
            />
            <FieldText
              id="age"
              label={mode === "self" ? "age" : "your age (optional)"}
              type="number"
              required={mode === "self"}
            />
            <FieldText
              id="city"
              label={mode === "self" ? "where you live" : "your city"}
              required={mode === "self"}
            />
          </div>

          {/* Friend mode adds: who is she, awareness toggle, her details */}
          {mode === "friend" && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <FieldText id="her_name" label="her name" required />
                <FieldText id="her_age" label="her age (rough is fine)" />
              </div>

              <FieldText
                id="awareness"
                label="does she know you're submitting this? (yes / no, surprise / hard no)"
                required
              />
            </>
          )}

          {/* Questions */}
          {questions.map((q) => (
            <FieldTextarea
              key={q.id}
              id={q.id}
              label={q.label}
              rows={q.rows ?? 3}
              required={["weekend", "care_about", "best_thing", "why_us"].includes(q.id)}
            />
          ))}

          {/* Cats — only on self mode, has a specific shape */}
          {mode === "self" && (
            <div>
              <label
                htmlFor="cats"
                className="block text-sm font-semibold text-[var(--color-ink)] mb-3"
              >
                your honest relationship with cats
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["love them", "they're fine", "not for me", "allergic, sadly"].map((opt) => (
                  <label
                    key={opt}
                    className="cursor-pointer text-center text-sm px-3 py-3 bg-[var(--color-paper)] border border-[var(--color-ink-muted)]/20 rounded-lg hover:border-[var(--color-coral)] transition-colors has-[input:checked]:border-[var(--color-coral)] has-[input:checked]:bg-[var(--color-coral)]/10 has-[input:checked]:text-[var(--color-coral)] has-[input:checked]:font-semibold"
                  >
                    <input
                      type="radio"
                      name="cats"
                      value={opt}
                      className="sr-only"
                      required
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Photo upload */}
          <div>
            <label
              htmlFor="photo"
              className="block text-sm font-semibold text-[var(--color-ink)] mb-2"
            >
              {mode === "self" ? "one photo of you" : "one photo of her (or her ig handle in the text below if you don't have a pic)"}
            </label>
            <div className="border-2 border-dashed border-[var(--color-ink-muted)]/30 rounded-lg p-6 text-center bg-[var(--color-paper)] hover:border-[var(--color-coral)] transition-colors">
              <input
                id="photo"
                name="photo-display"
                type="file"
                accept="image/*"
                required={mode === "self"}
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="block mx-auto text-sm text-[var(--color-ink-soft)]"
              />
              {photoFile && (
                <div className="mt-3 text-xs text-[var(--color-teal)]">
                  ✓ {photoFile.name} ({Math.round(photoFile.size / 1024)}kb)
                </div>
              )}
            </div>
          </div>

          {/* Friend mode: contact for follow-ups */}
          {mode === "friend" && (
            <FieldText
              id="contact"
              label="your contact (email or phone) so i can ask follow-ups"
              required
            />
          )}

          {/* Contact (self mode) */}
          {mode === "self" && (
            <FieldText
              id="contact"
              label="how should i reach you if this works out? (email, instagram, phone — whatever you actually check)"
              required
            />
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--color-ink)] text-[var(--color-paper)] py-4 rounded-full text-base font-semibold hover:bg-[var(--color-coral)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "sending..." : "send my application"}
            </button>
            {done && !done.ok && (
              <div className="mt-3 text-sm text-[var(--color-coral)] text-center">
                {done.message}
              </div>
            )}
            <p className="mt-4 text-center text-xs text-[var(--color-ink-muted)]">
              your photo is uploaded to private storage and shared only
              with me. no third parties, no data sales, no algorithm.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}

function FieldText({
  id,
  label,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)] mb-2">
        {label}
        {required && <span className="text-[var(--color-coral)] ml-1">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        className="w-full px-4 py-3 bg-[var(--color-paper)] border border-[var(--color-ink-muted)]/30 rounded-lg text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/20 transition-colors"
      />
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  rows = 3,
  required = false,
}: {
  id: string;
  label: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)] mb-2">
        {label}
        {required && <span className="text-[var(--color-coral)] ml-1">*</span>}
      </label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        required={required}
        className="w-full px-4 py-3 bg-[var(--color-paper)] border border-[var(--color-ink-muted)]/30 rounded-lg text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/20 transition-colors resize-y leading-relaxed"
      />
    </div>
  );
}
