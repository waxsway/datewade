import './globals.css';
export const metadata={
 title:'DateWade Games — Party Arena',
 description:'Play 300 fast challenge configurations with friends in a 3D multiplayer party arena. No download, no signup.',
 metadataBase:new URL('https://datewade.com'),
 openGraph:{title:'DateWade Party Arena',description:'12 mini-game modes. 300 chaotic challenges. 2–8 friends.',url:'https://datewade.com',type:'website'},
 robots:{index:true,follow:true}
};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>;}
