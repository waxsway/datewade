import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { Resend } from "resend";

// POST /api/apply
//   Receives the multipart form payload from ApplicationForm.
//   - Photo (if any) → uploaded to Vercel Blob, public URL embedded in the
//     email body so Wade can click straight from his inbox.
//   - All text fields → formatted as a readable email and sent via Resend
//     to wade@credscore.us.
//
// Env vars required:
//   RESEND_API_KEY        – existing CredScore key works
//   BLOB_READ_WRITE_TOKEN – Vercel Blob token (auto-injected on Vercel)
//   APPLY_TO_EMAIL        – defaults to wade@credscore.us
//   APPLY_FROM_EMAIL      – defaults to applications@datewade.com (set up
//                           the datewade.com sender domain in Resend first;
//                           falls back to onboarding@resend.dev for local
//                           testing if datewade isn't verified yet)

export const runtime = "nodejs";
// Photo uploads can take a moment on slow connections; give the route
// enough headroom under Vercel's default function timeout.
export const maxDuration = 30;

const APPLY_TO_EMAIL = process.env.APPLY_TO_EMAIL || "wade@credscore.us";
const APPLY_FROM_EMAIL =
  process.env.APPLY_FROM_EMAIL || "applications@datewade.com";

// Order of fields in the email body. Anything not in this map gets
// appended at the end under "Other fields" so we never silently drop
// a question.
const FIELD_LABELS_SELF: Array<[string, string]> = [
  ["name", "Name"],
  ["age", "Age"],
  ["city", "Where she lives"],
  ["cats", "Cats"],
  ["weekend", "Saturday with nothing planned"],
  ["nerd_about", "Nerds out about"],
  ["funny_thing", "Funniest thing this week"],
  ["care_about", "Genuinely cares about"],
  ["changed_mind", "Changed her mind about"],
  ["what_drew_you", "What drew her here"],
  ["working_on", "Working on"],
  ["anything_else", "Anything else"],
  ["contact", "Contact"],
];

