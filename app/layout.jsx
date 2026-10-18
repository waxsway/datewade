import './globals.css';

export const metadata = {
  title:'Bomb Tag! — Play with Friends | DateWade Games',
  description:'One bomb. Zero trust. Play Bomb Tag online with 2–8 friends. Create a private room, share a code and try not to explode.',
  metadataBase:new URL('https://datewade.com'),
  openGraph:{title:'BOMB TAG! — DateWade Games',description:'Your friends. One bomb. Zero trust.',url:'https://datewade.com',type:'website'},
  robots:{index:true,follow:true}
};

export default function RootLayout({children}){
  return <html lang="en"><body>{children}</body></html>;
}
