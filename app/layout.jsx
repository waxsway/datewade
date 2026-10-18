import './globals.css';
export const metadata={
 title:'DateWade Party Arena — 3D Multiplayer Mini-Games',
 description:'Third-person 3D party games for 2–8 friends. 12 mini-game rulesets, 25 stage variants each, 300 challenge configurations. Create a private room and compete.',
 metadataBase:new URL('https://datewade.com'),
 openGraph:{title:'DateWade Party Arena',description:'Your friends. One arena. 300 ways to lose.',url:'https://datewade.com',type:'website'},
 robots:{index:true,follow:true}
};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>;}
