import type { Metadata } from "next";
import { Geist, Caveat, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Body: clean modern sans (Geist).
// Handwritten accents and section headers: Caveat (cursive, used sparingly).
// Editorial headlines: Instrument Serif (warm, characterful, not stuffy).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "date wade",
  description:
    "apparently i need to start dating again. tell me about you.",
  openGraph: {
    title: "date wade",
    description:
      "apparently i need to start dating again. tell me about you.",
    url: "https://datewade.com",
    siteName: "date wade",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "date wade",
    description:
      "apparently i need to start dating again. tell me about you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${caveat.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
