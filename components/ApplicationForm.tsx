"use client";

import { useState, type FormEvent } from "react";

// THE APPLICATION — collapsed to ONE big question per Wade's note.
// Self / Friend toggle reshapes the question label but the shape is the
// same: identifiers + photo + the single open-ended pitch. Everything
// else goes away.

type Mode = "self" | "friend";

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
      <section id="apply" className="relative py-24 px-4 sm:px-6 bg-[var(--color-red)] text-[var(--color-paper)]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-block bg-[var(--color-yellow)] text-[var(--color-red-deep)] px-4 py-2 mb-5 font-[family-name:var(--font-display)] tracking-wide border-4 border-[var(--color-navy)]">
            ★ APPLICATION RECEIVED ★
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,84px)] leading-[0.9] uppercase mb-5">
            Thank You.<br />
            <span className="text-[var(--color-yellow)]">Truly.</span>
          </h2>
          <p className="text-xl leading-snug max-w-md mx-auto">
            Your submission has been transmitted to the offices of
            Wade. He will review it personally. Operators are not
            standing by, but he is. Probably with the cat.
          </p>
        </div>
      </section>
    );
  }

  const headlineQuestion =
    mode === "self"
      ? "Why do you think you'd be a good fit for Wade?"
      : "Why do you think she'd be a good fit for Wade?";

  return (
    <section id="apply" className="relative py-20 px-4 sm:px-6 bg-[var(--color-red)] text-[var(--color-paper)] overflow-hidden">
      {/* Decorative starburst floating in the corner */}
      <div className="absolute top-8 left-8 hidden md:block starburst w-24 h-24 text-xs leading-[1.05] rotate-[-18deg]">
        ★ ACT ★<br />NOW
      </div>
      <div className="absolute top-8 right-8 hidden md:block">
        <span className="inline-block bg-[var(--color-yellow)] text-[var(--color-red-deep)] font-[family-name:var(--font-display)] text-sm px-3 py-1.5 border-2 border-[var(--color-navy)] rotate-[12deg]">
          FREE TO APPLY
        </span>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block bg-[var(--color-yellow)] text-[var(--color-red-deep)] px-3 py-1.5 mb-5 font-[family-name:var(--font-display-2)] tracking-[0.14em] text-sm">
            ★ THE APPLICATION ★
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,84px)] leading-[0.9] uppercase">
            Step Right Up.
          </h2>
          <p className="mt-4 max-w-md mx-auto text-base leading-snug font-medium">
            One question. Three minutes of your time. Goes directly to
            Wade&rsquo;s inbox. He reads every one personally.
          </p>
        </div>

        {/* Self / friend toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 bg-[var(--color-paper)] border-4 border-[var(--color-navy)] shadow-[6px_6px_0_var(--color-navy)]">
            <button
              type="button"
              onClick={() => setMode("self")}
              className={`px-5 py-2 font-[family-name:var(--font-display-2)] tracking-[0.12em] text-sm transition-colors ${
                mode === "self"
                  ? "bg-[var(--color-navy)] text-[var(--color-paper)]"
                  : "text-[var(--color-navy)]"
              }`}
            >
              I&rsquo;M APPLYING
            </button>
            <button
              type="button"
              onClick={() => setMode("friend")}
              className={`px-5 py-2 font-[family-name:var(--font-display-2)] tracking-[0.12em] text-sm transition-colors ${
                mode === "friend"
                  ? "bg-[var(--color-navy)] text-[var(--color-paper)]"
                  : "text-[var(--color-navy)]"
              }`}
            >
              FOR A FRIEND
            </button>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-[var(--color-paper)] text-[var(--color-navy)] p-6 sm:p-8 border-4 border-[var(--color-navy)] shadow-[8px_8px_0_var(--color-navy)] space-y-6"
        >
          {/* Identifiers */}
          <div className="grid sm:grid-cols-3 gap-4">
            <FieldText id="name" label={mode === "self" ? "YOUR NAME" : "YOUR NAME"} required />
            <FieldText id="age" label={mode === "self" ? "AGE" : "HER AGE"} type="number" required />
            <FieldText
              id="city"
              label={mode === "self" ? "WHERE YOU LIVE" : "WHERE SHE LIVES"}
              required
            />
          </div>

          {mode === "friend" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldText id="her_name" label="HER NAME" required />
              <FieldText
                id="your_relation"
                label="HOW YOU KNOW HER"
                required
              />
            </div>
          )}

          {/* THE QUESTION — the only open text field on the form */}
          <FieldTextarea
            id="pitch"
            label={headlineQuestion}
            rows={8}
            required
          />

          {/* Photo */}
          <div>
            <label
              htmlFor="photo"
              className="block font-[family-name:var(--font-display-2)] tracking-[0.14em] text-sm text-[var(--color-navy)] mb-2"
            >
              {mode === "self" ? "★ ONE PHOTO OF YOU ★" : "★ ONE PHOTO OF HER ★"}
              <span className="text-[var(--color-red)] ml-1">*</span>
            </label>
            <div className="border-4 border-dashed border-[var(--color-navy)]/40 p-5 text-center bg-[var(--color-cream)]">
              <input
                id="photo"
                name="photo-display"
                type="file"
                accept="image/*"
                required
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="block mx-auto text-sm"
              />
              {photoFile && (
                <div className="mt-3 text-xs font-[family-name:var(--font-display-2)] tracking-widest text-[var(--color-red)]">
                  ✓ {photoFile.name} ({Math.round(photoFile.size / 1024)}KB)
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <FieldText
            id="contact"
            label={mode === "self" ? "HOW SHOULD HE REACH YOU?" : "HOW SHOULD HE REACH YOU?"}
            required
          />

          {/* Submit */}
          <div className="pt-2 text-center">
            <button
              type="submit"
              disabled={submitting}
              className="btn-pop text-lg sm:text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "TRANSMITTING…" : "★ SUBMIT APPLICATION ★"}
            </button>
            {done && !done.ok && (
              <div className="mt-3 text-sm text-[var(--color-red)] font-medium">
                {done.message}
              </div>
            )}
            <p className="mt-4 font-[family-name:var(--font-display-2)] text-[11px] tracking-[0.18em] text-[var(--color-ink-muted)]">
              YOUR PHOTO IS STORED PRIVATELY. NO RESALE. NO THIRD PARTIES.
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
      <label
        htmlFor={id}
        className="block font-[family-name:var(--font-display-2)] tracking-[0.14em] text-xs sm:text-sm text-[var(--color-navy)] mb-1.5"
      >
        {label}
        {required && <span className="text-[var(--color-red)] ml-1">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        className="w-full px-4 py-3 bg-[var(--color-cream)] border-2 border-[var(--color-navy)] text-[var(--color-navy)] focus:outline-none focus:bg-[var(--color-paper)] focus:border-[var(--color-red)]"
      />
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  rows = 6,
  required = false,
}: {
  id: string;
  label: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-[family-name:var(--font-display)] text-xl sm:text-2xl text-[var(--color-navy)] mb-2 uppercase leading-tight"
      >
        {label}
        {required && <span className="text-[var(--color-red)] ml-1">*</span>}
      </label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        required={required}
        placeholder="Take your time. Be specific. Surprises welcome."
        className="w-full px-4 py-4 bg-[var(--color-cream)] border-2 border-[var(--color-navy)] text-[var(--color-navy)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:bg-[var(--color-paper)] focus:border-[var(--color-red)] resize-y leading-relaxed"
      />
    </div>
  );
}
