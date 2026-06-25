import type { Metadata } from "next";
import { Inter, Anton, Bebas_Neue } from "next/font/google";
import "./globals.css";

// Body: Inter (clean, neutral, gets out of the way).
// Display headlines: Anton — heavy condensed sans, the closest free
// equivalent to Impact / the classic 90s-infomercial headline font.
// Secondary display: Bebas Neue — pairs with Anton for ticker / chip
// type, slightly less aggressive.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const anton = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const bebas = Bebas_Neue({
  variable: "--font-display-2",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WADE — as seen on hinge",
  description:
    "Tired of the same old guys? Introducing WADE: a single male, 33, denver-based, fully assembled, cat-tested. Apply now.",
  openGraph: {
    title: "WADE — as seen on hinge",
    description:
      "Tired of the same old guys? Introducing WADE: a single male, 33, denver-based, fully assembled, cat-tested. Apply now.",
    url: "https://datewade.com",
    siteName: "WADE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WADE — as seen on hinge",
    description:
      "Tired of the same old guys? Introducing WADE. Apply now.",
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
      className={`${inter.variable} ${anton.variable} ${bebas.variable} antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