const FIELD_LABELS_FRIEND: Array<[string, string]> = [
  ["name", "Submitted by"],
  ["age", "Submitter's age"],
  ["city", "Submitter's city"],
  ["your_relation", "Relationship to her"],
  ["her_name", "Her name"],
  ["her_age", "Her age"],
  ["her_city", "Her city"],
  ["awareness", "Does she know?"],
  ["why_us", "Why a good fit"],
  ["best_thing", "Best thing about her"],
  ["anything_else", "Anything else"],
  ["contact", "Submitter's contact"],
];

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not parse form" }, { status: 400 });
  }

  const mode = form.get("mode") === "friend" ? "friend" : "self";
  const labels = mode === "friend" ? FIELD_LABELS_FRIEND : FIELD_LABELS_SELF;

  // ─── Photo upload ──────────────────────────────────────────────────────
  let photoUrl: string | null = null;
  const photo = form.get("photo");
  if (photo && photo instanceof File && photo.size > 0) {
    // Basic sanity bounds. 8 MB upper limit covers any reasonable
    // phone photo without inviting abuse.
    if (photo.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Photo is too large (max 8 MB)" },
        { status: 400 }
      );
    }
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "That file doesn't look like an image" },
        { status: 400 }
      );
    }

    try {
      const safeName =
        photo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "photo.jpg";
      const submitter =
        (form.get("name") as string | null)?.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) ||
        "anonymous";
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
      const filename = `applications/${stamp}__${submitter}__${safeName}`;
      const result = await put(filename, photo, { access: "public" });
      photoUrl = result.url;
    } catch (err) {
      console.error("[/api/apply] photo upload failed:", err);
      // Don't block the submission on a photo failure — Wade would
      // rather have the text than nothing.
      photoUrl = null;
    }
  }

  // ─── Email body ────────────────────────────────────────────────────────
  const submitterName = (form.get("name") as string | null) || "anonymous";
  const subjectName = submitterName.trim() || "anonymous";
  const subject =
    mode === "friend"
      ? `[datewade] friend rec from ${subjectName}`
      : `[datewade] new application from ${subjectName}`;

  const knownKeys = new Set(labels.map(([k]) => k));
  const otherEntries: Array<[string, string]> = [];
  for (const [k, v] of form.entries()) {
    if (k === "photo" || k === "photo-display" || k === "mode") continue;
    if (knownKeys.has(k)) continue;
    if (typeof v === "string" && v.trim()) otherEntries.push([k, v]);
  }

  const html = renderHtml({
    mode,
    labels,
    form,
    photoUrl,
    otherEntries,
  });
  const text = renderText({
    mode,
    labels,
    form,
    photoUrl,
    otherEntries,
  });

  // ─── Send via Resend ───────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[/api/apply] RESEND_API_KEY not set; cannot send. Form was:",
      Object.fromEntries(Array.from(form.entries()).filter(([k]) => k !== "photo"))
    );
    return NextResponse.json(
      { error: "Email service not configured. Try again later." },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);
  try {
    const reply = (form.get("contact") as string | null) || undefined;
    const result = await resend.emails.send({
      from: APPLY_FROM_EMAIL,
      to: APPLY_TO_EMAIL,
      subject,
      html,
      text,
      replyTo: reply,
    });
    if (result.error) throw result.error;
  } catch (err) {
    console.error("[/api/apply] Resend send failed:", err);
    return NextResponse.json(
      { error: "Couldn't send the email. Mind trying again in a sec?" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

// ─── Renderers ───────────────────────────────────────────────────────────

function renderHtml(opts: {
  mode: "self" | "friend";
  labels: Array<[string, string]>;
  form: FormData;
  photoUrl: string | null;
  otherEntries: Array<[string, string]>;
}): string {
  const { mode, labels, form, photoUrl, otherEntries } = opts;
  const rows = labels
    .map(([key, label]) => {
      const raw = form.get(key);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) return "";
      return `
        <tr>
          <td style="padding:14px 20px 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7a6e;font-family:Arial,sans-serif;">${escapeHtml(label)}</td>
        </tr>
        <tr>
          <td style="padding:0 20px 14px;font-size:15px;line-height:1.55;color:#1a1410;font-family:Georgia,serif;white-space:pre-wrap;">${escapeHtml(value)}</td>
        </tr>`;
    })
    .join("");

  const otherRows = otherEntries
    .map(
      ([k, v]) => `
        <tr><td style="padding:14px 20px 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7a6e;font-family:Arial,sans-serif;">${escapeHtml(k)}</td></tr>
        <tr><td style="padding:0 20px 14px;font-size:15px;line-height:1.55;color:#1a1410;font-family:Georgia,serif;white-space:pre-wrap;">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  const photoBlock = photoUrl
    ? `
      <tr>
        <td style="padding:0 20px 24px;">
          <a href="${escapeHtml(photoUrl)}" style="display:block;border:1px solid #f0e6d8;border-radius:8px;overflow:hidden;text-decoration:none;">
            <img src="${escapeHtml(photoUrl)}" alt="photo" style="display:block;width:100%;max-width:360px;height:auto;" />
          </a>
          <div style="margin-top:8px;font-size:11px;color:#8a7a6e;font-family:Arial,sans-serif;">
            <a href="${escapeHtml(photoUrl)}" style="color:#8a7a6e;">open full size</a>
          </div>
        </td>
      </tr>`
    : "";

  const tagline =
    mode === "friend"
      ? "a friend-recommendation came in."
      : "a new application came in.";

  return `<!doctype html>
<html><body style="margin:0;background:#fef9f3;font-family:Arial,sans-serif;color:#1a1410;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef9f3;padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="background:#fffdf8;border:1px solid #f0e6d8;border-radius:12px;max-width:600px;">
        <tr>
          <td style="padding:24px 20px 4px;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#e85d5d;font-weight:bold;">datewade.com</div>
            <div style="font-family:Georgia,serif;font-size:22px;color:#1a1410;margin-top:6px;">${tagline}</div>
          </td>
        </tr>
        ${photoBlock}
        ${rows}
        ${otherRows ? `<tr><td style="padding:16px 20px 4px;font-size:10px;color:#8a7a6e;text-transform:uppercase;letter-spacing:0.08em;">other fields</td></tr>${otherRows}` : ""}
        <tr>
          <td style="padding:18px 20px 22px;border-top:1px solid #f0e6d8;font-size:11px;color:#8a7a6e;font-family:Arial,sans-serif;">
            received ${new Date().toUTCString()}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(opts: {
  mode: "self" | "friend";
  labels: Array<[string, string]>;
  form: FormData;
  photoUrl: string | null;
  otherEntries: Array<[string, string]>;
}): string {
  const { mode, labels, form, photoUrl, otherEntries } = opts;
  const lines: string[] = [];
  lines.push(
    mode === "friend"
      ? "a friend-recommendation came in."
      : "a new application came in."
  );
  lines.push("");
  if (photoUrl) {
    lines.push(`PHOTO: ${photoUrl}`);
    lines.push("");
  }
  for (const [key, label] of labels) {
    const raw = form.get(key);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    lines.push(label.toUpperCase());
    lines.push(value);
    lines.push("");
  }
  if (otherEntries.length) {
    lines.push("-- other fields --");
    for (const [k, v] of otherEntries) {
      lines.push(`${k.toUpperCase()}: ${v}`);
    }
  }
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
