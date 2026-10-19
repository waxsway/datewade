import './globals.css';

export const metadata = {
  title: 'DateWade Arena',
  description: 'Top-down multiplayer shootouts for 2 to 8 friends with random stat upgrades after every round. Free, in the browser, no signup.',
  metadataBase: new URL('https://datewade.com'),
  openGraph: {
    title: 'DateWade Arena',
    description: 'Top-down shootouts with friends. Win rounds, grab upgrades, build something broken.',
    url: 'https://datewade.com',
    type: 'website'
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bungee&family=Chakra+Petch:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
